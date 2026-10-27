import dns from "node:dns/promises";
import ipaddr from "ipaddr.js";

const BLOCKED_NAMES = new Set(["localhost", "localhost.localdomain"]);

export function isPublicAddress(value) {
  let address;
  try {
    address = ipaddr.parse(value);
  } catch {
    return false;
  }

  if (address.kind() === "ipv6" && address.isIPv4MappedAddress()) {
    address = address.toIPv4Address();
  }

  return address.range() === "unicast";
}

export async function validatePublicUrl(raw, lookup = dns.lookup) {
  if (typeof raw !== "string" || raw.length > 2048) {
    throw new Error("Informe uma URL válida com até 2.048 caracteres.");
  }

  let url;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error("Informe uma URL completa HTTP ou HTTPS.");
  }

  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new Error("Apenas URLs HTTP/HTTPS públicas e sem credenciais são aceitas.");
  }

  if (url.port && !["80", "443"].includes(url.port)) {
    throw new Error("Apenas as portas públicas padrão 80 e 443 são aceitas.");
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (BLOCKED_NAMES.has(hostname) || hostname.endsWith(".local")) {
    throw new Error("Endereços locais ou internos não são aceitos.");
  }

  const addresses = ipaddr.isValid(hostname)
    ? [{ address: hostname }]
    : await lookup(hostname, { all: true, verbatim: true });

  if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) {
    throw new Error("O endereço informado aponta para uma rede privada ou reservada.");
  }

  url.hash = "";
  return url;
}
