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
