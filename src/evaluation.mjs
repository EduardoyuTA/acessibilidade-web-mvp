export const STORAGE_KEY = "tcc-prototipo-v1";

export const QUESTIONS = [
  "Todos os controles podem ser usados somente pelo teclado?",
  "O foco permanece visível durante a navegação?",
  "A ordem de navegação acompanha o conteúdo?",
  "As alternativas textuais descrevem adequadamente as imagens?",
  "As instruções dos formulários são compreensíveis?",
  "O conteúdo permanece utilizável com ampliação de 200%?"
];

export const SIMULATED_FINDINGS = [
  {
    title: "Imagem sem texto alternativo",
    impact: "Crítico",
    rule: "image-alt · WCAG 2.2 / 1.1.1",
    element: '<img src="banner.jpg">',
    evidence: "A imagem não possui alternativa textual.",
    fix: 'Descreva a informação da imagem no atributo alt. Para imagem apenas decorativa, use alt="".'
  },
  {
    title: "Campo de formulário sem rótulo",
    impact: "Sério",
    rule: "label · WCAG 2.2 / 1.3.1 e 4.1.2",
    element: '<input id="email">',
    evidence: "O campo não possui rótulo associado.",
    fix: 'Adicione um rótulo visível: <label for="email">E-mail</label>.'
  },
  {
    title: "Contraste insuficiente no texto",
    impact: "Sério",
    rule: "color-contrast · WCAG 2.2 / 1.4.3",
    element: '<p class="descricao">',
    evidence: "Contraste fictício de 2,8:1 no texto comum.",
    fix: "Ajuste as cores para atingir pelo menos 4,5:1 para texto comum."
  }
];

const PRIVATE_HOST_REGEX =
  /^(0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;

const PRIVATE_IPV6_REGEX =
  /^(::1?|fe[89ab][0-9a-f]:|f[cd][0-9a-f]{2}:|::ffff:(0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.))/i;

export function isLocalOrPrivateHost(hostname) {
  const clean = String(hostname || "")
    .replace(/^\[|\]$/g, "")
    .toLowerCase();

  if (!clean) return true;
  if (
    clean === "localhost" ||
    clean === "localhost.localdomain" ||
    clean.endsWith(".local") ||
    clean.endsWith(".internal")
  ) {
    return true;
  }

  if (PRIVATE_HOST_REGEX.test(clean) || PRIVATE_IPV6_REGEX.test(clean)) {
    return true;
  }

  // Hostnames without a dot (and not IPv6 with colons) are internal/local names
  if (!clean.includes(".") && !clean.includes(":")) {
    return true;
  }

  return false;
}

export function validateTargetUrl(rawUrl) {
  if (typeof rawUrl !== "string" || !rawUrl.trim()) {
    return {
      ok: false,
      error: "Informe uma URL completa HTTP/HTTPS, sem credenciais."
    };
  }

  const trimmed = rawUrl.trim();
  if (trimmed.length > 2048) {
    return {
      ok: false,
      error: "Informe uma URL válida com até 2.048 caracteres."
    };
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
    if (
      !["http:", "https:"].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password
    ) {
      throw new Error("Invalid protocol or credentials");
    }
  } catch {
    return {
      ok: false,
      error: "Informe uma URL completa HTTP/HTTPS, sem credenciais."
    };
  }

  if (parsed.port && !["80", "443"].includes(parsed.port)) {
    return {
      ok: false,
      error: "Apenas as portas públicas padrão 80 e 443 são aceitas."
    };
  }

  if (isLocalOrPrivateHost(parsed.hostname)) {
    return {
      ok: false,
      error: "Endereços locais não são aceitos. Informe uma página pública."
    };
  }

  parsed.hash = "";
  return { ok: true, href: parsed.href };
}

export function loadStoredRecords(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(STORAGE_KEY) || "[]";
    const parsed = JSON.parse(raw);
    if (
      !Array.isArray(parsed) ||
      parsed.some(
        (r) =>
          !r ||
          typeof r.id !== "string" ||
          typeof r.url !== "string" ||
          typeof r.answers !== "object" ||
          r.answers === null
      )
    ) {
      throw new Error("Invalid records format");
    }
    return { records: parsed, notice: "" };
  } catch {
    return {
      records: [],
      notice: "Não foi possível recuperar o histórico local."
    };
  }
}

export function persistRecords(records, storage = globalThis.localStorage) {
  try {
    if (!storage) throw new Error("Storage unavailable");
    storage.setItem(STORAGE_KEY, JSON.stringify(records));
    return { saved: true, notice: "" };
  } catch {
    return {
      saved: false,
      notice:
        "Não foi possível salvar no navegador. Mantenha esta página aberta para conservar os dados da sessão."
    };
  }
}

export async function requestAnalysis(
  apiBaseUrl,
  targetUrl,
  fetchImpl = globalThis.fetch
) {
  const cleanBase = String(apiBaseUrl || "").replace(/\/$/, "");
  const response = await fetchImpl(`${cleanBase}/api/analyze`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url: targetUrl })
  });

  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  if (!response.ok) {
    throw new Error(
      payload?.error || "Não foi possível concluir a análise."
    );
  }

  return {
    url: payload?.url || targetUrl,
    findings: Array.isArray(payload?.findings) ? payload.findings : [],
    engine: payload?.engine
  };
}

export function resolveEvaluationState(active) {
  if (!active) {
    return {
      incomplete: false,
      data: [],
      count: 0,
      pending: QUESTIONS.length,
      reason: "",
      availableFilters: ["Todos", "Crítico", "Sério"]
    };
  }

  const incomplete = ["timeout", "blocked", "error"].includes(active.scenario);
  const data =
    active.source === "real"
      ? active.findings || []
      : active.scenario === "findings"
        ? SIMULATED_FINDINGS
        : [];
  const count = Object.values(active.answers || {}).filter(
    (a) => a && a.value && a.value !== "Não verificado"
  ).length;
  const pending = QUESTIONS.length - count;
  const reason =
    active.failureReason ||
    (active.scenario === "blocked"
      ? "Redirecionamento para endereço bloqueado (simulação)."
      : "Limite de tempo atingido (simulação).");

  const baseFilters = ["Todos", "Crítico", "Sério"];
  const extraFilters = ["Moderado", "Leve", "Não definido"].filter((impact) =>
    data.some((f) => f.impact === impact)
  );

  return {
    incomplete,
    data,
    count,
    pending,
    reason,
    availableFilters: [...baseFilters, ...extraFilters]
  };
}
