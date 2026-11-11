import React, { useState, useEffect, useRef } from "react";
import {
  CHECKLIST,
  checklistFor,
  computeAccessibilityMetrics,
  loadStoredRecords,
  parseRoute,
  persistRecords,
  requestAnalysis,
  resolveEvaluationState,
  routeFor,
  validateTargetUrl
} from "./evaluation.mjs";

import { BrandMark, Icon } from "./components/icons.tsx";
import {
  AffectedElements,
  FindingsGuide
} from "./components/FindingsGuide.tsx";
import { ManualInspection } from "./components/ManualInspection.tsx";
import { Welcome, shouldShowWelcomeOnOpen } from "./components/Welcome.tsx";
import type { Finding, RecordItem } from "./types.ts";

export type { Finding, RecordItem } from "./types.ts";

const NOTE_SAVE_DELAY = 600;

const metaEnv = (import.meta as { env?: { VITE_API_BASE_URL?: string } }).env;
const API_BASE_URL = (metaEnv?.VITE_API_BASE_URL || "").replace(/\/$/, "");

const PAGE_TITLES: Record<string, string> = {
  new: "Nova avaliação",
  loading: "Análise em andamento",
  results: "Resultado da avaliação",
  checklist: "Inspeção manual",
  report: "Relatório da avaliação",
  history: "Histórico de avaliações",
  help: "Ajuda e acessibilidade",
  welcome: "Boas-vindas"
};

/** Avisos de falha ficam até serem fechados; os demais somem sozinhos. */
function isErrorNotice(text: string) {
  return /^Não foi possível|não encontrada/i.test(text);
}

