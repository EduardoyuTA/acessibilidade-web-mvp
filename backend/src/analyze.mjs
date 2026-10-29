import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import axe from "axe-core";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { validatePublicUrl } from "./url-safety.mjs";

const require = createRequire(import.meta.url);
const rawPtLocale = JSON.parse(
  readFileSync(require.resolve("axe-core/locales/pt_BR.json"), "utf8")
);

const EXTRA_PT_RULES = {
  "aria-braille-equivalent": {
    help: "Atributos ARIA em braille devem possuir equivalente textual",
    description:
      "Certifique-se de que aria-braillelabel e aria-brailleroledescription tenham um nome acessível equivalente."
  },
  "aria-conditional-attr": {
    help: "Atributos ARIA devem seguir as regras condicionais da função do elemento",
    description:
      "Certifique-se de que atributos ARIA condicionais sejam usados conforme a especificação da função do elemento."
  },
  "aria-deprecated-role": {
    help: "Funções ARIA descontinuadas não devem ser utilizadas",
    description:
      "Certifique-se de que elementos não utilizem valores de role descontinuados."
  },
  "aria-prohibited-attr": {
    help: "Elementos não devem usar atributos ARIA proibidos para sua função",
    description:
      "Certifique-se de que atributos ARIA proibidos para a função de um elemento não sejam utilizados."
  },
  "aria-tab-name": {
    help: "Abas ARIA (role='tab') devem ter um nome acessível",
    description:
      "Certifique-se de que cada elemento com role='tab' possua um nome acessível."
  },
  "meta-refresh-no-exceptions": {
    help: "Redirecionamento ou atualização automática via <meta http-equiv='refresh'> não deve ser usado",
    description:
      "Certifique-se de que a página não recarregue nem redirecione automaticamente por meta refresh."
  },
  "summary-name": {
    help: "Elementos <summary> devem possuir texto discernível",
    description:
      "Certifique-se de que elementos <summary> tenham texto visível ou nome acessível."
  },
  "target-size": {
    help: "Alvos de toque e clique devem ter tamanho e espaçamento suficientes",
    description:
      "Certifique-se de que controles interativos tenham dimensões mínimas adequadas (pelo menos 24x24 px) ou espaçamento suficiente."
  }
};

const ptLocale = {
  ...rawPtLocale,
  rules: {
    ...rawPtLocale.rules,
    ...EXTRA_PT_RULES
  },
  incompleteFallbackMessage:
    "Verifique manualmente se o elemento atende aos requisitos desta regra."
};

const AXE_PT_SOURCE = `${axe.source}\n;window.axe.configure({ locale: ${JSON.stringify(ptLocale)} });`;

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

function cleanPortugueseText(text) {
  if (!text) return "";
  return String(text)
    .replace(/\{+~it:value\}[\s\S]*$/g, "")
    .replace(/^Fix (any|all) of the following:\s*/gim, "")
    .replace(/^Corrija (qualquer um dos|todos os) itens a seguir:\s*/gim, "")
    .replace(/role="none" or role="presentation"/g, 'role="none" ou role="presentation"')
    .replace(/no náximo/g, "no máximo")
    .replace(/'acesskey'/g, "'accesskey'")
    .trim();
}

function summarize(violation) {
  const first = violation.nodes[0];
  const checkMessages = [
    ...(first?.any || []),
    ...(first?.all || []),
    ...(first?.none || [])
  ]
    .map((c) => cleanPortugueseText(c?.message))
    .filter(Boolean);

  const rawSummary = cleanPortugueseText(first?.failureSummary);
  const evidence =
    rawSummary ||
    checkMessages.join("; ") ||
    cleanPortugueseText(violation.description);

  const description = cleanPortugueseText(violation.description);

  return {
    title: cleanPortugueseText(violation.help) || violation.id,
    impact: impactNames[violation.impact ?? "null"],
    rule: `${violation.id} · ${violation.tags.filter((tag) => tag.startsWith("wcag")).join(", ") || "axe-core"}`,
    element: first?.html?.slice(0, 500) || "Elemento não informado",
    evidence,
    fix: description
      ? `${description}. Documentação da regra (${violation.id}): ${violation.helpUrl}`
      : `Consulte a orientação da regra ${violation.id}: ${violation.helpUrl}`,
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
      locale: "pt-BR",
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
    } catch {
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

    const results = await new AxeBuilder({
      page,
      axeSource: AXE_PT_SOURCE
    }).analyze();

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
