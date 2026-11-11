import http from "node:http";
import net from "node:net";
import { resolvePublicHost } from "./url-safety.mjs";

const ALLOWED_PORTS = { http: "80", connect: "443" };
const SOCKET_TIMEOUT = 30_000;
const HOP_BY_HOP = [
  "proxy-connection",
  "proxy-authorization",
  "connection",
  "keep-alive",
  "upgrade",
  "te",
  "trailer",
  "transfer-encoding"
];

/**
 * Proxy de saída usado pelo navegador da análise.
 *
 * Toda conexão do Chromium (página, redirecionamentos em qualquer salto,
 * scripts, fetch) passa por aqui. O proxy resolve o DNS ele mesmo, recusa
 * IPs privados/reservados e conecta exatamente no IP validado — o que também
 * impede DNS rebinding entre a validação e a conexão.
 *
 * `resolveHost(hostname, port)` devolve o IP a usar ou lança erro.
 */
export function startEgressProxy({
  resolveHost = (hostname) => resolvePublicHost(hostname),
  allowedPorts = ALLOWED_PORTS
} = {}) {
  const server = http.createServer(async (clientReq, clientRes) => {
    let target;
    try {
      target = new URL(clientReq.url);
      if (target.protocol !== "http:") throw new Error("protocolo");
      const port = target.port || "80";
      if (port !== allowedPorts.http) throw new Error("porta");
      const ip = await resolveHost(target.hostname, port);

      const headers = { ...clientReq.headers };
      for (const name of HOP_BY_HOP) delete headers[name];
      headers.host = target.host;

      const upstream = http.request({
        host: ip,
        port,
        method: clientReq.method,
        path: target.pathname + target.search,
        headers,
        setHost: false,
        timeout: SOCKET_TIMEOUT
      });
      upstream.on("response", (upstreamRes) => {
        const responseHeaders = { ...upstreamRes.headers };
        for (const name of HOP_BY_HOP) delete responseHeaders[name];
        clientRes.writeHead(upstreamRes.statusCode ?? 502, responseHeaders);
        upstreamRes.pipe(clientRes);
      });
      upstream.on("timeout", () => upstream.destroy(new Error("tempo esgotado")));
      upstream.on("error", () => {
        if (!clientRes.headersSent) clientRes.writeHead(502);
        clientRes.end();
      });
      clientReq.pipe(upstream);
    } catch {
      clientRes.writeHead(403, { "content-type": "text/plain" });
      clientRes.end("Destino bloqueado.");
    }
  });

  server.on("connect", async (req, clientSocket, head) => {
    clientSocket.on("error", () => {});
    try {
      const { hostname, port } = new URL(`http://${req.url}`);
      if ((port || "80") !== allowedPorts.connect) throw new Error("porta");
      const ip = await resolveHost(hostname, port);

      const upstream = net.connect({ host: ip, port: Number(port) });
      upstream.setTimeout(SOCKET_TIMEOUT, () => upstream.destroy());
      upstream.on("connect", () => {
        clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
        if (head?.length) upstream.write(head);
        upstream.pipe(clientSocket);
        clientSocket.pipe(upstream);
      });
      upstream.on("error", () => clientSocket.destroy());
      clientSocket.on("close", () => upstream.destroy());
    } catch {
      clientSocket.end("HTTP/1.1 403 Forbidden\r\n\r\n");
    }
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({
        server: `http://127.0.0.1:${port}`,
        close: () => new Promise((done) => {
          server.close(() => done());
          server.closeAllConnections();
        })
      });
    });
  });
}