export function App() {
  const [page, setPage] = useState("new");
  const [url, setUrl] = useState("");
  const [scenario, setScenario] = useState("findings");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [active, setActive] = useState<RecordItem | null>(null);
  const [reportManualFilter, setReportManualFilter] = useState("Todos");
  const [chartView, setChartView] = useState<"overall" | "auto" | "manual">(
    "overall"
  );
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  const heading = useRef<HTMLHeadingElement>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const analysisController = useRef<AbortController | null>(null);
  // Valores mais recentes para os eventos do navegador (voltar/avançar).
  const recordsRef = useRef<RecordItem[]>(records);
  recordsRef.current = records;
  const pageRef = useRef(page);
  pageRef.current = page;
  // Salvamento adiado das observações digitadas no checklist.
  const pendingSave = useRef<{
    timer: ReturnType<typeof setTimeout>;
    records: RecordItem[];
  } | null>(null);

  function commitRecords(nextRecords: RecordItem[], successNotice = "") {
    const result = persistRecords(nextRecords);
    if (!result.saved) {
      setNotice(result.notice);
      return false;
    }
    if (successNotice) setNotice(successNotice);
    return true;
  }

  function flushPendingSave() {
    const pending = pendingSave.current;
    if (!pending) return;
    clearTimeout(pending.timer);
    pendingSave.current = null;
    commitRecords(pending.records);
  }

  function cancelPendingSave() {
    if (pendingSave.current) clearTimeout(pendingSave.current.timer);
    pendingSave.current = null;
  }

  function stopRunningAnalysis() {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
    analysisController.current?.abort();
    analysisController.current = null;
    setProgress(0);
  }

  function go(
    nextPage: string,
    record: RecordItem | null = active,
    { push = true }: { push?: boolean } = {}
  ) {
    flushPendingSave();
    if (record !== active) setActive(record);
    setPage(nextPage);
    setReportManualFilter("Todos");
    setError("");
    setNotice("");

    const hash = routeFor(nextPage, record?.id);
    if (push && hash && hash !== window.location.hash) {
      window.history.pushState(null, "", hash);
    }
  }

  function applyRoute(route: { page: string; id?: string }) {
    if (route.id) {
      const record = recordsRef.current.find((r) => r.id === route.id);
      if (!record) {
        go("new", null, { push: false });
        window.history.replaceState(null, "", "#/");
        setNotice("Avaliação não encontrada no histórico deste navegador.");
        return;
      }
      go(route.page, record, { push: false });
      return;
    }
    go(route.page, active, { push: false });
  }

  // Voltar/avançar do navegador.
  const onPopState = useRef<() => void>(() => {});
  onPopState.current = () => {
    const route = parseRoute(window.location.hash);
    if (!route) return; // ex.: "#main" do link "Ir para o conteúdo"
    if (pageRef.current === "loading") {
      stopRunningAnalysis();
      setActive(null);
    }
    applyRoute(route);
  };

  useEffect(() => {
    const initial = loadStoredRecords();
    setRecords(initial.records);
    recordsRef.current = initial.records;
    // Abre a tela indicada no endereço (recarregar ou link direto).
    const route = parseRoute(window.location.hash);
    const atRoot = ["", "#"].includes(window.location.hash);
    if (route && route.page !== "new") applyRoute(route);
    else if (atRoot && shouldShowWelcomeOnOpen()) {
      // Ao abrir o app na raiz, mostra as boas-vindas.
      go("welcome", null, { push: false });
      window.history.replaceState(null, "", "#/boas-vindas");
    }
    if (initial.notice) setNotice(initial.notice);

    const handlePop = () => onPopState.current();
    const handleHide = () => flushPendingSave();
    window.addEventListener("popstate", handlePop);
    window.addEventListener("pagehide", handleHide);
    return () => {
      window.removeEventListener("popstate", handlePop);
      window.removeEventListener("pagehide", handleHide);
      flushPendingSave();
      if (timer.current) clearInterval(timer.current);
      analysisController.current?.abort();
    };
  }, []);

  // Relógio da análise real: mostra que o trabalho continua em portais lentos.
  useEffect(() => {
    if (page !== "loading" || !API_BASE_URL) return;
    setElapsed(0);
    const startedAt = Date.now();
    const tick = setInterval(
      () => setElapsed(Math.round((Date.now() - startedAt) / 1000)),
      1000
    );
    return () => clearInterval(tick);
  }, [page]);

  useEffect(() => {
    if (!notice || isErrorNotice(notice)) return;
    const hide = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(hide);
  }, [notice]);

  useEffect(() => {
    heading.current?.focus();
    window.scrollTo(0, 0);
    document.title =
      page === "new"
        ? "AcessoClaro | MVP de acessibilidade web"
        : page === "welcome"
          ? "AcessoClaro | Boas-vindas à avaliação de acessibilidade"
          : `${PAGE_TITLES[page]} | AcessoClaro`;
  }, [page]);

  function save(nextRecords: RecordItem[], successNotice = "") {
    // Uma gravação completa substitui qualquer observação ainda pendente.
    cancelPendingSave();
    setRecords(nextRecords);
    return commitRecords(nextRecords, successNotice);
  }

  function start(e: React.FormEvent) {
    e.preventDefault();
    startEvaluation(url);
  }

  async function startEvaluation(rawUrl: string) {
    setError("");

    const validation = validateTargetUrl(rawUrl);
    if (!validation.ok || !validation.href) {
      setError(
        validation.error ||
          "Informe uma URL completa HTTP/HTTPS, sem credenciais."
      );
      return;
    }

    const item: RecordItem = {
      id: crypto.randomUUID(),
      url: validation.href,
      date: new Date().toISOString(),
      scenario,
      source: API_BASE_URL ? "real" : "simulation",
      checklistSize: CHECKLIST.length,
      answers: {}
    };

    setProgress(0);
    go("loading", item);
    const baseRecords = recordsRef.current;

    if (!API_BASE_URL) {
      let stepCount = 0;
      timer.current = setInterval(() => {
        stepCount += 1;
        setProgress(stepCount);
        if (stepCount === 3) {
          clearInterval(timer.current!);
          timer.current = null;
          go("results", item);
          save([item, ...baseRecords]);
        }
      }, 700);
      return;
    }

    try {
      const controller = new AbortController();
      analysisController.current = controller;
      setProgress(1);
      const payload = await requestAnalysis(
        API_BASE_URL,
        validation.href,
        globalThis.fetch,
        { signal: controller.signal }
      );
      setProgress(3);
      const completed: RecordItem = {
        ...item,
        url: payload.url || item.url,
        findings: payload.findings,
        needsReview: payload.needsReview,
        engine: payload.engine
      };
      go("results", completed);
      save([completed, ...baseRecords]);
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") {
        return;
      }
      const failed: RecordItem = {
        ...item,
        scenario: "error",
        failureReason:
          cause instanceof Error
            ? cause.message
            : "Não foi possível concluir a análise."
      };
      go("results", failed);
      save([failed, ...baseRecords]);
    } finally {
      analysisController.current = null;
    }
  }

  function cancelAnalysis() {
    stopRunningAnalysis();
    go("new", null);
    setNotice("Análise cancelada.");
  }

  function answer(
    index: number,
    value: string,
    note: string,
    { deferSave = false }: { deferSave?: boolean } = {}
  ) {
    if (!active) return;
    const updated: RecordItem = {
      ...active,
      answers: { ...active.answers, [index]: { value, note } }
    };
    const nextRecords = records.map((r) => (r.id === updated.id ? updated : r));
    setActive(updated);

    if (!deferSave) {
      // A resposta marcada já aparece na tela; aviso só se a gravação falhar.
      save(nextRecords);
      return;
    }

    // Texto digitado: grava uma vez quando a pessoa para de digitar, em vez de
    // a cada tecla (e sem repetir o aviso para leitores de tela).
    setRecords(nextRecords);
    if (pendingSave.current) clearTimeout(pendingSave.current.timer);
    pendingSave.current = {
      records: nextRecords,
      timer: setTimeout(() => {
        pendingSave.current = null;
        commitRecords(nextRecords, "Observação salva neste navegador.");
      }, NOTE_SAVE_DELAY)
    };
  }

  function removeRecord(id: string) {
    const next = records.filter((r) => r.id !== id);
    if (active?.id === id) setActive(null);
    save(next, "Avaliação removida do histórico deste navegador.");
  }

  async function copyText(text: string, message: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(message);
    } catch {
      setNotice("Não foi possível copiar automaticamente neste navegador.");
    }
  }

  function toggleFix(ruleId: string) {
    if (!active) return;
    const current = active.fixPlan || [];
    const marking = !current.includes(ruleId);
    const updated: RecordItem = {
      ...active,
      fixPlan: marking
        ? [...current, ruleId]
        : current.filter((id) => id !== ruleId)
    };
    setActive(updated);
    save(
      records.map((r) => (r.id === updated.id ? updated : r)),
      marking
        ? "Marcado como corrigido no plano de correção."
        : "Removido do plano de correção."
    );
  }

  const { incomplete, data, review, count, pending, reason, availableFilters } =
    resolveEvaluationState(active);
  const metrics = computeAccessibilityMetrics(active);
  const checklist = checklistFor(active);


  const displayedChartScore =
    chartView === "auto"
      ? metrics.autoScore
      : chartView === "manual"
        ? metrics.manualScore
        : metrics.overallScore;

  const displayedChartLabel =
    chartView === "auto"
      ? "Análise automática"
      : chartView === "manual"
        ? "Inspeção manual"
        : metrics.isProvisional
          ? "Índice provisório"
          : "Índice geral";

  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const dashOffset =
    circumference - (displayedChartScore / 100) * circumference;

  const step =
    page === "new"
      ? 0
      : ["loading", "results"].includes(page)
        ? 1
        : page === "checklist"
          ? 2
          : page === "report"
            ? 3
            : -1;

  return (
    <>
      <a
        className="skip"
        href="#main"
        onClick={(e) => {
          // Move o foco sem trocar o endereço (que guarda a tela atual).
          e.preventDefault();
          document.getElementById("main")?.focus();
        }}
      >
        Ir para o conteúdo
      </a>
      <header className="topbar">
        <div className="topbar-inner">
          <a
            className="brand"
            href="#/boas-vindas"
            aria-label="AcessoClaro: página inicial"
            onClick={(e) => {
              e.preventDefault();
              if (page !== "loading") go("welcome");
            }}
          ><BrandMark />AcessoClaro</a>
          <nav aria-label="Navegação principal" className="main-nav">
            {[
              ["new", "Nova avaliação", "Nova"],
              ["history", "Histórico", "Histórico"],
              ["help", "Ajuda e acessibilidade", "Ajuda"]
            ].map(([p, label, short]) => (
              <button
                key={p}
                type="button"
                disabled={page === "loading"}
                aria-current={page === p ? "page" : undefined}
                onClick={() => go(p)}
              >
                <Icon name={p} size={22} />
                <span className="label-long">{label}</span>
                <span className="label-short" aria-hidden="true">
                  {short}
                </span>
              </button>
            ))}
          </nav>
          <span className={"mode-badge " + (API_BASE_URL ? "live" : "demo")}>
            <span className="mode-dot" aria-hidden="true" />
            <span className="label-long">
              {API_BASE_URL
                ? "MVP · análise automática real"
                : "Protótipo · dados simulados"}
            </span>
            <span className="label-short">
              {API_BASE_URL ? "Análise real" : "Simulado"}
            </span>
          </span>
        </div>
      </header>
      <div className="shell">
        <main id="main" tabIndex={-1}>
          {page !== "welcome" && (
          <nav
            className={"stepper" + (step < 0 ? " stepper-idle" : "")}
            aria-label="Etapas da avaliação"
          >
            <ol>
              {["URL", "Análise automática", "Inspeção manual", "Relatório"].map(
                (s, i) => (
                  <li key={s}>
                    <button
                      type="button"
                      disabled={page === "loading" || (i > 0 && !active)}
                      aria-current={step === i ? "step" : undefined}
                      className={step > i ? "done" : undefined}
                      onClick={() =>
                        go(["new", "results", "checklist", "report"][i])
                      }
                    >
                      <span className="number" aria-hidden="true">
                        {step > i ? <Icon name="check" size={16} /> : i + 1}
                      </span>
                      <span className="step-text">
                        <strong>{s}</strong>
                        <small>
                          {
                            [
                              "Informar página",
                              "Interpretar achados",
                              "Complementar análise",
                              "Reunir resultados"
                            ][i]
                          }
                        </small>
                      </span>
                    </button>
                  </li>
                )
              )}
            </ol>
          </nav>
          )}
          <div className="page" key={page}>
          {page === "welcome" ? (
            <Welcome
              headingRef={heading}
              historyCount={records.length}
              onQuickStart={(target) => {
                setUrl(target);
                startEvaluation(target);
              }}
              onGoNew={() => go("new")}
              onGoHistory={() => go("history")}
            />
          ) : (
            <>
              <div className="eyebrow">
                {step >= 0 ? `ETAPA ${step + 1} DE 4` : "ACESSOCLARO"}
              </div>
              <h1 ref={heading} tabIndex={-1}>
                {PAGE_TITLES[page]}
              </h1>
            </>
          )}

          {page === "new" && (
            <div className="columns">
              <section>
                <p className="lead">
                  Informe a URL de uma página pública para avaliar
                  automaticamente sua acessibilidade. Depois, complemente os
                  achados com uma inspeção manual.
                </p>
                <form onSubmit={start} noValidate>
                  <label htmlFor="url">URL da página</label>
                  <input
                    id="url"
                    type="url"
                    placeholder="https://exemplo.com.br"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    aria-invalid={!!error}
                    aria-describedby={error ? "hint error" : "hint"}
                  />
                  <small id="hint">
                    Somente páginas públicas HTTP ou HTTPS, sem autenticação.
                  </small>
                  <p id="error" className="error" role="alert">
                    {error}
                  </p>
                  {!API_BASE_URL && (
                    <>
                      <label htmlFor="scenario">Cenário de demonstração</label>
                      <select
                        id="scenario"
                        value={scenario}
                        onChange={(e) => setScenario(e.target.value)}
                      >
                        <option value="findings">Concluída com achados</option>
                        <option value="empty">
                          Concluída sem achados automáticos
                        </option>
                        <option value="timeout">
                          Interrupção por tempo limite
                        </option>
                        <option value="blocked">
                          Redirecionamento bloqueado
                        </option>
                      </select>
                    </>
                  )}
                  <button className="primary">
                    Iniciar avaliação
                    <Icon name="arrow" size={18} />
                  </button>
                </form>
                <section className="explain">
                  <h2>O que será observado</h2>
                  <p>
                    {API_BASE_URL
                      ? "Regras automatizadas do axe-core e revisão humana no mesmo percurso."
                      : "Exemplos automáticos e revisão humana no mesmo percurso."}
                  </p>
                  {[
                    [
                      "Estrutura e semântica",
                      "Títulos, identificação de elementos e organização do conteúdo."
                    ],
                    [
                      "Formulários e navegação",
                      "Rótulos e controles; revisão manual da experiência por teclado."
                    ],
                    [
                      "Imagens e conteúdo",
                      "Alternativas textuais e contraste, com interpretação do contexto."
                    ]
                  ].map(([title, desc], i) => (
                    <article key={title} className={"explain-card tone-" + i}>
                      <span className="explain-icon">
                        <Icon name={["structure", "forms", "image"][i]} size={22} />
                      </span>
                      <h3>{title}</h3>
                      <p>{desc}</p>
                    </article>
                  ))}
                </section>
              </section>
              <aside className="guidance">
                <h2>Antes de começar</h2>
                {[
                  [
                    "A página deve ser pública",
                    "Uma página por vez, sem autenticação."
                  ],
                  [
                    "Use HTTP ou HTTPS",
                    "Endereços locais, privados e portas alternativas serão bloqueados."
                  ],
                  [
                    "Acompanhe cada etapa",
                    API_BASE_URL
                      ? "O servidor poderá levar alguns segundos para abrir e verificar a página."
                      : "Nesta demonstração, o processamento leva poucos segundos."
                  ]
                ].map(([title, desc], i) => (
                  <div className="tip" key={title}>
                    <span>{i + 1}</span>
                    <div>
                      <h3>{title}</h3>
                      <p>{desc}</p>
                    </div>
                  </div>
                ))}
                <p className="callout">
                  A automação não substitui a inspeção manual.
                </p>
              </aside>
            </div>
          )}

          {page === "loading" && (
            <section aria-busy="true" aria-label="Processamento da avaliação">
              <p className="lead">
                {API_BASE_URL ? "Avaliando" : "Preparando demonstração para"}{" "}
                {active?.url}
              </p>
              {API_BASE_URL ? (
                <div
                  className="progress-indeterminate"
                  role="progressbar"
                  aria-label="Análise em andamento"
                >
                  <span />
                </div>
              ) : (
                <progress
                  value={progress}
                  max="3"
                  aria-label="Etapas concluídas"
                />
              )}
              <p role="status" aria-live="polite">
                {API_BASE_URL
                  ? "Validando o destino, abrindo a página e executando o axe-core…"
                  : [
                      "Validando formato…",
                      "Simulando carregamento…",
                      "Preparando achados…",
                      "Concluído"
                    ][progress]}
              </p>
              {API_BASE_URL && (
                <p className="elapsed">
                  <strong>
                    {elapsed} s
                  </strong>{" "}
                  decorridos.{" "}
                  {elapsed < 20
                    ? "Páginas simples levam alguns segundos."
                    : "Portais grandes podem levar até 1 minuto e meio — a análise continua."}
                </p>
              )}
              <p>
                {API_BASE_URL
                  ? "A página é processada somente para produzir esta avaliação."
                  : "Nenhuma varredura real está em execução."}
              </p>
              <button
                type="button"
                className="secondary"
                onClick={cancelAnalysis}
              >
                Cancelar análise
              </button>
            </section>
          )}

          {active && ["results", "checklist", "report"].includes(page) && (
            <div className="evaluation">
              <div>
                <strong>{active.url}</strong>
                <small>
                  {new Date(active.date).toLocaleString("pt-BR")} ·{" "}
                  {active.source === "real"
                    ? active.engine || "Análise automática real"
                    : "Dados simulados"}
                </small>
              </div>
              <div className="evaluation-badges">
                <span className={"badge " + metrics.tone}>
                  {metrics.overallScore}%{" "}
                  {metrics.isProvisional
                    ? "índice automático provisório"
                    : "acessibilidade estimada"}
                </span>
                <span
                  className={
                    "badge " +
                    (incomplete || !metrics.manualComplete
                      ? "warning"
                      : "success")
                  }
                >
                  {incomplete
                    ? "Automática incompleta"
                    : metrics.manualComplete
                      ? "Concluída"
                      : "Automática concluída · manual pendente"}
                </span>
              </div>
            </div>
          )}

          {page === "results" && active && (
            <div className="columns">
              <section>
                {incomplete ? (
                  <div className="empty">
                    <h2>A avaliação foi interrompida</h2>
                    <p>{reason}</p>
                    <p>Nenhum achado foi produzido nesta execução.</p>
                    <button className="primary" onClick={() => go("new")}>
                      Iniciar outra avaliação
                    </button>
                  </div>
                ) : (
                  <FindingsGuide
                    findings={data}
                    review={review}
                    availableFilters={availableFilters}
                    source={active.source}
                    fixPlan={active.fixPlan || []}
                    onToggleFix={toggleFix}
                    onCopy={copyText}
                  />
                )}
              </section>
              <aside>
                <section className="guidance">
                  <h2>Inspeção manual</h2>
                  <p>
                    Complete os {checklist.length} critérios humanos para
                    consolidar o gráfico de acessibilidade no relatório.
                  </p>
                  <strong>
                    {`${count} de ${checklist.length} ${count === 1 ? "item revisado" : "itens revisados"}`}
                    {metrics.manualScoreAvailable
                      ? ` (${metrics.manualScore}% de conformidade entre os itens aplicáveis revisados)`
                      : " (conformidade ainda não calculada)"}
                  </strong>
                  <progress
                    value={count}
                    max={checklist.length}
                    aria-label={`${count} de ${checklist.length} itens revisados`}
                  />
                  <button
                    className="primary"
                    onClick={() => go("checklist")}
                  >
                    Abrir checklist
                  </button>
                </section>
                <section className="report-box">
                  <h2>Relatório e gráfico (%)</h2>
                  <p>
                    {metrics.isProvisional ? (
                      <>
                        Índice automático provisório:{" "}
                        <strong>{metrics.overallScore}%</strong>. A inspeção
                        manual está {metrics.manualCoverage}% preenchida.
                      </>
                    ) : (
                      <>
                        Índice consolidado:{" "}
                        <strong>{metrics.overallScore}%</strong> (Automática:{" "}
                        {metrics.autoScore}% · Manual: {metrics.manualScore}%).
                      </>
                    )}
                  </p>
                  <button className="secondary" onClick={() => go("report")}>
                    Visualizar relatório
                  </button>
                  <p className="callout">
                    O resultado não representa certificação integral de
                    acessibilidade.
                  </p>
                </section>
              </aside>
            </div>
          )}

          {page === "checklist" && active && (
            <ManualInspection
              checklist={checklist}
              answers={active.answers}
              metrics={metrics}
              url={active.url}
              onAnswer={answer}
              onGoReport={() => go("report")}
            />
          )}

          {page === "history" && (
            <section>
              <p className="lead">Avaliações salvas somente neste navegador.</p>
              {records.length ? (
                records.map((r) => {
                  const rowMetrics = computeAccessibilityMetrics(r);
                  return (
                    <article className="history-row" key={r.id}>
                      <div>
                        <h2>{r.url}</h2>
                        <small>
                          {new Date(r.date).toLocaleString("pt-BR")} ·{" "}
                          {["timeout", "blocked", "error"].includes(r.scenario)
                            ? "Automática incompleta"
                            : rowMetrics.manualComplete
                              ? "Concluída"
                              : "Automática concluída · manual pendente"}{" "}
                          · {r.source === "real" ? "Real" : "Simulada"} ·{" "}
                          {rowMetrics.isProvisional
                            ? "Índice automático provisório"
                            : "Índice"}
                          :{" "}
                          <strong>{rowMetrics.overallScore}%</strong>
                        </small>
                      </div>
                      <div className="history-actions">
                        <button
                          className="secondary"
                          onClick={() => go("results", r)}
                        >
                          Abrir avaliação
                        </button>
                        <button
                          className="secondary"
                          onClick={() => go("report", r)}
                        >
                          Ver relatório ({rowMetrics.overallScore}%)
                        </button>
                        <button
                          className="secondary danger-btn"
                          aria-label={`Remover avaliação de ${r.url}`}
                          onClick={() => removeRecord(r.id)}
                        >
                          Remover
                        </button>
                      </div>
                    </article>
                  );
                })
              ) : (
                <div className="empty">
                  <h2>Seu histórico começa aqui</h2>
                  <p>
                    Inicie uma avaliação para salvar seus primeiros resultados.
                  </p>
                  <button className="primary" onClick={() => go("new")}>
                    Nova avaliação
                  </button>
                </div>
              )}
            </section>
          )}

          {page === "report" && active && (
            <section className="report">
              <p className="callout">
                {active.source === "real"
                  ? metrics.manualComplete
                    ? "Relatório automático complementado por inspeção humana."
                    : "Relatório automático com inspeção humana ainda em andamento."
                  : "Dados simulados para demonstração acadêmica."}{" "}
                Este relatório não representa certificação integral de
                acessibilidade.
              </p>
              <div className="print-actions">
                <button className="primary" onClick={() => window.print()}>
                  <Icon name="print" size={18} />
                  Imprimir / salvar PDF
                </button>
                <button
                  className="secondary"
                  onClick={() => go("checklist")}
                >
                  Editar inspeção manual
                </button>
              </div>

              <section
                className="score-dashboard"
                aria-label="Gráfico de porcentagem de acessibilidade"
              >
                <div className="score-header">
                  <div>
                    <h2>Índice de acessibilidade da avaliação</h2>
                    <p>
                      {metrics.isProvisional
                        ? "Enquanto o checklist não for concluído, o índice provisório reflete somente a análise automática."
                        : "Índice consolidado pela verificação automática (50%) e pelos critérios da inspeção manual (50%)."}{" "}
                      Alterne as visões abaixo para explorar cada dimensão.
                    </p>
                  </div>
                  <span className={"badge " + metrics.tone}>
                    {metrics.level}
                  </span>
                </div>

                <div
                  className="filters chart-tabs"
                  role="group"
                  aria-label="Alternar visão do gráfico de acessibilidade"
                >
                  {[
                    [
                      "overall",
                      `${metrics.isProvisional ? "Índice provisório" : "Índice geral"} (${metrics.overallScore}%)`
                    ],
                    ["auto", `Análise automática (${metrics.autoScore}%)`],
                    ["manual", `Inspeção manual (${metrics.manualScore}%)`]
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={chartView === key}
                      onClick={() =>
                        setChartView(key as "overall" | "auto" | "manual")
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="score-grid">
                  <div className="gauge-card">
                    <svg
                      className="score-gauge"
                      viewBox="0 0 160 160"
                      role="img"
                      aria-label={`Gráfico circular: ${displayedChartLabel} em ${displayedChartScore}% de acessibilidade`}
                    >
                      <circle
                        className="gauge-track"
                        cx="80"
                        cy="80"
                        r={radius}
                        fill="none"
                        strokeWidth="14"
                      />
                      <circle
                        className={"gauge-fill " + metrics.tone}
                        style={
                          { "--circumference": circumference } as React.CSSProperties
                        }
                        cx="80"
                        cy="80"
                        r={radius}
                        fill="none"
                        strokeWidth="14"
                        strokeDasharray={circumference}
                        strokeDashoffset={dashOffset}
                        strokeLinecap="round"
                        transform="rotate(-90 80 80)"
                      />
                      <text
                        x="80"
                        y="76"
                        textAnchor="middle"
                        className="gauge-value"
                      >
                        {displayedChartScore}%
                      </text>
                      <text
                        x="80"
                        y="100"
                        textAnchor="middle"
                        className="gauge-caption"
                      >
                        {displayedChartLabel}
                      </text>
                    </svg>
                    <small className="gauge-footnote">
                      {`Cobertura manual: ${metrics.manualCoverage}% (${metrics.reviewedManual}/${metrics.totalManual} ${metrics.totalManual === 1 ? "item" : "itens"})`}
                    </small>
                  </div>

                  <div className="score-bars">
                    <div className="metric-row">
                      <div className="metric-label">
                        <strong>Saúde da análise automática</strong>
                        <span>
                          {incomplete
                            ? "Incompleta (0%)"
                            : `${metrics.autoScore}% (${metrics.totalFindings} achado(s))`}
                        </span>
                      </div>
                      <div
                        className="bar-track"
                        role="progressbar"
                        aria-valuenow={metrics.autoScore}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label="Porcentagem da análise automática"
                      >
                        <div
                          className="bar-fill auto"
                          style={{ width: `${metrics.autoScore}%` }}
                        />
                      </div>
                    </div>

                    <div className="metric-row">
                      <div className="metric-label">
                        <strong>Conformidade na inspeção manual</strong>
                        <span>
                          {metrics.manualScoreAvailable
                            ? `${metrics.manualScore}% (${metrics.passedManual} atende · ${metrics.failedManual} não atende)`
                            : "Ainda não calculada (nenhum item aplicável revisado)"}
                        </span>
                      </div>
                      <div
                        className="bar-track"
                        role="progressbar"
                        aria-valuenow={metrics.manualScore}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label="Porcentagem de conformidade na inspeção manual"
                      >
                        <div
                          className="bar-fill manual"
                          style={{ width: `${metrics.manualScore}%` }}
                        />
                      </div>
                    </div>

                    <div className="metric-row">
                      <div className="metric-label">
                        <strong>Progresso de preenchimento do checklist</strong>
                        <span>
                          {`${metrics.manualCoverage}% (${metrics.reviewedManual} de ${metrics.totalManual} ${metrics.reviewedManual === 1 ? "verificado" : "verificados"})`}
                        </span>
                      </div>
                      <div
                        className="bar-track"
                        role="progressbar"
                        aria-valuenow={metrics.manualCoverage}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label="Progresso de preenchimento do checklist"
                      >
                        <div
                          className="bar-fill coverage"
                          style={{ width: `${metrics.manualCoverage}%` }}
                        />
                      </div>
                    </div>

                    <div className="distribution-pills">
                      <span className="badge success">
                        Atende: {metrics.passedManual}
                      </span>
                      <span className="badge danger">
                        Não atende: {metrics.failedManual}
                      </span>
                      <span className="badge neutral">
                        Não se aplica: {metrics.notApplicableManual}
                      </span>
                      <span className="badge warning">
                        Pendentes: {metrics.pendingManual}
                      </span>
                    </div>
                  </div>
                </div>
              </section>

              {incomplete && (
                <p className="error">Motivo da interrupção: {reason}</p>
              )}
              <h2>Resultados automáticos</h2>
              {data.length ? (
                data.map((f: Finding, i: number) => (
                  <article key={`${f.rule}-${i}`}>
                    <h3>
                      {f.title} · {f.impact}
                    </h3>
                    <p>
                      <strong>Regra:</strong> {f.rule}
                    </p>
                    <dl className="report-elements">
                      <AffectedElements finding={f} />
                    </dl>
                    <p>
                      <strong>Evidência:</strong> {f.evidence}
                    </p>
                    <p>
                      <strong>Orientação:</strong> {f.fix}
                    </p>
                  </article>
                ))
              ) : (
                <p>
                  {incomplete
                    ? "Análise incompleta; sem resultados disponíveis."
                    : "Nenhum achado automático foi identificado; revisão humana necessária."}
                </p>
              )}
              {review.length > 0 && (
                <>
                  <h2>Pontos para conferência manual</h2>
                  <p>
                    O axe-core não conseguiu decidir automaticamente estes
                    pontos; eles não entram no índice.
                  </p>
                  <ul className="review-list">
                    {review.map((f: Finding, i: number) => (
                      <li key={`report-review-${f.rule}-${i}`}>
                        <strong>{f.title}</strong> · {f.rule}
                        {typeof f.occurrences === "number" && f.occurrences > 1
                          ? ` · ${f.occurrences} elementos`
                          : ""}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <div className="report-manual-header">
                <div>
                  <h2>Inspeção manual</h2>
                  <p>
                    {`${count} ${count === 1 ? "item revisado" : "itens revisados"}; ${pending} ${pending === 1 ? "não verificado" : "não verificados"}.`} Você
                    também pode atualizar o status de cada item diretamente
                    abaixo para recalcular o gráfico em tempo real.
                  </p>
                </div>
                <div
                  className="filters no-print"
                  role="group"
                  aria-label="Filtrar itens da inspeção manual no relatório"
                >
                  {["Todos", "Atende", "Não atende", "Não verificado"].map(
                    (statusFilter) => (
                      <button
                        key={statusFilter}
                        type="button"
                        aria-pressed={reportManualFilter === statusFilter}
                        onClick={() => setReportManualFilter(statusFilter)}
                      >
                        {statusFilter}
                      </button>
                    )
                  )}
                </div>
              </div>
              {checklist.map(({ question: q, criterion }, i) => {
                const currentStatus =
                  active.answers[i]?.value || "Não verificado";
                const hiddenOnScreen =
                  reportManualFilter !== "Todos" &&
                  currentStatus !== reportManualFilter;
                return (
                  <article
                    key={q}
                    className={hiddenOnScreen ? "screen-hidden" : ""}
                  >
                    <div className="report-question-row">
                      <h3>
                        {i + 1}. {q}
                        <small className="report-criterion">{criterion}</small>
                      </h3>
                      <span
                        className={
                          "badge " +
                          (currentStatus === "Atende"
                            ? "success"
                            : currentStatus === "Não atende"
                              ? "danger"
                              : currentStatus === "Não se aplica"
                                ? "neutral"
                                : "warning")
                        }
                      >
                        {currentStatus}
                      </span>
                    </div>
                    {active.answers[i]?.note && (
                      <p>Observação: {active.answers[i].note}</p>
                    )}
                    <div
                      className="quick-status no-print"
                      role="group"
                      aria-label={`Atualizar resposta para: ${q}`}
                    >
                      {[
                        "Atende",
                        "Não atende",
                        "Não se aplica",
                        "Não verificado"
                      ].map((option) => (
                        <button
                          key={option}
                          type="button"
                          className="quick-pill"
                          aria-pressed={currentStatus === option}
                          onClick={() =>
                            answer(i, option, active.answers[i]?.note || "")
                          }
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </article>
                );
              })}
              <h2>Limitações</h2>
              <p>
                {active.source === "real"
                  ? "A análise automática cobre apenas regras detectáveis pelo axe-core e representa a página no momento da execução."
                  : "Esta demonstração não acessou a URL informada; os achados são fictícios."}{" "}
                A revisão manual contém apenas informações registradas pelo
                usuário.
              </p>
            </section>
          )}

          {page === "help" && (
            <section className="help">
              <p className="lead">Entenda o percurso e os limites do MVP.</p>
              {[
                [
                  "Como iniciar?",
                  API_BASE_URL
                    ? "Informe uma URL pública completa e inicie a avaliação."
                    : "Informe uma URL completa, escolha o cenário de demonstração e inicie a avaliação."
                ],
                [
                  "O que é um achado?",
                  "Um problema identificado na avaliação, acompanhado de impacto, regra, evidência e orientação de correção. O modo da avaliação aparece junto da data."
                ],
                [
                  "Como funciona o gráfico de % de acessibilidade?",
                  "No Relatório, o gráfico combina 50% da pontuação automática e 50% da inspeção manual (proporção de critérios aplicáveis marcados como Atende). A pontuação automática parte de 100% e desconta cada regra violada conforme a gravidade (Crítico 20, Sério 12, Moderado 7, Leve 4 pontos); regras que falham em muitos elementos pesam mais, até o dobro. Pontos que o axe-core não conseguiu decidir aparecem para conferência manual e não entram no cálculo. É um indicador orientativo da avaliação, não uma certificação."
                ],
                [
                  "Como usar o teclado?",
                  "Tab e Shift+Tab percorrem controles. Enter ativa botões e detalhes. Espaço e setas permitem responder ao checklist. O link Ir para o conteúdo aparece ao receber foco."
                ],
                [
                  "Onde os dados ficam salvos?",
                  "Somente neste navegador. Não há conta nem sincronização entre dispositivos."
                ],
                [
                  "Como gerar o PDF?",
                  "Abra Relatório, selecione Imprimir / salvar PDF e escolha o destino Salvar como PDF na janela de impressão."
                ],
                [
                  "A avaliação certifica a página?",
                  "Não. O axe-core detecta apenas parte dos problemas. A inspeção manual e o julgamento humano continuam necessários."
                ]
              ].map(([q, a]) => (
                <details key={q}>
                  <summary>{q}</summary>
                  <p>{a}</p>
                </details>
              ))}
            </section>
          )}
          </div>
          <footer className="site-footer">
            <p>
              Da URL ao relatório: automação e julgamento humano no mesmo
              percurso.
            </p>
            <small>Projeto acadêmico · 2026</small>
          </footer>
        </main>
      </div>
      <div className="toast-region" role="status" aria-live="polite">
        {notice && (
          <div
            className={"toast" + (isErrorNotice(notice) ? " toast-error" : "")}
          >
            <Icon name={isErrorNotice(notice) ? "info" : "check"} size={18} />
            <span>{notice}</span>
            <button
              type="button"
              className="toast-close"
              aria-label="Fechar aviso"
              onClick={() => setNotice("")}
            >
              <Icon name="close" size={16} />
            </button>
          </div>
        )}
      </div>
    </>
  );
}
