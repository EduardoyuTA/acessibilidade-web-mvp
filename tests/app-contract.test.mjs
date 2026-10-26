import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const css = await readFile(new URL("../src/improvements.css", import.meta.url), "utf8");

test("uses the AcessoClaro identity in the document and interface", () => {
  assert.match(html, /<title>AcessoClaro \| MVP de acessibilidade web<\/title>/);
  assert.match(app, />AcessoClaro<\/a>/);
  assert.doesNotMatch(app, />Acessibilidade Web<\/a>/);
});

test("keeps structural labels and live status announcements", () => {
  assert.match(app, /aria-label="Navegação principal"/);
  assert.match(app, /aria-label="Etapas da avaliação"/);
  assert.match(app, /aria-live="polite"/);
  assert.match(app, /aria-busy="true"/);
});

test("keeps touch targets and mobile navigation rules", () => {
  assert.match(css, /min-height:\s*44px/);
  assert.match(css, /@media \(max-width: 650px\)/);
  assert.match(css, /grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
});
