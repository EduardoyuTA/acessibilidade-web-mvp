import assert from "node:assert/strict";
import test from "node:test";
import { isPublicAddress, validatePublicUrl } from "../src/url-safety.mjs";

test("aceita endereços IP públicos", () => {
  assert.equal(isPublicAddress("8.8.8.8"), true);
  assert.equal(isPublicAddress("2606:4700:4700::1111"), true);
});

test("bloqueia redes locais, reservadas e metadados", () => {
  for (const address of ["127.0.0.1", "10.0.0.1", "169.254.169.254", "192.168.1.2", "::1", "fc00::1"]) {
    assert.equal(isPublicAddress(address), false, address);
  }
});

test("valida protocolo, credenciais, porta e DNS", async () => {
  const publicLookup = async () => [{ address: "93.184.216.34", family: 4 }];
  await assert.rejects(() => validatePublicUrl("file:///etc/passwd", publicLookup), /HTTP\/HTTPS/);
  await assert.rejects(() => validatePublicUrl("https://user:pass@example.com", publicLookup), /credenciais/);
  await assert.rejects(() => validatePublicUrl("https://example.com:8080", publicLookup), /portas/);
  const result = await validatePublicUrl("https://example.com/pagina#trecho", publicLookup);
  assert.equal(result.href, "https://example.com/pagina");
});

test("bloqueia quando qualquer resolução DNS é privada", async () => {
  const mixedLookup = async () => [
    { address: "93.184.216.34", family: 4 },
    { address: "127.0.0.1", family: 4 }
  ];
  await assert.rejects(() => validatePublicUrl("https://example.com", mixedLookup), /privada|reservada/);
});
