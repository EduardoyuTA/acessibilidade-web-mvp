// Teste com navegador real (exige `npx playwright install chromium`).
// Executar com: npm run test:browser
import assert from "node:assert/strict";
import http from "node:http";
import test, { after, before } from "node:test";
import { chromium } from "playwright";
import { startEgressProxy } from "../src/egress-proxy.mjs";
import { createRequestGuard } from "../src/request-guard.mjs";
import { resolvePublicHost } from "../src/url-safety.mjs";

// Um único servidor local. Acessado como "publico.test" ele faz o papel de site
// público; acessado como 127.0.0.1 (ou localhost) ele é a "rede interna".
let server;
let port;
let proxy;
let browser;
let PUBLIC;
let INTERNAL;

before(async () => {
  server = http.createServer((req, res) => {
    const host = req.headers.host?.split(":")[0];
    if (req.url === "/secret") {
      res.writeHead(200, { "content-type": "text/html", "access-control-allow-origin": "*" });
      return res.end(`<html><body>SEGREDO-INTERNO via ${host}</body></html>`);
    }
    const routes = {
      "/start": () => res.writeHead(302, { location: "/middle" }).end(),
      "/middle": () => res.writeHead(301, { location: "/final" }).end(),
      "/final": () =>
        res.writeHead(200, { "content-type": "text/html" }).end("<html><body>PAGINA-FINAL</body></html>"),
      // Dois saltos públicos antes de apontar para a rede interna.
      "/evil": () => res.writeHead(302, { location: "/evil-2" }).end(),
      "/evil-2": () => res.writeHead(302, { location: `${INTERNAL}/secret` }).end(),
      "/evil-localhost": () => res.writeHead(302, { location: `http://localhost:${port}/secret` }).end(),
      "/fetcher": () =>
        res.writeHead(200, { "content-type": "text/html" }).end(
          `<html><body><div id="out">aguardando</div><script>
            fetch("/evil-2").then(r => r.text()).then(t => out.textContent = t)
              .catch(() => out.textContent = "BLOQUEADO");
          </script></body></html>`
        )
    };
    (routes[req.url] ?? (() => res.writeHead(404).end()))();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = server.address().port;
  PUBLIC = `http://publico.test:${port}`;
  INTERNAL = `http://127.0.0.1:${port}`;

  proxy = await startEgressProxy({
    resolveHost: (hostname) =>
      hostname === "publico.test" ? "127.0.0.1" : resolvePublicHost(hostname),
    allowedPorts: { http: String(port), connect: "443" }
  });
  browser = await chromium.launch({ proxy: { server: proxy.server } });
});

after(async () => {
  await browser?.close();
  await proxy?.close();
  server?.close();
});

const validate = async (href) => {
  if (new URL(href).hostname !== "publico.test") throw new Error("rede privada");
  return new URL(href);
};

async function open(path) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.route("**/*", createRequestGuard({ validate }));
  let error = null;
  await page.goto(PUBLIC + path, { waitUntil: "load" }).catch((e) => (error = e));
  const html = await page.content().catch(() => "");
  return { page, context, error, html };
}

test("segue cadeia de redirecionamentos públicos", async () => {
  const { page, context, error, html } = await open("/start");
  assert.equal(error, null);
  assert.equal(page.url(), `${PUBLIC}/final`);
  assert.match(html, /PAGINA-FINAL/);
  await context.close();
});

test("bloqueia redirecionamento em segundo salto para IP interno", async () => {
  const { context, html } = await open("/evil");
  assert.doesNotMatch(html, /SEGREDO-INTERNO/);
  await context.close();
});

test("bloqueia redirecionamento para localhost", async () => {
  const { context, html } = await open("/evil-localhost");
  assert.doesNotMatch(html, /SEGREDO-INTERNO/);
  await context.close();
});

test("bloqueia fetch da página redirecionado para IP interno", async () => {
  const { page, context } = await open("/fetcher");
  await page.waitForFunction(() => document.querySelector("#out").textContent !== "aguardando");
  assert.equal(await page.textContent("#out"), "BLOQUEADO");
  await context.close();
});

test("controle: sem o proxy, o ataque funcionaria", async () => {
  const unprotected = await chromium.launch();
  const page = await unprotected.newPage();
  await page.goto(`${INTERNAL}/start`).catch(() => {});
  // Simula o segundo salto chegando à rede interna sem proxy.
  await page.goto(`${INTERNAL}/secret`);
  assert.match(await page.content(), /SEGREDO-INTERNO/);
  await unprotected.close();
});
