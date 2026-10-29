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
