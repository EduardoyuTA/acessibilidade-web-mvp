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
    findings: Array.isArray(payload?.findings)
      ? payload.findings.map(localizeFinding)
      : [],
    engine: payload?.engine
  };
}

const RULE_TRANSLATIONS = {
  accesskeys: {
    title: "O valor do atributo 'accesskey' deve ser único",
    evidence: "O documento possui múltiplos elementos com o mesmo atributo 'accesskey'.",
    fix: "Garanta que cada atributo accesskey na página seja único."
  },
  "area-alt": {
    title: "Elementos <area> de mapas de imagem devem ter texto alternativo",
    evidence: "O elemento <area> ativo não possui texto alternativo.",
    fix: "Adicione o atributo alt descrevendo a função da área clicável."
  },
  "aria-allowed-attr": {
    title: "Elementos devem usar apenas atributos ARIA permitidos",
    evidence: "Um ou mais atributos ARIA não são permitidos para a função (role) deste elemento.",
    fix: "Remova o atributo ARIA incompatível ou ajuste o atributo role do elemento."
  },
  "aria-allowed-role": {
    title: "A função ARIA (role) deve ser apropriada para o elemento",
    evidence: "O valor do atributo role não é permitido para este elemento HTML.",
    fix: "Use um elemento HTML nativo adequado ou atribua um role compatível com a especificação WAI-ARIA."
  },
  "aria-command-name": {
    title: "Comandos ARIA devem ter um nome acessível",
    evidence: "O botão, link ou item de menu ARIA não possui nome acessível.",
    fix: "Adicione texto visível, aria-label ou aria-labelledby ao elemento."
  },
  "aria-hidden-body": {
    title: "O elemento <body> não deve possuir aria-hidden='true'",
    evidence: "O atributo aria-hidden='true' está presente no elemento <body>, ocultando toda a página de leitores de tela.",
    fix: "Remova aria-hidden='true' do elemento <body>."
  },
  "aria-hidden-focus": {
    title: "Elementos com aria-hidden não devem conter controles focalizáveis",
    evidence: "O elemento oculto para tecnologias assistivas contém elementos que ainda recebem foco do teclado.",
    fix: "Remova elementos focalizáveis de dentro de containers com aria-hidden='true' ou adicione tabindex='-1'."
  },
  "aria-input-field-name": {
    title: "Campos de entrada ARIA devem ter um nome acessível",
    evidence: "O controle de entrada ARIA não possui rótulo ou nome acessível.",
    fix: "Associe um rótulo com aria-labelledby ou defina aria-label."
  },
  "aria-prohibited-attr": {
    title: "Elementos não devem usar atributos ARIA proibidos para sua função",
    evidence: "O elemento utiliza um atributo ARIA que é proibido para sua semântica atual.",
    fix: "Remova o atributo ARIA proibido ou defina uma função (role) válida."
  },
  "aria-required-attr": {
    title: "Atributos ARIA obrigatórios devem ser informados",
    evidence: "O elemento com role ARIA não possui todos os atributos exigidos.",
    fix: "Adicione os atributos ARIA obrigatórios correspondentes ao role utilizado."
  },
  "aria-required-children": {
    title: "Certas funções ARIA devem conter elementos filhos específicos",
    evidence: "O elemento possui um role ARIA que exige elementos filhos específicos que não foram encontrados.",
    fix: "Garanta que os elementos filhos tenham as funções (roles) exigidas pela especificação WAI-ARIA."
  },
  "aria-required-parent": {
    title: "Certas funções ARIA devem estar contidas em elementos pais específicos",
    evidence: "O elemento com role ARIA não está dentro do elemento pai semântico exigido.",
    fix: "Envolva este elemento no container pai com a função ARIA apropriada."
  },
  "aria-roles": {
    title: "Atributos role ARIA devem possuir valores válidos",
    evidence: "O valor atribuído ao atributo role não é reconhecido pela especificação WAI-ARIA.",
    fix: "Corrija o nome do atributo role utilizando um valor válido da WAI-ARIA."
  },
  "button-name": {
    title: "Botões devem ter um texto ou nome discernível",
    evidence: "O botão não possui texto visível nem rótulo acessível para leitores de tela.",
    fix: "Adicione texto visível dentro do <button> ou defina um atributo aria-label descritivo."
  },
  "color-contrast": {
    title: "Os elementos devem ter contraste de cor suficiente",
    evidence: "O contraste entre a cor do texto e a cor de fundo está abaixo do mínimo recomendado pelas WCAG 2 AA.",
    fix: "Ajuste as cores de texto e fundo para atingir pelo menos 4,5:1 (texto normal) ou 3:1 (texto grande)."
  },
  "document-title": {
    title: "A página deve possuir um elemento <title> descritivo",
    evidence: "O documento HTML não contém um elemento <title> preenchido.",
    fix: "Adicione uma tag <title> clara e descritiva dentro do <head> da página."
  },
  "Duplicate-id": {
    title: "Os valores do atributo id devem ser únicos",
    evidence: "Há mais de um elemento compartilhando o mesmo atributo id na página.",
    fix: "Altere os atributos id repetidos para que cada elemento tenha um identificador exclusivo."
  },
  "empty-heading": {
    title: "Cabeçalhos (h1–h6) não devem estar vazios",
    evidence: "O elemento de cabeçalho não possui texto visível nem nome acessível.",
    fix: "Preencha o título com texto descritivo ou remova a tag de cabeçalho vazia."
  },
  "frame-title": {
    title: "Elementos <iframe> e <frame> devem ter um título acessível",
    evidence: "O quadro (iframe) não possui atributo title descrevendo seu conteúdo.",
    fix: "Adicione um atributo title descritivo ao elemento <iframe>."
  },
  "heading-order": {
    title: "A hierarquia dos títulos (h1–h6) deve seguir ordem sequencial",
    evidence: "A ordem dos níveis de cabeçalho pula níveis semânticos (ex.: de h1 direto para h3).",
    fix: "Organize os cabeçalhos de forma sequencial (h1, depois h2, depois h3) sem pular níveis."
  },
  "html-has-lang": {
    title: "O elemento <html> deve possuir o atributo 'lang'",
    evidence: "A tag <html> não informa o idioma principal da página.",
    fix: "Adicione o atributo de idioma na tag raiz, por exemplo: <html lang=\"pt-BR\">."
  },
  "image-alt": {
    title: "Imagens devem ter texto alternativo",
    evidence: "O elemento <img> não possui atributo alt nem alternativa textual para leitores de tela.",
    fix: "Adicione o atributo alt descrevendo a imagem, ou use alt=\"\" caso seja meramente decorativa."
  },
  label: {
    title: "Campos de formulário devem ter rótulos associados",
    evidence: "O controle de formulário não possui um <label> associado nem nome acessível.",
    fix: "Associe um elemento <label for=\"...\"> visível ou adicione aria-label / aria-labelledby."
  },
  "label-content-name-mismatch": {
    title: "Elementos devem incluir seu texto visível no nome acessível",
    evidence: "O texto visível do controle não corresponde ao seu atributo aria-label.",
    fix: "Garanta que o aria-label contenha o texto visível exibido no elemento."
  },
  "landmark-one-main": {
    title: "O documento deve possuir uma região principal (<main>)",
    evidence: "A página não contém uma região principal (<main> ou role=\"main\") para orientar a navegação.",
    fix: "Envolva o conteúdo principal da página em um elemento semântico <main>."
  },
  "link-in-text-block": {
    title: "Links no meio de blocos de texto devem ser distinguíveis sem depender apenas da cor",
    evidence: "O link dentro do parágrafo diferencia-se do texto ao redor apenas pela cor, com baixo contraste.",
    fix: "Mantenha sublinhado nos links ou garanta contraste mínimo de 3:1 em relação ao texto adjacente."
  },
  "link-name": {
    title: "Links devem possuir texto discernível",
    evidence: "O link está na ordem de navegação por teclado, mas não possui texto ou nome acessível.",
    fix: "Adicione texto descritivo dentro do link <a> ou forneça aria-label quando contiver apenas ícone/imagem."
  },
  list: {
    title: "Listas <ul> e <ol> devem conter diretamente apenas elementos <li>",
    evidence: "A lista contém elementos filhos diretos que não são itens <li> válidos.",
    fix: "Estruture listas utilizando apenas elementos <li> como filhos diretos de <ul> ou <ol>."
  },
  listitem: {
    title: "Itens de lista <li> devem estar dentro de <ul> ou <ol>",
    evidence: "O elemento <li> foi utilizado fora de um container de lista semântico.",
    fix: "Envolva os itens <li> em uma lista <ul>, <ol> ou container com role=\"list\"."
  },
  "meta-viewport": {
    title: "O zoom e o dimensionamento da página não devem ser desativados",
    evidence: "A tag <meta name=\"viewport\"> impede a ampliação da tela pelo usuário (user-scalable=no ou maximum-scale < 2).",
    fix: "Remova user-scalable=no e permita ampliação de pelo menos 200% no meta viewport."
  },
  "nested-interactive": {
    title: "Controles interativos não devem ser aninhados dentro de outros controles",
    evidence: "Existe um elemento clicável/focalizável dentro de outro (ex.: <button> dentro de <a>).",
    fix: "Separe os elementos interativos para que leitores de tela e navegação por teclado funcionem corretamente."
  },
  "page-has-heading-one": {
    title: "A página deve conter um título principal de primeiro nível (<h1>)",
    evidence: "A página não possui nenhum cabeçalho de primeiro nível (<h1>).",
    fix: "Adicione um elemento <h1> identificando o tema ou título principal da página."
  },
  region: {
    title: "Todo o conteúdo da página deve estar contido em regiões semânticas (landmarks)",
    evidence: "Há trechos de conteúdo na página fora de regiões semânticas (<header>, <nav>, <main>, <aside>, <footer>).",
    fix: "Organize as seções da página dentro de elementos semânticos HTML5 (<header>, <nav>, <main>, <footer>)."
  },
  "select-name": {
    title: "Caixas de seleção (<select>) devem ter um nome acessível",
    evidence: "O elemento <select> não possui rótulo <label> associado.",
    fix: "Associe um <label for=\"...\"> ao elemento <select> ou defina aria-label."
  },
  tabindex: {
    title: "Elementos não devem usar atributo 'tabindex' maior que zero",
    evidence: "O elemento define tabindex positivo (> 0), alterando de forma imprevisível a ordem de navegação por teclado.",
    fix: "Use apenas tabindex=\"0\" (para incluir na ordem natural) ou tabindex=\"-1\", mantendo a ordem lógica no HTML."
  },
  "target-size": {
    title: "Alvos de toque e clique devem ter tamanho e espaçamento suficientes",
    evidence: "O controle interativo possui área menor que o mínimo recomendado de 24x24 pixels.",
    fix: "Aumente o tamanho mínimo ou o espaçamento dos botões e links para facilitar o acionamento."
  }
};

