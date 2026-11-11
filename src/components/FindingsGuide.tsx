import React, { useMemo, useState } from "react";
import { findingGain, projectFixPlan, ruleIdOf } from "../evaluation.mjs";
import { AUDIENCES, guideFor } from "../fixGuides.mjs";
import type { Finding } from "../types.ts";
import { AnimatedNumber } from "./AnimatedNumber.tsx";
import { Icon } from "./icons.tsx";
import { Tabs } from "./Tabs.tsx";
import "./findings.css";

const SEVERITIES = [
  { impact: "Crítico", className: "sev-critical" },
  { impact: "Sério", className: "sev-serious" },
  { impact: "Moderado", className: "sev-moderate" },
  { impact: "Leve", className: "sev-minor" }
];

/** Classe de cor por gravidade (faixa lateral e selo). */
export function severityClass(impact: string) {
  return SEVERITIES.find((s) => s.impact === impact)?.className || "sev-minor";
}

function severityBadge(impact: string) {
  return impact === "Crítico" ? "danger" : impact === "Sério" ? "warning" : "neutral";
}

export function AffectedElements({
  finding,
  onCopy
}: {
  finding: Finding;
  onCopy?: (text: string, message: string) => void;
}) {
  const elements =
    finding.elements && finding.elements.length
      ? finding.elements
      : [{ html: finding.element }];
  const total = Math.max(finding.occurrences ?? 1, elements.length);
  const hidden = total - elements.length;

  if (total <= 1) {
    return (
      <>
        <dt>Elemento</dt>
        <dd>
          <code>{elements[0].html}</code>
          {elements[0].target && (
            <small className="element-target">Seletor: {elements[0].target}</small>
          )}
        </dd>
      </>
    );
  }

  return (
    <>
      <dt>Elementos afetados ({total})</dt>
      <dd>
        <ul className="element-list">
          {elements.map((el, i) => (
            <li key={i}>
              <code>{el.html}</code>
              {el.target && (
                <small className="element-target">
                  Seletor: {el.target}
                  {onCopy && (
                    <button
                      type="button"
                      className="link-btn"
                      onClick={() =>
                        onCopy(el.target || "", "Seletor copiado para a área de transferência.")
                      }
                    >
                      Copiar seletor
                    </button>
                  )}
                </small>
              )}
            </li>
          ))}
        </ul>
        {hidden > 0 && (
          <small>
            {`E mais ${hidden} ${hidden === 1 ? "elemento" : "elementos"} com o mesmo problema.`}
          </small>
        )}
      </dd>
    </>
  );
}

function CodeExample({
  before,
  after,
  onCopy
}: {
  before: string;
  after: string;
  onCopy: (text: string, message: string) => void;
}) {
  return (
    <div className="code-compare">
      <figure className="code-before">
        <figcaption>
          <Icon name="cross" size={14} /> Antes
        </figcaption>
        <pre>
          <code>{before}</code>
        </pre>
      </figure>
      <figure className="code-after">
        <figcaption>
          <Icon name="check" size={14} /> Depois
          <button
            type="button"
            className="link-btn"
            onClick={() => onCopy(after, "Exemplo corrigido copiado para a área de transferência.")}
          >
            <Icon name="copy" size={14} /> Copiar
          </button>
        </figcaption>
        <pre>
          <code>{after}</code>
        </pre>
      </figure>
    </div>
  );
}

