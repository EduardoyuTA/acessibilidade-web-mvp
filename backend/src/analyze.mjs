import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { validatePublicUrl } from "./url-safety.mjs";

const impactNames = {
  critical: "Crítico",
  serious: "Sério",
  moderate: "Moderado",
  minor: "Leve",
  null: "Não definido"
};

const SKIPPED_RESOURCE_TYPES = new Set([
  "image",
  "media",
  "font",
  "websocket",
  "manifest",
  "other"
]);

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 AcessoClaro-MVP/0.1";

let sharedBrowserPromise = null;

async function getBrowser() {
  if (sharedBrowserPromise) {
    try {
      const existing = await sharedBrowserPromise;
      if (existing && existing.isConnected()) return existing;
    } catch {
      sharedBrowserPromise = null;
    }
  }

  sharedBrowserPromise = chromium.launch({
    headless: true,
    args: [
      "--disable-dev-shm-usage",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-gpu"
    ]
  });

  return sharedBrowserPromise;
}

function summarize(violation) {
  const first = violation.nodes[0];
  return {
    title: violation.help,
    impact: impactNames[violation.impact ?? "null"],
    rule: `${violation.id} · ${violation.tags.filter((tag) => tag.startsWith("wcag")).join(", ") || "axe-core"}`,
    element: first?.html?.slice(0, 500) || "Elemento não informado",
    evidence:
      first?.failureSummary?.replace(/^Fix (any|all) of the following:\s*/i, "") ||
      violation.description,
    fix: `Consulte a orientação da regra ${violation.id}: ${violation.helpUrl}`,
    helpUrl: violation.helpUrl,
    occurrences: violation.nodes.length
  };
}

export async function analyzePage(rawUrl) {
  const target = await validatePublicUrl(rawUrl);
  const browser = await getBrowser();
  let context;

  try {
    context = await browser.newContext({
      acceptDownloads: false,
      serviceWorkers: "block",
      ignoreHTTPSErrors: true,
      userAgent: DEFAULT_USER_AGENT,
      viewport: { width: 1280, height: 800 }
    });
    const page = await context.newPage();
    const checkedHosts = new Map();

    await page.route("**/*", async (route) => {
      const req = route.request();
      if (SKIPPED_RESOURCE_TYPES.has(req.resourceType())) {
        return route.abort();
      }

      const requestUrl = req.url();
      if (/^(about:|data:|blob:)/.test(requestUrl)) return route.continue();

      try {
        const candidate = new URL(requestUrl);
        const key = `${candidate.protocol}//${candidate.host}`;
        if (!checkedHosts.has(key)) {
          checkedHosts.set(key, validatePublicUrl(candidate.href));
        }
        await checkedHosts.get(key);
        await route.continue();
      } catch {
        await route.abort("blockedbyclient");
      }
    });

    let response = null;
    try {
      response = await page.goto(target.href, {
        waitUntil: "domcontentloaded",
        timeout: 28_000
      });
    } catch (navError) {
      const hasPartialDom = await page
        .evaluate(
          () => Boolean(document.body && document.body.innerHTML.trim().length > 0)
        )
        .catch(() => false);

      if (!hasPartialDom) {
        throw new Error(
          "O site demorou demais para responder ou bloqueou a conexão da análise."
        );
      }
    }

    if (response && !response.ok() && response.status() >= 400) {
      throw new Error(
        `A página respondeu com o status HTTP ${response.status()}.`
      );
    }

    const currentUrl = page.url();
    const finalUrl =
      currentUrl && currentUrl !== "about:blank"
        ? await validatePublicUrl(currentUrl)
        : target;

    const results = await new AxeBuilder({ page }).analyze();

    return {
      url: finalUrl.href,
      analyzedAt: new Date().toISOString(),
      engine: `axe-core ${results.testEngine.version}`,
      findings: results.violations.map(summarize),
      passes: results.passes.length,
      incomplete: results.incomplete.length,
      disclaimer:
        "A automação cobre apenas parte dos critérios. A inspeção manual continua obrigatória."
    };
  } finally {
    await context?.close().catch(() => {});
  }
}
