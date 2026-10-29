import React, { useState, useEffect, useRef } from "react";
import {
  QUESTIONS,
  computeAccessibilityMetrics,
  loadStoredRecords,
  persistRecords,
  requestAnalysis,
  resolveEvaluationState,
  validateTargetUrl
} from "./evaluation.mjs";

export type Finding = {
  title: string;
  impact: string;
  rule: string;
  element: string;
  evidence: string;
  fix: string;
  helpUrl?: string;
  occurrences?: number;
};

export type RecordItem = {
  id: string;
  url: string;
  date: string;
  scenario: string;
  source?: "real" | "simulation";
  findings?: Finding[];
  engine?: string;
  failureReason?: string;
  answers: { [key: number]: { value: string; note: string } };
};

const metaEnv = (import.meta as { env?: { VITE_API_BASE_URL?: string } }).env;
const API_BASE_URL = (metaEnv?.VITE_API_BASE_URL || "").replace(/\/$/, "");

const PAGE_TITLES: Record<string, string> = {
  new: "Nova avaliação",
  loading: "Análise em andamento",
  results: "Resultado da avaliação",
  checklist: "Inspeção manual",
  report: "Relatório da avaliação",
  history: "Histórico de avaliações",
  help: "Ajuda e acessibilidade"
};

export function App() {
  const [page, setPage] = useState("new");
  const [url, setUrl] = useState("");
  const [scenario, setScenario] = useState("findings");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [active, setActive] = useState<RecordItem | null>(null);
  const [filter, setFilter] = useState("Todos");
  const [checklistFilter, setChecklistFilter] = useState("Todos");
  const [reportManualFilter, setReportManualFilter] = useState("Todos");
  const [chartView, setChartView] = useState<"overall" | "auto" | "manual">(
    "overall"
  );
  const [expandAllFindings, setExpandAllFindings] = useState(false);
  const [progress, setProgress] = useState(0);

  const heading = useRef<HTMLHeadingElement>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const analysisController = useRef<AbortController | null>(null);

  useEffect(() => {
    const initial = loadStoredRecords();
    setRecords(initial.records);
    if (initial.notice) setNotice(initial.notice);
    return () => {
      if (timer.current) clearInterval(timer.current);
      analysisController.current?.abort();
    };
  }, []);

  useEffect(() => {
    heading.current?.focus();
    window.scrollTo(0, 0);
  }, [page]);

  function go(nextPage: string) {
    setPage(nextPage);
    setFilter("Todos");
    setChecklistFilter("Todos");
    setReportManualFilter("Todos");
    setExpandAllFindings(false);
    setError("");
    setNotice("");
  }

  function save(nextRecords: RecordItem[]) {
    setRecords(nextRecords);
    const result = persistRecords(nextRecords);
    if (!result.saved) {
      setNotice(result.notice);
      return false;
    }
    return true;
  }

  async function start(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const validation = validateTargetUrl(url);
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
      answers: {}
    };

    setActive(item);
    setProgress(0);
    go("loading");

    if (!API_BASE_URL) {
      let stepCount = 0;
      timer.current = setInterval(() => {
        stepCount += 1;
        setProgress(stepCount);
        if (stepCount === 3) {
          clearInterval(timer.current!);
          go("results");
          save([item, ...records]);
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
        engine: payload.engine
      };
      setActive(completed);
      go("results");
      save([completed, ...records]);
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
      setActive(failed);
      go("results");
      save([failed, ...records]);
    } finally {
      analysisController.current = null;
    }
  }

  function cancelAnalysis() {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
    analysisController.current?.abort();
    analysisController.current = null;
    setActive(null);
    setProgress(0);
    go("new");
    setNotice("Análise cancelada.");
  }

  function answer(index: number, value: string, note: string) {
    if (!active) return;
    const updated: RecordItem = {
      ...active,
      answers: { ...active.answers, [index]: { value, note } }
    };
    setActive(updated);
    if (save(records.map((r) => (r.id === updated.id ? updated : r)))) {
      setNotice("Respostas salvas neste navegador.");
    }
  }

  function removeRecord(id: string) {
    const next = records.filter((r) => r.id !== id);
    if (active?.id === id) setActive(null);
    if (save(next)) {
      setNotice("Avaliação removida do histórico deste navegador.");
    }
  }

  async function copyFindingGuidance(f: Finding) {
    const text = `${f.title} (${f.impact})\nRegra: ${f.rule}\nElemento: ${f.element}\nComo corrigir: ${f.fix}`;
    try {
      await navigator.clipboard.writeText(text);
      setNotice(`Orientação de "${f.title}" copiada para a área de transferência.`);
    } catch {
      setNotice("Não foi possível copiar automaticamente neste navegador.");
    }
  }

  const { incomplete, data, count, pending, reason, availableFilters } =
    resolveEvaluationState(active);
  const metrics = computeAccessibilityMetrics(active);

  const filteredData = data.filter(
    (f: Finding) => filter === "Todos" || f.impact === filter
  );

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
      <a className="skip" href="#main">
        Ir para o conteúdo
      </a>
      <header>
        <a
          className="brand"
          href="#"
          aria-label="AcessoClaro: iniciar nova avaliação"
          onClick={(e) => {
            e.preventDefault();
            if (page !== "loading") go("new");
          }}
        >AcessoClaro</a>
        <nav aria-label="Navegação principal">
          {[
            ["new", "Nova avaliação"],
            ["history", "Histórico"],
            ["help", "Ajuda e acessibilidade"]
          ].map(([p, label]) => (
            <button
              key={p}
              disabled={page === "loading"}
              aria-current={page === p ? "page" : undefined}
              onClick={() => go(p)}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>
      <div className="shell">
        <aside className="steps" aria-label="Etapas da avaliação">
          <ol>
            {["URL", "Análise automática", "Inspeção manual", "Relatório"].map(
              (s, i) => (
                <li key={s}>
                  <button
                    disabled={page === "loading" || (i > 0 && !active)}
                    aria-current={step === i ? "step" : undefined}
                    onClick={() =>
                      go(["new", "results", "checklist", "report"][i])
                    }
                  >
                    <span className="number" aria-hidden="true">
                      {i + 1}
                    </span>
                    <span>
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
          <p className="rail-note">
            Da URL ao relatório: automação e julgamento humano no mesmo percurso.
          </p>
          <small>Projeto acadêmico · 2026</small>
        </aside>
        <main id="main">
          <div className="eyebrow">
            {step >= 0 ? `ETAPA ${step + 1} DE 4` : "ACESSOCLARO"}
            <span>
              {API_BASE_URL
                ? "MVP · análise automática real"
                : "Protótipo · dados simulados"}
            </span>
          </div>
          <h1 ref={heading} tabIndex={-1}>
            {PAGE_TITLES[page]}
          </h1>
          <div
            role="status"
            aria-live="polite"
            className={notice ? "notice" : ""}
          >
            {notice}
          </div>

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
                  <button className="primary">Iniciar avaliação</button>
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
                  ].map(([title, desc]) => (
                    <article key={title}>
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
              <progress
                value={progress}
                max="3"
                aria-label="Etapas concluídas"
              />
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
                  <>
                    <div className="results-toolbar">
                      <div
                        className="filters"
                        role="group"
                        aria-label="Filtrar achados por gravidade"
                      >
                        {availableFilters.map((f) => (
                          <button
                            key={f}
                            aria-pressed={filter === f}
                            onClick={() => setFilter(f)}
                          >
                            {f}
                          </button>
                        ))}
                      </div>
                      {filteredData.length > 1 && (
                        <button
                          type="button"
                          className="secondary compact-btn"
                          onClick={() => setExpandAllFindings((prev) => !prev)}
                        >
                          {expandAllFindings
                            ? "Recolher detalhes"
                            : "Expandir todos"}
                        </button>
                      )}
                    </div>
                    <h2>Achados automáticos ({data.length})</h2>
                    <p>
                      {active.source === "real"
                        ? "Resultados produzidos automaticamente pelo axe-core."
                        : "Exemplos fictícios para demonstrar a interpretação dos resultados."}
                    </p>
                    {filteredData.map((f: Finding, i: number) => (
                      <details
                        key={`${f.rule}-${i}`}
                        open={expandAllFindings || i === 0}
                        className="finding"
                      >
                        <summary>
                          {f.title}{" "}
                          <span
                            className={
                              "badge " +
                              (f.impact === "Crítico"
                                ? "danger"
                                : f.impact === "Sério"
                                  ? "warning"
                                  : "neutral")
                            }
                          >
                            {f.impact}
                          </span>
                        </summary>
                        <dl>
                          <dt>Regra</dt>
                          <dd>{f.rule}</dd>
                          <dt>Elemento</dt>
                          <dd>
                            <code>{f.element}</code>
                          </dd>
                          {typeof f.occurrences === "number" &&
                            f.occurrences > 1 && (
                              <>
                                <dt>Ocorrências</dt>
                                <dd>{f.occurrences} elementos afetados</dd>
                              </>
                            )}
                          <dt>Evidência</dt>
                          <dd>{f.evidence}</dd>
                          <dt>Como corrigir</dt>
                          <dd>{f.fix}</dd>
                          <dt>Origem</dt>
                          <dd>
                            {active.source === "real"
                              ? "Automática (axe-core)"
                              : "Automática (simulada)"}
                          </dd>
                        </dl>
                        <div className="finding-actions">
                          <button
                            type="button"
                            className="secondary compact-btn"
                            onClick={() => copyFindingGuidance(f)}
                          >
                            Copiar orientação
                          </button>
                        </div>
                      </details>
                    ))}
                    {!filteredData.length && (
                      <div className="empty">
                        <h3>Nenhum achado neste filtro</h3>
                        <p>
                          A ausência de achados automáticos não comprova
                          acessibilidade integral. Continue com a inspeção
                          manual.
                        </p>
                      </div>
                    )}
                  </>
                )}
              </section>
              <aside>
                <section className="guidance">
                  <h2>Inspeção manual</h2>
                  <p>
                    Complete os {QUESTIONS.length} critérios humanos para
                    consolidar o gráfico de acessibilidade no relatório.
                  </p>
                  <strong>
                    {`${count} de ${QUESTIONS.length} ${count === 1 ? "item revisado" : "itens revisados"}`}
                    {metrics.manualScoreAvailable
                      ? ` (${metrics.manualScore}% de conformidade entre os itens aplicáveis revisados)`
                      : " (conformidade ainda não calculada)"}
                  </strong>
                  <progress
                    value={count}
                    max={QUESTIONS.length}
                    aria-label={`${count} de ${QUESTIONS.length} itens revisados`}
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
            <section>
              <p className="lead">
                Revise cada item na página original e registre o que observou.
                As respostas atualizam em tempo real o índice de acessibilidade
                e são salvas neste navegador.
              </p>
              <div className="checklist-live-bar">
                <div>
                  <strong>
                    {`${count} de ${QUESTIONS.length} ${count === 1 ? "item revisado" : "itens revisados"}`}
                  </strong>
                  <small>
                    {metrics.manualScoreAvailable
                      ? `Conformidade entre itens aplicáveis revisados: ${metrics.manualScore}%`
                      : "Conformidade manual ainda não calculada"}
                    {` · ${metrics.isProvisional ? "Índice automático provisório" : "Índice geral estimado"}: ${metrics.overallScore}%`}
                  </small>
                </div>
                <div
                  className="filters"
                  role="group"
                  aria-label="Filtrar itens do checklist"
                >
                  {["Todos", "Pendentes", "Revisados"].map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      aria-pressed={checklistFilter === mode}
                      onClick={() => setChecklistFilter(mode)}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>
              {QUESTIONS.map((q, i) => {
                const currentVal = active.answers[i]?.value || "Não verificado";
                const isPending = currentVal === "Não verificado";
                if (checklistFilter === "Pendentes" && !isPending) return null;
                if (checklistFilter === "Revisados" && isPending) return null;
                return (
                  <fieldset key={q}>
                    <legend>
                      {i + 1}. {q}
                    </legend>
                    <div className="radios">
                      {[
                        "Atende",
                        "Não atende",
                        "Não se aplica",
                        "Não verificado"
                      ].map((v) => (
                        <label key={v}>
                          <input
                            type="radio"
                            name={"q" + i}
                            checked={currentVal === v}
                            onChange={() =>
                              answer(i, v, active.answers[i]?.note || "")
                            }
                          />
                          {v}
                        </label>
                      ))}
                    </div>
                    <label htmlFor={"note" + i}>Observação ou evidência</label>
                    <textarea
                      id={"note" + i}
                      value={active.answers[i]?.note || ""}
                      onChange={(e) =>
                        answer(i, currentVal, e.target.value)
                      }
                    />
                  </fieldset>
                );
              })}
              <button className="primary" onClick={() => go("report")}>
                Revisar relatório
              </button>
            </section>
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
                          onClick={() => {
                            setActive(r);
                            go("results");
                          }}
                        >
                          Abrir avaliação
                        </button>
                        <button
                          className="secondary"
                          onClick={() => {
                            setActive(r);
                            go("report");
                          }}
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
                    <p>
                      <strong>Elemento:</strong> <code>{f.element}</code>
                    </p>
                    {typeof f.occurrences === "number" && f.occurrences > 1 && (
                      <p>
                        <strong>Ocorrências:</strong> {f.occurrences} elementos
                        afetados
                      </p>
                    )}
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
              {QUESTIONS.map((q, i) => {
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
                  "No Relatório, o gráfico combina 50% da pontuação automática (calculada conforme a quantidade e gravidade dos achados) e 50% da inspeção manual (proporção de critérios aplicáveis marcados como Atende). É um indicador orientativo da avaliação, não uma certificação."
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
        </main>
      </div>
    </>
  );
}