function FindingCard({
  finding,
  gain,
  fixed,
  best,
  open,
  source,
  onToggleFix,
  onCopy
}: {
  finding: Finding;
  gain: number;
  fixed: boolean;
  best: boolean;
  open: boolean;
  source?: string;
  onToggleFix: (ruleId: string) => void;
  onCopy: (text: string, message: string) => void;
}) {
  const guide = guideFor(finding);
  const ruleId = ruleIdOf(finding);
  const elementCount = Math.max(finding.occurrences ?? 1, finding.elements?.length ?? 1);
  const guidanceText = [
    `${finding.title} (${finding.impact})`,
    `Regra: ${finding.rule}`,
    guide.why && `Por que importa: ${guide.why}`,
    "Como corrigir:",
    ...guide.steps.map((step: string, i: number) => `${i + 1}. ${step}`),
    guide.after && `Exemplo:\n${guide.after}`
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <details
      open={open}
      className={
        "finding guide-card " + severityClass(finding.impact) + (fixed ? " is-fixed" : "")
      }
    >
      <summary>
        <span className="fixed-mark" aria-hidden="true">
          <Icon name="check" size={14} />
        </span>
        <span className="finding-title">
          {finding.title}
          {fixed && <span className="sr-only"> (marcado como corrigido)</span>}
        </span>
        <span className="summary-badges">
          {best && !fixed && <span className="badge best-badge">Maior ganho</span>}
          <span className={"badge " + severityBadge(finding.impact)}>{finding.impact}</span>
          {gain > 0 && (
            <span className="badge gain-badge" title="Ganho no índice automático ao corrigir">
              +{gain} pts
            </span>
          )}
        </span>
      </summary>

      <div className="guide-body">
        <Tabs
          label={`Detalhes de ${finding.title}`}
          tabs={[
            {
              id: "entenda",
              title: (
                <>
                  <Icon name="eye" size={16} /> Entenda
                </>
              ),
              content: (
                <div className="guide-understand">
                  {guide.why && <p className="guide-why">{guide.why}</p>}
                  {guide.audiences.length > 0 && (
                    <div className="audiences">
                      <span className="audiences-label">Quem é afetado:</span>
                      <ul>
                        {guide.audiences.map((a: string) => (
                          <li key={a}>{AUDIENCES[a as keyof typeof AUDIENCES]}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <dl>
                    <dt>Regra</dt>
                    <dd>{finding.rule}</dd>
                    <dt>Evidência</dt>
                    <dd>{finding.evidence}</dd>
                    <dt>Origem</dt>
                    <dd>{source === "real" ? "Automática (axe-core)" : "Automática (simulada)"}</dd>
                  </dl>
                </div>
              )
            },
            {
              id: "corrigir",
              title: (
                <>
                  <Icon name="wrench" size={16} /> Como corrigir
                </>
              ),
              content: (
                <div className="guide-fix">
                  <ol className="fix-steps">
                    {guide.steps.map((step: string, i: number) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                  {guide.before && guide.after && (
                    <CodeExample before={guide.before} after={guide.after} onCopy={onCopy} />
                  )}
                  {!guide.generic && finding.fix && (
                    <p className="guide-note">
                      <strong>Orientação do axe-core:</strong> {finding.fix}
                    </p>
                  )}
                  {finding.helpUrl && (
                    <a href={finding.helpUrl} target="_blank" rel="noopener noreferrer" className="doc-link">
                      Documentação da regra ({ruleId})
                      <Icon name="external" size={14} />
                      <span className="sr-only"> (abre em nova aba)</span>
                    </a>
                  )}
                </div>
              )
            },
            {
              id: "elementos",
              title: (
                <>
                  <Icon name="target" size={16} /> Elementos ({elementCount})
                </>
              ),
              content: (
                <dl>
                  <AffectedElements finding={finding} onCopy={onCopy} />
                </dl>
              )
            }
          ]}
        />
        <div className="finding-actions">
          <button
            type="button"
            className={"secondary compact-btn fix-toggle" + (fixed ? " is-on" : "")}
            aria-pressed={fixed}
            onClick={() => onToggleFix(ruleId)}
          >
            <Icon name="check" size={16} />
            {fixed ? "Corrigido no plano" : "Marcar como corrigido"}
          </button>
          <button
            type="button"
            className="secondary compact-btn"
            onClick={() => onCopy(guidanceText, `Orientação de "${finding.title}" copiada.`)}
          >
            <Icon name="copy" size={16} />
            Copiar orientação
          </button>
        </div>
      </div>
    </details>
  );
}

export function FindingsGuide({
  findings,
  review,
  availableFilters,
  source,
  fixPlan,
  onToggleFix,
  onCopy
}: {
  findings: Finding[];
  review: Finding[];
  availableFilters: string[];
  source?: string;
  fixPlan: string[];
  onToggleFix: (ruleId: string) => void;
  onCopy: (text: string, message: string) => void;
}) {
  const [filter, setFilter] = useState("Todos");
  const [sort, setSort] = useState("gain");
  const [expandAll, setExpandAll] = useState(false);

  const plan = projectFixPlan(findings, fixPlan);
  const items = useMemo(
    () =>
      findings.map((finding, index) => ({
        finding,
        index,
        gain: findingGain(findings, finding),
        fixed: fixPlan.includes(ruleIdOf(finding))
      })),
    [findings, fixPlan]
  );
  const bestGain = Math.max(0, ...items.filter((i) => !i.fixed).map((i) => i.gain));

  const severityOrder = (impact: string) => {
    const pos = SEVERITIES.findIndex((s) => s.impact === impact);
    return pos < 0 ? SEVERITIES.length : pos;
  };
  const visible = items
    .filter((i) => filter === "Todos" || i.finding.impact === filter)
    .sort((a, b) => {
      if (a.fixed !== b.fixed) return a.fixed ? 1 : -1;
      if (sort === "severity") return severityOrder(a.finding.impact) - severityOrder(b.finding.impact);
      if (sort === "occurrences") return (b.finding.occurrences ?? 1) - (a.finding.occurrences ?? 1);
      return b.gain - a.gain || severityOrder(a.finding.impact) - severityOrder(b.finding.impact);
    });

  const counts = SEVERITIES.map((s) => ({
    ...s,
    count: findings.filter((f) => f.impact === s.impact).length
  })).filter((s) => s.count > 0);

  return (
    <>
      {findings.length > 0 && (
        <section className="impact-panel" aria-labelledby="impact-title">
          <div className="impact-plan">
            <h2 id="impact-title">Plano de correção</h2>
            <p>
              Marque o que já corrigiu e veja quanto o índice automático pode subir. Comece pelos
              achados com maior ganho.
            </p>
            <div className="impact-scores">
              <div>
                <span className="impact-label">Agora</span>
                <strong className="impact-now">
                  <AnimatedNumber value={plan.current} suffix="%" />
                </strong>
              </div>
              <Icon name="arrow" size={22} />
              <div>
                <span className="impact-label">Com o plano</span>
                <strong className="impact-next">
                  <AnimatedNumber value={plan.projected} suffix="%" />
                </strong>
              </div>
              {plan.gain > 0 && (
                <span className="badge gain-badge" key={plan.gain}>
                  +{plan.gain} pts
                </span>
              )}
            </div>
            <div
              className="bar-track"
              role="progressbar"
              aria-valuenow={plan.fixedCount}
              aria-valuemin={0}
              aria-valuemax={plan.total}
              aria-label="Achados marcados como corrigidos"
            >
              <div
                className="bar-fill manual"
                style={{ width: `${plan.total ? (plan.fixedCount / plan.total) * 100 : 0}%` }}
              />
            </div>
            <small>
              {plan.fixedCount} de {plan.total}{" "}
              {plan.total === 1 ? "achado marcado" : "achados marcados"} como corrigidos · projeção
              até uma nova análise
            </small>
          </div>

          <div className="impact-severity">
            <h3>Por gravidade</h3>
            <div className="severity-bar" aria-hidden="true">
              {counts.map((s) => (
                <span
                  key={s.impact}
                  className={s.className}
                  style={{ flexGrow: s.count }}
                />
              ))}
            </div>
            <div className="severity-legend" role="group" aria-label="Filtrar achados por gravidade">
              {counts.map((s) => (
                <button
                  key={s.impact}
                  type="button"
                  className={s.className}
                  aria-pressed={filter === s.impact}
                  onClick={() => setFilter(filter === s.impact ? "Todos" : s.impact)}
                >
                  <span className="legend-dot" aria-hidden="true" />
                  {s.impact}
                  <strong>{s.count}</strong>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      <div className="results-toolbar">
        <div className="filters" role="group" aria-label="Filtrar achados por gravidade">
          {availableFilters.map((f) => (
            <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {f}
            </button>
          ))}
        </div>
        <div className="toolbar-right">
          <label className="sort-label">
            <span>Ordenar por</span>
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="gain">Maior ganho no índice</option>
              <option value="severity">Gravidade</option>
              <option value="occurrences">Mais elementos afetados</option>
            </select>
          </label>
          {visible.length > 1 && (
            <button
              type="button"
              className="secondary compact-btn"
              onClick={() => setExpandAll((prev) => !prev)}
            >
              {expandAll ? "Recolher todos" : "Expandir todos"}
            </button>
          )}
        </div>
      </div>

      <h2>Achados automáticos ({findings.length})</h2>
      <p className="muted">
        {source === "real"
          ? "Resultados do axe-core, com um guia para corrigir cada um."
          : "Exemplos fictícios para demonstrar a interpretação e a correção dos resultados."}
      </p>

      <div className="guide-list">
        {visible.map((item, position) => (
          <FindingCard
            key={`${item.finding.rule}-${item.index}-${expandAll}`}
            finding={item.finding}
            gain={item.gain}
            fixed={item.fixed}
            best={item.gain > 0 && item.gain === bestGain && position === 0}
            open={expandAll || position === 0}
            source={source}
            onToggleFix={onToggleFix}
            onCopy={onCopy}
          />
        ))}
      </div>

      {!visible.length && (
        <div className="empty">
          <h3>Nenhum achado neste filtro</h3>
          <p>
            A ausência de achados automáticos não comprova acessibilidade integral. Continue com a
            inspeção manual.
          </p>
        </div>
      )}

      {review.length > 0 && (
        <section className="needs-review" aria-labelledby="needs-review-title">
          <h2 id="needs-review-title">Para conferir manualmente ({review.length})</h2>
          <p>
            O axe-core encontrou estes pontos, mas não conseguiu decidir sozinho se há problema.
            Confira cada um na página original. Eles não entram no índice.
          </p>
          {review.map((f: Finding, i: number) => {
            const guide = guideFor(f);
            return (
              <details key={`review-${f.rule}-${i}`} className="finding sev-review">
                <summary>
                  <span className="finding-title">{f.title}</span>{" "}
                  <span className="badge neutral">Revisar</span>
                </summary>
                <dl>
                  <dt>Regra</dt>
                  <dd>{f.rule}</dd>
                  <AffectedElements finding={f} onCopy={onCopy} />
                  <dt>O que verificar</dt>
                  <dd>{f.evidence}</dd>
                  <dt>Se houver problema</dt>
                  <dd>
                    {guide.generic ? (
                      f.fix
                    ) : (
                      <ol className="fix-steps compact">
                        {guide.steps.map((step: string, s: number) => (
                          <li key={s}>{step}</li>
                        ))}
                      </ol>
                    )}
                  </dd>
                </dl>
              </details>
            );
          })}
        </section>
      )}
    </>
  );
}
