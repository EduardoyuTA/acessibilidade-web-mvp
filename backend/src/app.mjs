import cors from "cors";
import express from "express";
import { analyzePage } from "./analyze.mjs";
import { createRateLimiter } from "./rate-limit.mjs";

const TIMEOUT_MESSAGE = "A análise excedeu o tempo máximo.";

function numberFromEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function createApp({
  analyze = analyzePage,
  timeoutMs = 50_000,
  // Depois de pedir o cancelamento, quanto esperar a análise encerrar antes de
  // liberar a vaga mesmo assim (proteção contra um navegador travado).
  abortGraceMs = 10_000,
  rateLimit = {
    max: numberFromEnv("RATE_LIMIT_MAX", 10),
    windowMs: numberFromEnv("RATE_LIMIT_WINDOW_MS", 10 * 60_000)
  },
  now
} = {}) {
  const app = express();
  const allowedOrigins = (
    process.env.FRONTEND_ORIGIN ||
    "http://localhost:5173,http://127.0.0.1:5173"
  )
    .split(",")
    .map((value) => value.trim().replace(/\/+$/, ""))
    .filter(Boolean);
  const hitRateLimit = createRateLimiter({ ...rateLimit, now });
  let activeAnalyses = 0;

  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(cors({
    origin(origin, callback) {
      const normalized = origin ? origin.trim().replace(/\/+$/, "") : "";
      if (!normalized || allowedOrigins.includes(normalized)) {
        return callback(null, true);
      }
      callback(new Error("Origem não permitida."));
    },
    methods: ["GET", "POST"],
    exposedHeaders: ["Retry-After"],
    maxAge: 600
  }));
  app.use(express.json({ limit: "4kb", strict: true }));

  app.get("/health", (_request, response) => {
    response.json({ status: "ok", service: "acessoclaro-api" });
  });

  app.post("/api/analyze", async (request, response) => {
    if (activeAnalyses >= 1) {
      return response.status(429).json({ error: "O analisador está ocupado. Tente novamente em instantes." });
    }

    const limit = hitRateLimit(request.ip || "desconhecido");
    if (!limit.allowed) {
      const minutes = Math.ceil(limit.retryAfterSeconds / 60);
      response.set("Retry-After", String(limit.retryAfterSeconds));
      return response.status(429).json({
        error: `Limite de análises atingido. Tente novamente em ${minutes} ${minutes === 1 ? "minuto" : "minutos"}.`
      });
    }

    activeAnalyses += 1;
    const controller = new AbortController();
    const task = Promise.resolve().then(() =>
      analyze(request.body?.url, { signal: controller.signal })
    );

    // A vaga só é liberada quando a análise realmente termina (ou, se ela não
    // responder ao cancelamento, após o período de tolerância).
    let released = false;
    let graceTimer;
    const release = () => {
      if (released) return;
      released = true;
      clearTimeout(graceTimer);
      activeAnalyses -= 1;
    };
    task.then(release, release);

    const abort = (reason) => {
      if (controller.signal.aborted) return;
      controller.abort(reason);
      graceTimer = setTimeout(release, abortGraceMs);
      graceTimer.unref?.();
    };

    // O cliente desistiu (ex.: botão "Cancelar análise"): para o trabalho.
    response.on("close", () => {
      if (!response.writableFinished) abort(new Error("Cliente desconectado."));
    });

    let timeout;
    try {
      const result = await Promise.race([
        task,
        new Promise((_, reject) => {
          timeout = setTimeout(() => {
            abort(new Error(TIMEOUT_MESSAGE));
            reject(new Error(TIMEOUT_MESSAGE));
          }, timeoutMs);
        })
      ]);
      response.json(result);
    } catch (error) {
      if (response.destroyed) return;
      const message = error instanceof Error ? error.message : "Não foi possível concluir a análise.";
      const clientError = /URL|HTTP|HTTPS|porta|endereço|rede privada|reservada|credenciais/i.test(message);
      const status = message === TIMEOUT_MESSAGE ? 504 : clientError ? 400 : 502;
      response.status(status).json({ error: message });
    } finally {
      clearTimeout(timeout);
    }
  });

  app.use((error, _request, response, _next) => {
    const isJsonError = error instanceof SyntaxError && "body" in error;
    response.status(isJsonError ? 400 : 403).json({
      error: isJsonError ? "O corpo da requisição contém JSON inválido." : "Origem não permitida."
    });
  });

  return app;
}