function hasEnglishMarkers(text) {
  if (!text) return false;
  return /\b(Document|Page|Element|Elements|Ensure|Fix any|Fix all|should have|must have|does not have|contained by landmarks|level-one heading|discernible text|sufficient color contrast|expected contrast ratio|foreground color|background color)\b/i.test(
    text
  );
}

export function localizeFinding(finding) {
  if (!finding) return finding;
  const ruleId = String(finding.rule || "")
    .split("·")[0]
    .trim();
  const known = RULE_TRANSLATIONS[ruleId];

  let title = String(finding.title || "");
  let evidence = String(finding.evidence || "")
    .replace(/\{+~it:value\}[\s\S]*$/g, "")
    .replace(/^Fix (any|all) of the following:\s*/gim, "")
    .replace(/^Corrija (qualquer um dos|todos os) itens a seguir:\s*/gim, "")
    .replace(/role="none" or role="presentation"/g, 'role="none" ou role="presentation"')
    .replace(/no náximo/g, "no máximo")
    .trim();
  let fix = String(finding.fix || "");

  if (known && (!title || hasEnglishMarkers(title))) {
    title = known.title;
  }

  if (known && (!evidence || hasEnglishMarkers(evidence))) {
    evidence = known.evidence;
  }

  if (known && (!fix || hasEnglishMarkers(fix) || /^Consulte a orientação da regra/i.test(fix))) {
    fix = finding.helpUrl
      ? `${known.fix} Documentação (${ruleId}): ${finding.helpUrl}`
      : known.fix;
  }

  const rule = String(finding.rule || "")
    .replace(/\baxe-core\b/g, "Boas práticas (axe-core)")
    .replace(/\bwcag2a\b/g, "WCAG 2.0 Nível A")
    .replace(/\bwcag2aa\b/g, "WCAG 2.0 Nível AA")
    .replace(/\bwcag21a\b/g, "WCAG 2.1 Nível A")
    .replace(/\bwcag21aa\b/g, "WCAG 2.1 Nível AA")
    .replace(/\bwcag22aa\b/g, "WCAG 2.2 Nível AA");

  return {
    ...finding,
    title,
    evidence,
    fix,
    rule
  };
}

