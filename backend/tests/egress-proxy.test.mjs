import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import test, { after, before } from "node:test";
import { startEgressProxy } from "../src/egress-proxy.mjs";
import { resolvePublicHost } from "../src/url-safety.mjs";

let origin;
let originPort;
let proxy;
let proxyPort;

before(async () => {
  origin = http.createServer((req, res) => {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end(`ok ${req.headers.host} ${req.url}`);
  });
  await new Promise((resolve) => origin.listen(0, "127.0.0.1", resolve));
  originPort = String(origin.address().port);

  // "publico.test" faz o papel de um site público; o resto usa a regra real.
  proxy = await startEgressProxy({
    resolveHost: (hostname) =>
      hostname === "publico.test" ? "127.0.0.1" : resolvePublicHost(hostname),
    allowedPorts: { http: originPort, connect: originPort }
  });
  proxyPort = Number(new URL(proxy.server).port);
});

after(async () => {
  await proxy.close();
  origin.close();
});

function viaProxy(target) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port: proxyPort, path: target, headers: { host: new URL(target).host } });
    req.on("response", (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => resolve({ status: res.statusCode, body }));
    });
    req.on("error", reject);
    req.end();
  });
}

function connectViaProxy(authority) {
  return new Promise((resolve, reject) => {
    const socket = net.connect(proxyPort, "127.0.0.1", () => {
      socket.write(`CONNECT ${authority} HTTP/1.1\r\nHost: ${authority}\r\n\r\n`);
    });
    socket.once("data", (chunk) => {
      resolve(chunk.toString().split("\r\n")[0]);
      socket.destroy();
    });
    socket.on("error", reject);
  });
}

test("encaminha HTTP para host público mantendo o Host original", async () => {
  const response = await viaProxy(`http://publico.test:${originPort}/pagina?x=1`);
  assert.equal(response.status, 200);
  assert.equal(response.body, `ok publico.test:${originPort} /pagina?x=1`);
});

test("bloqueia HTTP para IP de loopback, rede privada e metadados", async () => {
  for (const host of ["127.0.0.1", "10.0.0.1", "169.254.169.254", "localhost"]) {
    const response = await viaProxy(`http://${host}:${originPort}/`);
    assert.equal(response.status, 403, host);
  }
});

test("bloqueia portas fora da lista permitida", async () => {
  const response = await viaProxy("http://publico.test:8080/");
  assert.equal(response.status, 403);
  assert.match(await connectViaProxy("publico.test:22"), /403/);
});

test("abre túnel CONNECT só para host público", async () => {
  assert.match(await connectViaProxy(`publico.test:${originPort}`), /200/);
  assert.match(await connectViaProxy(`127.0.0.1:${originPort}`), /403/);
});
