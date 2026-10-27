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

function summarize(violation) {
  const first = violation.nodes[0];
  return {
    title: violation.help,
    impact: impactNames[violation.impact ?? "null"],
    rule: `${violation.id} · ${violation.tags.filter((tag) => tag.startsWith("wcag")).join(", ") || "axe-core"}`,
    element: first?.html?.slice(0, 500) || "Elemento não informado",
    evidence: first?.failureSummary?.replace(/^Fix (any|all) of the following:\s*/i, "") || violation.description,
    fix: `Consulte a orientação da regra ${violation.id}: ${violation.helpUrl}`,
    helpUrl: violation.helpUrl,
    occurrences: violation.nodes.length
  };
}

export async function analyzePage(rawUrl) {
  const target = await validatePublicUrl(rawUrl);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    acceptDownloads: false,
    serviceWorkers: "block",
    userAgent: "AcessoClaro-MVP/0.1 (avaliação acadêmica de acessibilidade)"
  });
  const page = await context.newPage();
  const checkedHosts = new Map();

  await page.route("**/*", async (route) => {
    const requestUrl = route.request().url();
    if (/^(about:|data:|blob:)/.test(requestUrl)) return route.continue();

    try {
      const candidate = new URL(requestUrl);
      const key = `${candidate.protocol}//${candidate.host}`;
      if (!checkedHosts.has(key)) checkedHosts.set(key, validatePublicUrl(candidate.href));
      await checkedHosts.get(key);
      await route.continue();
    } catch {
      await route.abort("blockedbyclient");
    }
  });

  try {
    const response = await page.goto(target.href, {
      waitUntil: "domcontentloaded",
      timeout: 20_000
    });

    if (!response) throw new Error("A página não retornou uma resposta HTTP.");
    if (!response.ok()) throw new Error(`A página respondeu com o status HTTP ${response.status()}.`);

    const finalUrl = await validatePublicUrl(page.url());
    const results = await new AxeBuilder({ page }).analyze();

    return {
      url: finalUrl.href,
      analyzedAt: new Date().toISOString(),
      engine: `axe-core ${results.testEngine.version}`,
      findings: results.violations.map(summarize),
      passes: results.passes.length,
      incomplete: results.incomplete.length,
      disclaimer: "A automação cobre apenas parte dos critérios. A inspeção manual continua obrigatória."
    };
  } finally {
    await context.close();
    await browser.close();
  }
}