export function localizeFailureReason(reason) {
  if (!reason) return "";
  const text = String(reason);
  if (/Timeout \d+ms exceeded|page\.goto/i.test(text)) {
    return "Tempo limite excedido ao aguardar o carregamento da página informada. O servidor de destino demorou demais para responder.";
  }
  if (/Failed to fetch|NetworkError|fetch failed/i.test(text)) {
    return "Não foi possível conectar ao servidor de análise. Verifique sua conexão ou tente novamente em instantes.";
  }
  if (/net::ERR_NAME_NOT_RESOLVED/i.test(text)) {
    return "Não foi possível localizar o domínio informado. Verifique se o endereço está correto.";
  }
  if (/net::ERR_CONNECTION_REFUSED|net::ERR_CONNECTION_RESET/i.test(text)) {
    return "A página de destino recusou ou interrompeu a conexão durante a análise.";
  }
  return text;
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
      ? (active.findings || []).map(localizeFinding)
      : active.scenario === "findings"
        ? SIMULATED_FINDINGS
        : [];
  const count = Object.values(active.answers || {}).filter(
    (a) => a && a.value && a.value !== "Não verificado"
  ).length;
  const pending = QUESTIONS.length - count;
  const reason =
    localizeFailureReason(active.failureReason) ||
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

const IMPACT_WEIGHTS = {
  Crítico: 20,
  Sério: 12,
  Moderado: 7,
  Leve: 4,
  "Não definido": 5
};

export function computeAccessibilityMetrics(active) {
  const { incomplete, data, count, pending } = resolveEvaluationState(active);
  const answers = active?.answers || {};

  let passedManual = 0;
  let failedManual = 0;
  let notApplicableManual = 0;

  for (let i = 0; i < QUESTIONS.length; i += 1) {
    const val = answers[i]?.value || "Não verificado";
    if (val === "Atende") passedManual += 1;
    else if (val === "Não atende") failedManual += 1;
    else if (val === "Não se aplica") notApplicableManual += 1;
  }

  const applicableTotal = Math.max(0, QUESTIONS.length - notApplicableManual);
  const manualScore =
    applicableTotal === 0
      ? count > 0
        ? 100
        : 0
      : Math.round((passedManual / applicableTotal) * 100);

  const manualCoverage = Math.round((count / QUESTIONS.length) * 100);

  const severityCounts = {
    Crítico: 0,
    Sério: 0,
    Moderado: 0,
    Leve: 0
  };

  let penalty = 0;
  for (const finding of data) {
    if (finding.impact in severityCounts) {
      severityCounts[finding.impact] += 1;
    }
    penalty += IMPACT_WEIGHTS[finding.impact] ?? 5;
  }

  const autoScore = incomplete ? 0 : Math.max(0, Math.min(100, 100 - penalty));

  const overallScore = incomplete
    ? Math.round(manualScore * 0.5)
    : Math.round(autoScore * 0.5 + manualScore * 0.5);

  let level = "Requer atenção prioritária";
  let tone = "danger";
  if (incomplete) {
    level = "Avaliação automática incompleta";
    tone = "warning";
  } else if (overallScore >= 85 && pending === 0 && failedManual === 0) {
    level = "Alto índice nos critérios avaliados";
    tone = "success";
  } else if (overallScore >= 65) {
    level = "Conformidade parcial nos critérios";
    tone = "warning";
  }

  return {
    overallScore,
    autoScore,
    manualScore,
    manualCoverage,
    passedManual,
    failedManual,
    notApplicableManual,
    pendingManual: pending,
    reviewedManual: count,
    totalManual: QUESTIONS.length,
    totalFindings: data.length,
    severityCounts,
    level,
    tone
  };
}

