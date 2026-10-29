import cors from "cors";
import express from "express";
import { analyzePage } from "./analyze.mjs";

export function createApp({ analyze = analyzePage } = {}) {
  const app = express();
  const allowedOrigins = (
    process.env.FRONTEND_ORIGIN ||
    "http://localhost:5173,http://127.0.0.1:5173"
  )
    .split(",")
    .map((value) => value.trim().replace(/\/+$/, ""))
    .filter(Boolean);
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

    activeAnalyses += 1;
    let timeout;
    try {
      const result = await Promise.race([
        analyze(request.body?.url),
        new Promise((_, reject) => {
          timeout = setTimeout(() => reject(new Error("A análise excedeu o tempo máximo.")), 50_000);
        })
      ]);
      response.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível concluir a análise.";
      const clientError = /URL|HTTP|HTTPS|porta|endereço|rede privada|reservada|credenciais/i.test(message);
      response.status(clientError ? 400 : 502).json({ error: message });
    } finally {
      clearTimeout(timeout);
      activeAnalyses -= 1;
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
