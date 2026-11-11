import React, { useEffect, useRef, useState } from "react";
import { CHECKLIST_CATEGORIES } from "../evaluation.mjs";
import { AnimatedNumber } from "./AnimatedNumber.tsx";
import { Icon } from "./icons.tsx";
import "./inspection.css";

type ChecklistItem = {
  question: string;
  criterion: string;
  howTo: string;
  category: string;
  steps: string[];
};

type Answers = { [key: number]: { value: string; note: string } };

type Metrics = {
  overallScore: number;
  manualScore: number;
  manualScoreAvailable: boolean;
  passedManual: number;
  failedManual: number;
  notApplicableManual: number;
  isProvisional: boolean;
};

const OPTIONS = ["Atende", "Não atende", "Não se aplica", "Não verificado"];
const PENDING = "Não verificado";
const ADVANCE_DELAY = 650;
const VIEW_KEY = "acessoclaro-inspecao-modo";

function readPreference(key: string, fallback: string) {
  try {
    return window.localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function writePreference(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* preferência só desta sessão */
  }
}

function StatusSeal({ value, index }: { value: string; index: number }) {
  return (
    <span className="status-seal" key={value} aria-hidden="true">
      {value === "Atende" ? (
        <Icon name="check" size={14} />
      ) : value === "Não atende" ? (
        <Icon name="cross" size={14} />
      ) : value === "Não se aplica" ? (
        "–"
      ) : (
        index + 1
      )}
    </span>
  );
}

function AnswerOptions({
  index,
  value,
  name,
  onChange
}: {
  index: number;
  value: string;
  name: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="radios">
      {OPTIONS.map((option) => (
        <label key={option} data-value={option}>
          <input
            type="radio"
            name={name + index}
            checked={value === option}
            onChange={() => onChange(option)}
          />
          {option}
        </label>
      ))}
    </div>
  );
}

export function ManualInspection({
  checklist,
  answers,
  metrics,
  url,
  onAnswer,
  onGoReport
}: {
  checklist: ChecklistItem[];
  answers: Answers;
  metrics: Metrics;
  url: string;
  onAnswer: (
    index: number,
    value: string,
    note: string,
    options?: { deferSave?: boolean }
  ) => void;
  onGoReport: () => void;
}) {
  const valueOf = (i: number) => answers[i]?.value || PENDING;
  const noteOf = (i: number) => answers[i]?.note || "";
  const pendingIndexes = checklist
    .map((_, i) => i)
    .filter((i) => valueOf(i) === PENDING);
  const reviewed = checklist.length - pendingIndexes.length;

  const [view, setView] = useState(() => readPreference(VIEW_KEY, "guided"));
  const [current, setCurrent] = useState(() => pendingIndexes[0] ?? 0);
  const [direction, setDirection] = useState<"next" | "prev">("next");
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [stepsDone, setStepsDone] = useState<Record<string, boolean>>({});
  const [listFilter, setListFilter] = useState("Todos");
  const [celebrate, setCelebrate] = useState(false);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const questionHeading = useRef<HTMLHeadingElement>(null);
  const completionHeading = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);

  useEffect(() => () => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
  }, []);

  // Ao trocar de critério por navegação, o foco vai para a nova pergunta.
  useEffect(() => {
    if (moved.current) questionHeading.current?.focus();
  }, [current]);

  function changeView(next: string) {
    setView(next);
    writePreference(VIEW_KEY, next);
  }

  function goTo(index: number) {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    const bounded = Math.max(0, Math.min(checklist.length - 1, index));
    setDirection(bounded >= current ? "next" : "prev");
    moved.current = true;
    setCelebrate(false);
    setCurrent(bounded);
  }

  function nextPendingAfter(index: number, pendingAfterAnswer: number[]) {
    return (
      pendingAfterAnswer.find((i) => i > index) ?? pendingAfterAnswer.find((i) => i !== index)
    );
  }

  function answerGuided(value: string) {
    onAnswer(current, value, noteOf(current));
    if (value === PENDING || !autoAdvance) return;
    const remaining = pendingIndexes.filter((i) => i !== current);
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = setTimeout(() => {
      const next = nextPendingAfter(current, remaining);
      if (next === undefined) {
        setCelebrate(true);
      } else {
        goTo(next);
      }
    }, ADVANCE_DELAY);
  }

  const item = checklist[current];
  const finished = pendingIndexes.length === 0;
  const showCompletion = view === "guided" && finished && celebrate;

  useEffect(() => {
    if (showCompletion) completionHeading.current?.focus();
  }, [showCompletion]);

  const categoryProgress = CHECKLIST_CATEGORIES.map((category: string) => {
    const indexes = checklist.map((c, i) => (c.category === category ? i : -1)).filter((i) => i >= 0);
    return {
      category,
      indexes,
      done: indexes.filter((i) => valueOf(i) !== PENDING).length
    };
  }).filter((c: { indexes: number[] }) => c.indexes.length > 0);

  return (
    <div className="inspection">
      <div className="inspection-top">
        <p className="lead">
          Verifique cada critério na página original. As respostas atualizam o índice na hora e
          ficam salvas neste navegador.
        </p>
        <div className="view-toggle" role="group" aria-label="Modo da inspeção">
          <button type="button" aria-pressed={view === "guided"} onClick={() => changeView("guided")}>
            <Icon name="guide" size={18} /> Guiado
          </button>
          <button type="button" aria-pressed={view === "list"} onClick={() => changeView("list")}>
            <Icon name="list" size={18} /> Lista
          </button>
        </div>
      </div>

      <div className="inspection-layout">
        <div className="inspection-main">
          <div className="category-chips" role="group" aria-label="Ir para uma categoria">
            {categoryProgress.map((c: { category: string; indexes: number[]; done: number }) => {
              const complete = c.done === c.indexes.length;
              const containsCurrent = c.indexes.includes(current);
              return (
                <button
                  key={c.category}
                  type="button"
                  className={complete ? "is-complete" : undefined}
                  aria-current={view === "guided" && containsCurrent ? "true" : undefined}
                  onClick={() => {
                    if (view !== "guided") changeView("guided");
                    goTo(c.indexes.find((i) => valueOf(i) === PENDING) ?? c.indexes[0]);
                  }}
                >
                  {complete && <Icon name="check" size={14} />}
                  {c.category}
                  <span className="chip-count">
                    {c.done}/{c.indexes.length}
                  </span>
                </button>
              );
            })}
          </div>

          {view === "guided" && showCompletion && (
            <section className="completion" aria-labelledby="completion-title">
              <span className="completion-seal" aria-hidden="true">
                <Icon name="check" size={34} />
              </span>
              <h2 id="completion-title" tabIndex={-1} ref={completionHeading}>
                Inspeção concluída!
              </h2>
              <p>
                Você revisou os {checklist.length} critérios. O índice agora combina a análise
                automática e o seu olhar.
              </p>
              <div className="completion-stats">
                <div>
                  <strong>
                    <AnimatedNumber value={metrics.overallScore} suffix="%" from={0} />
                  </strong>
                  <span>Índice geral</span>
                </div>
                <div>
                  <strong className="ok">{metrics.passedManual}</strong>
                  <span>Atende</span>
                </div>
                <div>
                  <strong className="bad">{metrics.failedManual}</strong>
                  <span>Não atende</span>
                </div>
                <div>
                  <strong>{metrics.notApplicableManual}</strong>
                  <span>Não se aplica</span>
                </div>
              </div>
              <div className="completion-actions">
                <button type="button" className="primary" onClick={onGoReport}>
                  Ver relatório
                  <Icon name="arrow" size={18} />
                </button>
                <button type="button" className="secondary" onClick={() => changeView("list")}>
                  Revisar respostas
                </button>
              </div>
            </section>
          )}

          {view === "guided" && finished && !showCompletion && (
            <div className="done-banner">
              <Icon name="check" size={18} />
              <span>Todos os critérios foram revisados.</span>
              <button type="button" className="link-btn" onClick={onGoReport}>
                Ver relatório
              </button>
            </div>
          )}

          {view === "guided" && !showCompletion && item && (
            <article
              className="guided-card"
              key={current}
              data-direction={direction}
              data-status={valueOf(current)}
              aria-labelledby="guided-question"
            >
              <div className="guided-meta">
                <span className="guided-count">
                  Critério {current + 1} de {checklist.length}
                </span>
                <span className="badge neutral">{item.category}</span>
                <span className="badge criterion-badge">{item.criterion}</span>
              </div>
              <h2 id="guided-question" ref={questionHeading} tabIndex={-1}>
                <StatusSeal value={valueOf(current)} index={current} />
                <span>{item.question}</span>
              </h2>

              <div className="guided-grid">
                <section className="howto" aria-labelledby="howto-title">
                  <h3 id="howto-title">Como verificar</h3>
                  <ul className="howto-steps">
                    {item.steps.map((step, s) => {
                      const key = `${current}-${s}`;
                      return (
                        <li key={key}>
                          <label className={stepsDone[key] ? "is-done" : undefined}>
                            <input
                              type="checkbox"
                              checked={!!stepsDone[key]}
                              onChange={() =>
                                setStepsDone((prev) => ({ ...prev, [key]: !prev[key] }))
                              }
                            />
                            <span className="step-box" aria-hidden="true">
                              <Icon name="check" size={13} />
                            </span>
                            <span>{step}</span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                  {url && (
                    <a className="open-page" href={url} target="_blank" rel="noopener noreferrer">
                      Abrir a página avaliada
                      <Icon name="external" size={16} />
                      <span className="sr-only"> (abre em nova aba)</span>
                    </a>
                  )}
                </section>

                <fieldset className="answer-set" data-status={valueOf(current)}>
                  <legend>O que você observou?</legend>
                  <AnswerOptions
                    index={current}
                    value={valueOf(current)}
                    name="guided"
                    onChange={answerGuided}
                  />
                  <label htmlFor={"guided-note" + current}>Observação ou evidência</label>
                  <textarea
                    id={"guided-note" + current}
                    value={noteOf(current)}
                    placeholder="Ex.: o menu principal perde o foco ao abrir."
                    onChange={(e) =>
                      onAnswer(current, valueOf(current), e.target.value, { deferSave: true })
                    }
                  />
                  <label className="auto-advance">
                    <input
                      type="checkbox"
                      checked={autoAdvance}
                      onChange={(e) => setAutoAdvance(e.target.checked)}
                    />
                    Avançar sozinho ao responder
                  </label>
                </fieldset>
              </div>

              <nav className="guided-nav" aria-label="Navegar entre critérios">
                <button
                  type="button"
                  className="secondary compact-btn"
                  disabled={current === 0}
                  onClick={() => goTo(current - 1)}
                >
                  <Icon name="left" size={18} /> Anterior
                </button>
                <ol className="dots">
                  {checklist.map((c, i) => (
                    <li key={c.question}>
                      <button
                        type="button"
                        data-status={valueOf(i)}
                        aria-current={i === current ? "step" : undefined}
                        aria-label={`Critério ${i + 1}: ${c.question} — ${valueOf(i)}`}
                        onClick={() => goTo(i)}
                      />
                    </li>
                  ))}
                </ol>
                {current < checklist.length - 1 ? (
                  <button
                    type="button"
                    className="secondary compact-btn"
                    onClick={() => goTo(current + 1)}
                  >
                    Próximo <Icon name="right" size={18} />
                  </button>
                ) : (
                  <button type="button" className="primary compact-btn" onClick={onGoReport}>
                    Relatório <Icon name="right" size={18} />
                  </button>
                )}
              </nav>
            </article>
          )}

          {view === "list" && (
            <>
              <div className="filters" role="group" aria-label="Filtrar itens do checklist">
                {["Todos", "Pendentes", "Revisados"].map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={listFilter === mode}
                    onClick={() => setListFilter(mode)}
                  >
                    {mode}
                  </button>
                ))}
              </div>
              {checklist.map((c, i) => {
                const value = valueOf(i);
                const isPending = value === PENDING;
                if (listFilter === "Pendentes" && !isPending) return null;
                if (listFilter === "Revisados" && isPending) return null;
                return (
                  <fieldset key={c.question} aria-describedby={"howto" + i} data-status={value}>
                    <legend>
                      <StatusSeal value={value} index={i} />
                      <span>
                        {i + 1}. {c.question}
                      </span>
                    </legend>
                    <p className="criterion-hint" id={"howto" + i}>
                      <span className="badge neutral">{c.criterion}</span>
                      <span>
                        <strong>Como verificar:</strong> {c.howTo}
                      </span>
                    </p>
                    <AnswerOptions
                      index={i}
                      value={value}
                      name="q"
                      onChange={(v) => onAnswer(i, v, noteOf(i))}
                    />
                    <label htmlFor={"note" + i}>Observação ou evidência</label>
                    <textarea
                      id={"note" + i}
                      value={noteOf(i)}
                      onChange={(e) => onAnswer(i, value, e.target.value, { deferSave: true })}
                    />
                  </fieldset>
                );
              })}
              <button className="primary" onClick={onGoReport}>
                Revisar relatório
              </button>
            </>
          )}
        </div>

        <aside className="inspection-side" aria-label="Progresso da inspeção">
          <div className="side-card">
            <h2>Progresso</h2>
            <div className="ring-progress">
              <svg viewBox="0 0 120 120" aria-hidden="true">
                <circle cx="60" cy="60" r="50" className="ring-track" />
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  className="ring-fill"
                  style={{
                    strokeDashoffset: 314.16 - (314.16 * reviewed) / Math.max(1, checklist.length)
                  }}
                />
              </svg>
              <div className="ring-label">
                <strong>
                  {reviewed}/{checklist.length}
                </strong>
                <span>revisados</span>
              </div>
            </div>
            <dl className="side-stats">
              <div>
                <dt>Conformidade manual</dt>
                <dd>
                  {metrics.manualScoreAvailable ? (
                    <AnimatedNumber value={metrics.manualScore} suffix="%" />
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div>
                <dt>{metrics.isProvisional ? "Índice provisório" : "Índice geral"}</dt>
                <dd>
                  <AnimatedNumber value={metrics.overallScore} suffix="%" />
                </dd>
              </div>
            </dl>
            <div className="side-pills">
              <span className="badge success">Atende {metrics.passedManual}</span>
              <span className="badge danger">Não atende {metrics.failedManual}</span>
              <span className="badge neutral">N/A {metrics.notApplicableManual}</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
