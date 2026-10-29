import React, { useState, useEffect, useRef } from "react";
import {
  QUESTIONS,
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
  const [progress, setProgress] = useState(0);

  const heading = useRef<HTMLHeadingElement>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const initial = loadStoredRecords();
    setRecords(initial.records);
    if (initial.notice) setNotice(initial.notice);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  useEffect(() => {
    heading.current?.focus();
    window.scrollTo(0, 0);
  }, [page]);

  function go(nextPage: string) {
    setPage(nextPage);
    setFilter("Todos");
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
      setProgress(1);
      const payload = await requestAnalysis(API_BASE_URL, validation.href);
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
    }
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

  const { incomplete, data, count, pending, reason, availableFilters } =
    resolveEvaluationState(active);

  const filteredData = data.filter(
    (f: Finding) => filter === "Todos" || f.impact === filter
  );

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
              <span
                className={"badge " + (incomplete ? "warning" : "success")}
              >
                {incomplete ? "Incompleta" : "Concluída"}
              </span>
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
                    <h2>Achados automáticos ({data.length})</h2>
                    <p>
                      {active.source === "real"
                        ? "Resultados produzidos automaticamente pelo axe-core."
                        : "Exemplos fictícios para demonstrar a interpretação dos resultados."}
                    </p>
                    {filteredData.map((f: Finding, i: number) => (
                      <details
                        key={`${f.rule}-${i}`}
                        open={i === 0}
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
                  <p>Revise aspectos que dependem de interpretação humana.</p>
                  <strong>
                    {count} de {QUESTIONS.length} itens revisados
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
                  <h2>Relatório simplificado</h2>
                  <p>Reúna achados e observações, incluindo itens pendentes.</p>
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
                As respostas são salvas neste navegador.
              </p>
              <strong>
                {count} de {QUESTIONS.length} itens revisados
              </strong>
              {QUESTIONS.map((q, i) => (
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
                          checked={
                            (active.answers[i]?.value || "Não verificado") === v
                          }
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
                      answer(
                        i,
                        active.answers[i]?.value || "Não verificado",
                        e.target.value
                      )
                    }
                  />
                </fieldset>
              ))}
              <button className="primary" onClick={() => go("report")}>
                Revisar relatório
              </button>
            </section>
          )}

          {page === "history" && (
            <section>
              <p className="lead">Avaliações salvas somente neste navegador.</p>
              {records.length ? (
                records.map((r) => (
                  <article className="history-row" key={r.id}>
                    <div>
                      <h2>{r.url}</h2>
                      <small>
                        {new Date(r.date).toLocaleString("pt-BR")} ·{" "}
                        {["timeout", "blocked", "error"].includes(r.scenario)
                          ? "Incompleta"
                          : "Concluída"}{" "}
                        · {r.source === "real" ? "Real" : "Simulada"}
                      </small>
                    </div>
                    <button
                      className="secondary"
                      onClick={() => {
                        setActive(r);
                        go("results");
                      }}
                    >
                      Abrir avaliação
                    </button>
                  </article>
                ))
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
                  ? "Relatório automatizado complementado por inspeção humana."
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
              <h2>Inspeção manual</h2>
              <p>
                {count} itens revisados; {pending} não verificados.
              </p>
              {QUESTIONS.map((q, i) => (
                <article key={q}>
                  <h3>{q}</h3>
                  <p>{active.answers[i]?.value || "Não verificado"}</p>
                  {active.answers[i]?.note && (
                    <p>Observação: {active.answers[i].note}</p>
                  )}
                </article>
              ))}
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
