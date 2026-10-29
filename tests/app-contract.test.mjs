import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  QUESTIONS,
  STORAGE_KEY,
  computeAccessibilityMetrics,
  loadStoredRecords,
  localizeFailureReason,
  localizeFinding,
  persistRecords,
  requestAnalysis,
  resolveEvaluationState,
  validateTargetUrl
} from "../src/evaluation.mjs";

const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const css = await readFile(new URL("../src/improvements.css", import.meta.url), "utf8");

test("uses the AcessoClaro identity in the document and interface", () => {
  assert.match(html, /<title>AcessoClaro \| MVP de acessibilidade web<\/title>/);
  assert.match(html, /<link rel="icon" type="image\/svg\+xml" href="\/favicon\.svg"\s*\/>/);
  assert.match(app, />AcessoClaro<\/a>/);
  assert.doesNotMatch(app, />Acessibilidade Web<\/a>/);
});

test("keeps structural labels and live status announcements", () => {
  assert.match(app, /aria-label="Navegação principal"/);
  assert.match(app, /aria-label="Etapas da avaliação"/);
  assert.match(app, /aria-live="polite"/);
  assert.match(app, /aria-busy="true"/);
});

test("keeps touch targets and mobile navigation rules", () => {
  assert.match(css, /min-height:\s*44px/);
  assert.match(css, /@media \(max-width: 650px\)/);
  assert.match(css, /grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
});

test("CT01: validates public HTTP/HTTPS URLs and blocks invalid or private targets", () => {
  assert.equal(validateTargetUrl("").ok, false);
  assert.equal(validateTargetUrl("   ").ok, false);
  assert.equal(validateTargetUrl("ftp://example.com").ok, false);
  assert.equal(validateTargetUrl("https://user:pass@example.com").ok, false);

  const portResult = validateTargetUrl("https://example.com:8080/pagina");
  assert.equal(portResult.ok, false);
  assert.match(portResult.error, /portas públicas/i);

  for (const blocked of [
    "http://localhost:80",
    "http://127.0.0.1/teste",
    "http://0.0.0.0",
    "http://10.0.0.1",
    "http://192.168.1.10",
    "http://172.16.0.5",
    "http://169.254.169.254/latest/meta-data",
    "http://[::1]/",
    "http://servidor.local/painel",
    "http://intranet/portal"
  ]) {
    const res = validateTargetUrl(blocked);
    assert.equal(res.ok, false, `Expected ${blocked} to be rejected`);
    assert.match(res.error, /Endereços locais/i);
  }

  const valid = validateTargetUrl("  https://example.com/acessibilidade#topo  ");
  assert.equal(valid.ok, true);
  assert.equal(valid.href, "https://example.com/acessibilidade");
});

test("CT02, CT06 & CT07: resolves findings, empty scenario, and interruptions accurately", () => {
  const withFindings = resolveEvaluationState({
    id: "1",
    url: "https://example.com/",
    date: "2026-10-29T12:00:00.000Z",
    scenario: "findings",
    source: "simulation",
    answers: {}
  });
  assert.equal(withFindings.incomplete, false);
  assert.equal(withFindings.data.length, 3);
  assert.deepEqual(withFindings.availableFilters, ["Todos", "Crítico", "Sério"]);

  const emptyScenario = resolveEvaluationState({
    id: "2",
    url: "https://example.com/",
    date: "2026-10-29T12:00:00.000Z",
    scenario: "empty",
    source: "simulation",
    answers: {}
  });
  assert.equal(emptyScenario.incomplete, false);
  assert.equal(emptyScenario.data.length, 0);

  const timeoutScenario = resolveEvaluationState({
    id: "3",
    url: "https://example.com/",
    date: "2026-10-29T12:00:00.000Z",
    scenario: "timeout",
    source: "simulation",
    answers: {}
  });
  assert.equal(timeoutScenario.incomplete, true);
  assert.equal(timeoutScenario.data.length, 0);
  assert.match(timeoutScenario.reason, /Limite de tempo/i);

  const blockedScenario = resolveEvaluationState({
    id: "4",
    url: "https://example.com/",
    date: "2026-10-29T12:00:00.000Z",
    scenario: "blocked",
    source: "simulation",
    answers: {}
  });
  assert.equal(blockedScenario.incomplete, true);
  assert.match(blockedScenario.reason, /Redirecionamento/i);

  const realWithModerate = resolveEvaluationState({
    id: "5",
    url: "https://example.com/",
    date: "2026-10-29T12:00:00.000Z",
    scenario: "findings",
    source: "real",
    findings: [
      {
        title: "Região principal ausente",
        impact: "Moderado",
        rule: "landmark-one-main · wcag2a",
        element: "<html>",
        evidence: "Document does not have a main landmark",
        fix: "https://dequeuniversity.com/rules/axe/4.14/landmark-one-main",
        occurrences: 2
      }
    ],
    answers: {}
  });
  assert.equal(realWithModerate.data.length, 1);
  assert.deepEqual(realWithModerate.availableFilters, [
    "Todos",
    "Crítico",
    "Sério",
    "Moderado"
  ]);
});

test("CT03 & CT05: tracks checklist progress and pending items for partial evaluations", () => {
  const state = resolveEvaluationState({
    id: "1",
    url: "https://example.com/",
    date: "2026-10-29T12:00:00.000Z",
    scenario: "findings",
    answers: {
      0: { value: "Atende", note: "Teclado funciona em todos os links" },
      1: { value: "Não atende", note: "Sem outline no menu" },
      2: { value: "Não verificado", note: "A revisar" }
    }
  });
  assert.equal(state.count, 2);
  assert.equal(state.pending, QUESTIONS.length - 2);
});

test("CT04 & CT09: loads and persists records and preserves warning on storage failure", () => {
  const store = new Map();
  const mockStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, val) => store.set(key, val)
  };

  const sample = [
    {
      id: "abc",
      url: "https://example.com/",
      date: "2026-10-29T12:00:00.000Z",
      scenario: "findings",
      answers: { 0: { value: "Atende", note: "OK" } }
    }
  ];

  const saved = persistRecords(sample, mockStorage);
  assert.equal(saved.saved, true);
  assert.equal(saved.notice, "");

  const loaded = loadStoredRecords(mockStorage);
  assert.deepEqual(loaded.records, sample);
  assert.equal(loaded.notice, "");

  // Corrupted storage
  store.set(STORAGE_KEY, "{invalid-json");
  const corrupted = loadStoredRecords(mockStorage);
  assert.deepEqual(corrupted.records, []);
  assert.match(corrupted.notice, /Não foi possível recuperar o histórico local/);

  // Storage throwing QuotaExceededError (CT09)
  const failingStorage = {
    getItem: () => {
      throw new Error("SecurityError");
    },
    setItem: () => {
      throw new Error("QuotaExceededError");
    }
  };
  const failedSave = persistRecords(sample, failingStorage);
  assert.equal(failedSave.saved, false);
  assert.match(failedSave.notice, /Não foi possível salvar no navegador/);

  // Regression check: go("results") must precede save(...) in start() so notice is not cleared
  assert.doesNotMatch(app, /save\(\[[^\]]+\]\);\s*go\(["']results["']\)/);
  assert.match(app, /go\(["']results["']\);\s*save\(\[/);
});

test("handles real API analysis responses using standard Fetch Response.ok boolean", async () => {
  assert.doesNotMatch(app, /response\.ok\(\)/);

  const okResponse = new Response(
    JSON.stringify({
      url: "https://example.com/",
      engine: "axe-core 4.14.0",
      findings: [{ title: "Teste", impact: "Sério", rule: "r1", element: "<p>", evidence: "e", fix: "f" }]
    }),
    { status: 200, headers: { "content-type": "application/json" } }
  );

  const controller = new AbortController();
  const result = await requestAnalysis(
    "https://api.example.test/",
    "https://example.com/",
    async (_url, init) => {
      assert.equal(init.signal, controller.signal);
      return okResponse;
    },
    { signal: controller.signal }
  );
  assert.equal(result.url, "https://example.com/");
  assert.equal(result.engine, "axe-core 4.14.0");
  assert.equal(result.findings.length, 1);

  const errorResponse = new Response(
    JSON.stringify({ error: "O analisador está ocupado. Tente novamente em instantes." }),
    { status: 429, headers: { "content-type": "application/json" } }
  );

  await assert.rejects(
    () =>
      requestAnalysis(
        "https://api.example.test",
        "https://example.com/",
        async () => errorResponse
      ),
    /analisador está ocupado/
  );
});

test("computes accessibility percentage chart metrics from automatic and manual criteria", () => {
  // Before manual review, the provisional index reflects only the automatic analysis.
  const initial = computeAccessibilityMetrics({
    id: "m1",
    url: "https://example.com/",
    date: "2026-10-29T12:00:00.000Z",
    scenario: "findings",
    source: "simulation",
    answers: {}
  });
  assert.equal(initial.autoScore, 56);
  assert.equal(initial.manualScore, 0);
  assert.equal(initial.overallScore, 56);
  assert.equal(initial.manualCoverage, 0);
  assert.equal(initial.manualScoreAvailable, false);
  assert.equal(initial.manualComplete, false);
  assert.equal(initial.isProvisional, true);

  // A partial checklist reports coverage without lowering or inflating the provisional index.
  const partial = computeAccessibilityMetrics({
    id: "m-partial",
    url: "https://example.com/",
    date: "2026-10-29T12:00:00.000Z",
    scenario: "findings",
    source: "simulation",
    answers: { 0: { value: "Atende", note: "" } }
  });
  assert.equal(partial.manualScore, 100);
  assert.equal(partial.manualCoverage, 17);
  assert.equal(partial.overallScore, 56);
  assert.equal(partial.isProvisional, true);

  // Empty automatic findings + all 6 manual criteria marked 'Atende' (auto: 100%, manual: 100%, overall: 100%)
  const full = computeAccessibilityMetrics({
    id: "m2",
    url: "https://example.com/",
    date: "2026-10-29T12:00:00.000Z",
    scenario: "empty",
    source: "simulation",
    answers: {
      0: { value: "Atende", note: "" },
      1: { value: "Atende", note: "" },
      2: { value: "Atende", note: "" },
      3: { value: "Atende", note: "" },
      4: { value: "Atende", note: "" },
      5: { value: "Não se aplica", note: "" }
    }
  });
  assert.equal(full.autoScore, 100);
  assert.equal(full.manualScore, 100);
  assert.equal(full.overallScore, 100);
  assert.equal(full.manualCoverage, 100);
  assert.equal(full.manualComplete, true);
  assert.equal(full.isProvisional, false);
  assert.equal(full.tone, "success");

  // Verify the report SVG gauge and interactive controls exist in App.tsx
  assert.match(app, /aria-label="Gráfico de porcentagem de acessibilidade"/);
  assert.match(app, /className="score-gauge"/);
});

test("translates English axe-core findings and Playwright errors into pt-BR", () => {
  const translated = localizeFinding({
    title: "Document should have one main landmark",
    impact: "Moderado",
    rule: "landmark-one-main · wcag2a",
    element: "<html>",
    evidence: "Document does not have a main landmark",
    fix: "Consulte a orientação da regra landmark-one-main: https://dequeuniversity.com/rules/axe/4.14/landmark-one-main",
    helpUrl: "https://dequeuniversity.com/rules/axe/4.14/landmark-one-main"
  });

  assert.match(translated.title, /região principal/i);
  assert.match(translated.evidence, /não contém uma região principal/i);
  assert.match(translated.rule, /WCAG 2\.0 Nível A/);

  const translatedTwice = localizeFinding({
    ...translated,
    rule: `${translated.rule} · Boas práticas (Boas práticas (axe-core))`
  });
  assert.doesNotMatch(translatedTwice.rule, /Boas práticas \(Boas práticas/);

  const allNotApplicable = computeAccessibilityMetrics({
    id: "m-na",
    url: "https://example.com/",
    date: "2026-10-29T12:00:00.000Z",
    scenario: "empty",
    source: "simulation",
    answers: Object.fromEntries(
      QUESTIONS.map((_, index) => [index, { value: "Não se aplica", note: "" }])
    )
  });
  assert.equal(allNotApplicable.manualComplete, true);
  assert.equal(allNotApplicable.manualScoreAvailable, false);
  assert.equal(allNotApplicable.overallScore, 100);

  const timeoutReason = localizeFailureReason(
    'page.goto: Timeout 20000ms exceeded. Call log: - navigating to "https://careiro.am.gov.br/"'
  );
  assert.match(timeoutReason, /Tempo limite excedido ao aguardar o carregamento/);
});


