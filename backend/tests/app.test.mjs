import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";
import { createApp } from "../src/app.mjs";

test("expõe a verificação de saúde", async () => {
  const response = await request(createApp()).get("/health");
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { status: "ok", service: "acessoclaro-api" });
});

test("devolve o resultado fornecido pelo analisador", async () => {
  const expected = { url: "https://example.com/", findings: [] };
  const app = createApp({ analyze: async () => expected });
  const response = await request(app)
    .post("/api/analyze")
    .set("origin", "http://localhost:5173")
    .send({ url: "https://example.com" });
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, expected);
});

test("rejeita origens diferentes do front-end", async () => {
  const response = await request(createApp({ analyze: async () => ({}) }))
    .post("/api/analyze")
    .set("origin", "https://malicioso.example")
    .send({ url: "https://example.com" });
  assert.equal(response.status, 403);
});

test("retorna 400 para erros de validação de URL e JSON malformado", async () => {
  const app = createApp({
    analyze: async () => {
      throw new Error("Apenas URLs HTTP/HTTPS públicas e sem credenciais são aceitas.");
    }
  });

  const validationRes = await request(app)
    .post("/api/analyze")
    .set("origin", "http://localhost:5173")
    .send({ url: "ftp://example.com" });
  assert.equal(validationRes.status, 400);
  assert.match(validationRes.body.error, /HTTP\/HTTPS/);

  const badJsonRes = await request(app)
    .post("/api/analyze")
    .set("origin", "http://localhost:5173")
    .set("content-type", "application/json")
    .send("{json-invalido");
  assert.equal(badJsonRes.status, 400);
  assert.match(badJsonRes.body.error, /JSON inválido/);
});

test("limita análises concorrentes com status 429", async () => {
  let release;
  const blocker = new Promise((resolve) => {
    release = resolve;
  });

  const app = createApp({
    analyze: async () => {
      await blocker;
      return { url: "https://example.com/", findings: [] };
    }
  });

  const first = request(app)
    .post("/api/analyze")
    .set("origin", "http://localhost:5173")
    .send({ url: "https://example.com" })
    .then((res) => res);

  await new Promise((r) => setTimeout(r, 30));

  const second = await request(app)
    .post("/api/analyze")
    .set("origin", "http://localhost:5173")
    .send({ url: "https://example.com" });

  assert.equal(second.status, 429);
  assert.match(second.body.error, /ocupado/);

  release();
  const firstRes = await first;
  assert.equal(firstRes.status, 200);
});

const ORIGIN = "http://localhost:5173";
const post = (app) =>
  request(app).post("/api/analyze").set("origin", ORIGIN).send({ url: "https://example.com" });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test("no tempo limite cancela a análise e só libera a vaga quando ela termina", async () => {
  let receivedSignal;
  let finish;
  const app = createApp({
    timeoutMs: 40,
    abortGraceMs: 5_000,
    analyze: (_url, { signal }) => {
      receivedSignal = signal;
      // Simula o navegador demorando para encerrar após o cancelamento.
      return new Promise((_, reject) => {
        finish = () => reject(new Error("contexto fechado"));
      });
    }
  });

  const timedOut = await post(app);
  assert.equal(timedOut.status, 504);
  assert.match(timedOut.body.error, /tempo máximo/);
  assert.equal(receivedSignal.aborted, true);

  // A análise anterior ainda não terminou: a vaga continua ocupada.
  const busy = await post(app);
  assert.equal(busy.status, 429);
  assert.match(busy.body.error, /ocupado/);

  finish();
  await wait(10);
  const app2Res = await post(app);
  assert.equal(app2Res.status, 504, "a vaga foi liberada e uma nova análise começou");
  finish();
});

test("libera a vaga após o período de tolerância se a análise não encerrar", async () => {
  let calls = 0;
  const app = createApp({
    timeoutMs: 20,
    abortGraceMs: 40,
    analyze: () => {
      calls += 1;
      return new Promise(() => {});
    }
  });

  assert.equal((await post(app)).status, 504);
  assert.equal((await post(app)).status, 429);
  await wait(60);
  assert.equal((await post(app)).status, 504);
  assert.equal(calls, 2);
});

test("cancela a análise quando o cliente desiste da requisição", async () => {
  let receivedSignal;
  const app = createApp({
    analyze: (_url, { signal }) => {
      receivedSignal = signal;
      return new Promise((_, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason));
      });
    }
  });

  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const controller = new AbortController();
  const pending = fetch(`http://127.0.0.1:${server.address().port}/api/analyze`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN },
    body: JSON.stringify({ url: "https://example.com" }),
    signal: controller.signal
  }).catch(() => "cancelado");
  await wait(30);
  controller.abort();
  assert.equal(await pending, "cancelado");
  await wait(30);
  assert.equal(receivedSignal.aborted, true);

  const next = await post(app);
  assert.notEqual(next.status, 429, "a vaga foi liberada");
  server.close();
});

test("limita análises por IP e informa quando tentar de novo", async () => {
  let clock = 0;
  const app = createApp({
    analyze: async () => ({ url: "https://example.com/", findings: [] }),
    rateLimit: { max: 2, windowMs: 60_000 },
    now: () => clock
  });

  assert.equal((await post(app)).status, 200);
  assert.equal((await post(app)).status, 200);
  const blocked = await post(app);
  assert.equal(blocked.status, 429);
  assert.match(blocked.body.error, /Limite de análises/);
  assert.equal(blocked.headers["retry-after"], "60");

  clock = 60_000;
  assert.equal((await post(app)).status, 200, "a janela reinicia");
});

test("conta o limite separadamente para cada IP", async () => {
  const app = createApp({
    analyze: async () => ({ url: "https://example.com/", findings: [] }),
    rateLimit: { max: 1, windowMs: 60_000 }
  });
  const from = (ip) => post(app).set("x-forwarded-for", ip);

  assert.equal((await from("203.0.113.1")).status, 200);
  assert.equal((await from("203.0.113.1")).status, 429);
  assert.equal((await from("203.0.113.2")).status, 200);
});

test("no tempo esgotado diz em que etapa a análise parou", async () => {
  const app = createApp({
    timeoutMs: 30,
    abortGraceMs: 10,
    analyze: (_url, { onPhase }) => {
      onPhase("carregando a página");
      return new Promise(() => {});
    }
  });
  const res = await post(app);
  assert.equal(res.status, 504);
  assert.match(res.body.error, /tempo máximo de 0 s \(etapa: carregando a página\)/);
});
