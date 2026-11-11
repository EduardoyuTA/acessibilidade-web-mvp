import { validatePublicUrl } from "./url-safety.mjs";

export const SKIPPED_RESOURCE_TYPES = new Set([
  "image",
  "media",
  "font",
  "websocket",
  "manifest",
  "other"
]);

/**
 * Serviços de terceiros que não mudam a acessibilidade do conteúdo da página
 * (estatísticas, anúncios, widgets de redes sociais e folhas de fontes) e
 * podem somar dezenas de requisições lentas.
 */
const SKIPPED_HOSTS = [
  "google-analytics.com",
  "googletagmanager.com",
  "doubleclick.net",
  "googlesyndication.com",
  "facebook.net",
  "facebook.com",
  "fbcdn.net",
  "instagram.com",
  "cdninstagram.com",
  "hotjar.com",
  "clarity.ms",
  "cloudflareinsights.com",
  "platform.twitter.com",
  "tiktok.com",
  "fonts.googleapis.com",
  "fonts.gstatic.com"
];

export function isSkippedHost(hostname) {
  const host = String(hostname).toLowerCase();
  return SKIPPED_HOSTS.some((h) => host === h || host.endsWith("." + h));
}

/**
 * Interceptador de requisições da página analisada.
 *
 * Descarta recursos pesados e recusa cedo destinos que já sabemos ser
 * privados. Atenção: o Playwright não chama este interceptador para os saltos
 * de um redirecionamento, então ele NÃO é a proteção principal contra acesso a
 * redes internas — essa proteção fica no proxy de saída (egress-proxy.mjs).
 */
export function createRequestGuard({ validate = validatePublicUrl } = {}) {
  const checkedOrigins = new Map();

  return async function guard(route) {
    const request = route.request();
    if (SKIPPED_RESOURCE_TYPES.has(request.resourceType())) {
      return route.abort();
    }

    const requestUrl = request.url();
    if (/^(about:|data:|blob:)/.test(requestUrl)) return route.continue();

    // Conteúdo de iframes (vídeos, mapas, widgets) não é analisado; o próprio
    // <iframe> continua na página e a regra de título dele segue valendo.
    if (request.isNavigationRequest() && request.frame()?.parentFrame()) {
      return route.abort();
    }

    try {
      if (isSkippedHost(new URL(requestUrl).hostname)) return route.abort();
    } catch {
      return route.abort("blockedbyclient");
    }

    try {
      const key = new URL(requestUrl).origin;
      if (!checkedOrigins.has(key)) {
        checkedOrigins.set(key, validate(requestUrl));
      }
      await checkedOrigins.get(key);
    } catch {
      return route.abort("blockedbyclient");
    }
    return route.continue();
  };
}
