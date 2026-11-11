import React, { useEffect, useRef, useState } from "react";
import { validateTargetUrl } from "../evaluation.mjs";
import { AnimatedNumber } from "./AnimatedNumber.tsx";
import { Icon } from "./icons.tsx";
import "./welcome.css";

export const WELCOME_PREF_KEY = "acessoclaro-boas-vindas";

export function shouldShowWelcomeOnOpen() {
  try {
    return window.localStorage.getItem(WELCOME_PREF_KEY) !== "ocultar";
  } catch {
    return true;
  }
}

function setShowWelcomeOnOpen(show: boolean) {
  try {
    if (show) window.localStorage.removeItem(WELCOME_PREF_KEY);
    else window.localStorage.setItem(WELCOME_PREF_KEY, "ocultar");
  } catch {
    /* preferência só desta sessão */
  }
}

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/** Marca o elemento como visível quando ele entra na tela (uma vez). */
function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion() || !("IntersectionObserver" in window)) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, visible };
}

const PINS = [
  {
    id: "imagem",
    label: "Imagem sem texto alternativo",
    impact: "Crítico",
    tone: "critical",
    fix: "Descreva no atributo alt o que a imagem comunica.",
    who: "Leitor de tela"
  },
  {
    id: "contraste",
    label: "Contraste insuficiente",
    impact: "Sério",
    tone: "serious",
    fix: "Escureça o texto até atingir 4,5:1 com o fundo.",
    who: "Baixa visão"
  },
  {
    id: "botao",
    label: "Botão sem nome acessível",
    impact: "Crítico",
    tone: "critical",
    fix: "Adicione aria-label=\"Buscar\" ao botão de ícone.",
    who: "Leitor de tela"
  },
  {
    id: "campo",
    label: "Campo sem rótulo",
    impact: "Sério",
    tone: "serious",
    fix: "Associe um <label> visível ao campo de e-mail.",
    who: "Leitor de tela e cognição"
  }
];

function ScanDemo() {
  const [selected, setSelected] = useState(0);
  const [playing, setPlaying] = useState(() => !prefersReducedMotion());
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const interacted = useRef(false);

  // Percorre os marcadores sozinho até a pessoa interagir ou pausar.
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      if (!interacted.current) setSelected((s) => (s + 1) % PINS.length);
    }, 3200);
    return () => clearInterval(id);
  }, [playing]);

  function select(index: number) {
    interacted.current = true;
    setSelected(index);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!playing || e.pointerType !== "mouse") return;
    const box = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - box.left) / box.width - 0.5;
    const y = (e.clientY - box.top) / box.height - 0.5;
    setTilt({ x: -y * 5, y: x * 6 });
  }

  const pin = PINS[selected];

  return (
    <div className={"scan-demo" + (playing ? "" : " is-paused")}>
      <div
        className="scan-stage"
        onPointerMove={onPointerMove}
        onPointerLeave={() => setTilt({ x: 0, y: 0 })}
        style={{ "--rx": `${tilt.x}deg`, "--ry": `${tilt.y}deg` } as React.CSSProperties}
      >
        <div className="mock-browser">
          <div className="mock-chrome" aria-hidden="true">
            <span className="dot red" />
            <span className="dot amber" />
            <span className="dot green" />
            <span className="mock-url">seusite.com.br</span>
          </div>
          <div
            className="mock-page"
            role="img"
            aria-label="Exemplo de página sendo analisada, com quatro problemas marcados"
            data-active={pin.id}
          >
            <div className="mock-nav">
              <span className="mock-logo" />
              <span className="mock-link" />
              <span className="mock-link" />
              <span className="mock-icon-btn" data-pin="botao" />
            </div>
            <div className="mock-hero">
              <div className="mock-image" data-pin="imagem" />
              <div className="mock-copy">
                <span className="mock-line strong" />
                <span className="mock-line" />
                <span className="mock-line faint" data-pin="contraste" />
                <span className="mock-line faint short" />
              </div>
            </div>
            <div className="mock-form">
              <span className="mock-input" data-pin="campo" />
              <span className="mock-cta" />
            </div>
            <span className="scan-beam" aria-hidden="true" />
          </div>
          {PINS.map((p, i) => (
            <button
              key={p.id}
              type="button"
              className={`pin pin-${p.id} tone-${p.tone}`}
              style={{ animationDelay: `${600 + i * 450}ms` }}
              aria-pressed={selected === i}
              aria-label={`Problema ${i + 1}: ${p.label}`}
              onClick={() => select(i)}
              onFocus={() => select(i)}
              onPointerEnter={() => select(i)}
            >
              {i + 1}
            </button>
          ))}
        </div>

        <div className="float-card score-float" aria-hidden="true">
          <svg viewBox="0 0 64 64">
            <circle cx="32" cy="32" r="26" className="float-track" />
            <circle cx="32" cy="32" r="26" className="float-ring" />
          </svg>
          <div>
            <strong>58%</strong>
            <span>Índice</span>
          </div>
        </div>
        <div className="float-card gain-float" aria-hidden="true">
          <Icon name="spark" size={16} /> +20 pts ao corrigir
        </div>
      </div>

      <div className="pin-detail" aria-live="polite" key={pin.id}>
        <span className={`badge tone-${pin.tone}`}>{pin.impact}</span>
        <strong>{pin.label}</strong>
        <p>
          <Icon name="wrench" size={15} /> {pin.fix}
        </p>
        <small>Afeta: {pin.who}</small>
      </div>

      <button
        type="button"
        className="demo-toggle"
        aria-pressed={!playing}
        onClick={() => setPlaying((p) => !p)}
      >
        {playing ? "Pausar demonstração" : "Retomar demonstração"}
      </button>
    </div>
  );
}

const MODES = [
  {
    id: "tipica",
    label: "Visão típica",
    caption: "Como a página foi desenhada. Parece tudo certo — mas repare no texto claro e nos avisos só em cor."
  },
  {
    id: "baixa",
    label: "Baixa visão",
    caption: "Com visão embaçada, o texto cinza-claro some. É por isso que a WCAG pede contraste de 4,5:1 (critério 1.4.3)."
  },
  {
    id: "daltonismo",
    label: "Daltonismo",
    caption: "Sem distinguir vermelho e verde, \"aprovado\" e \"recusado\" ficam iguais. Informação não pode depender só de cor (1.4.1)."
  },
  {
    id: "mono",
    label: "Monocromático",
    caption: "Em tons de cinza, só sobra o que tem texto, ícone ou forma. Status e links precisam de mais que cor."
  }
];

function PerceptionSimulator() {
  const [mode, setMode] = useState(MODES[0]);
  const { ref, visible } = useReveal<HTMLElement>();

  return (
    <section ref={ref} className={"welcome-section simulator reveal" + (visible ? " is-visible" : "")} aria-labelledby="sim-title">
      <div className="section-head">
        <span className="section-eyebrow">Simulador</span>
        <h2 id="sim-title">Veja a mesma página por outros olhos</h2>
        <p>Escolha um perfil e repare no que deixa de funcionar.</p>
      </div>

      <svg width="0" height="0" className="svg-filters" aria-hidden="true" focusable="false">
        {/* Deuteranopia (Machado, Oliveira e Fernandes, 2009) */}
        <filter id="ac-deuteranopia">
          <feColorMatrix
            type="matrix"
            values="0.367 0.861 -0.228 0 0  0.280 0.673 0.047 0 0  -0.012 0.043 0.969 0 0  0 0 0 1 0"
          />
        </filter>
      </svg>

      <div className="sim-layout">
        <div className="sim-controls" role="group" aria-label="Perfil de percepção">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              aria-pressed={mode.id === m.id}
              onClick={() => setMode(m)}
            >
              <Icon name="eye" size={18} />
              {m.label}
            </button>
          ))}
        </div>

        <div className="sim-preview">
          <div className={"sim-sample mode-" + mode.id} aria-hidden="true">
            <div className="sample-head">
              <strong>Resultado da inscrição</strong>
              <span className="sample-sub">Atualizado hoje às 14h</span>
            </div>
            <ul className="sample-list">
              <li>
                <span className="sample-name">Ana Souza</span>
                <span className="sample-status ok">●</span>
              </li>
              <li>
                <span className="sample-name">Bruno Lima</span>
                <span className="sample-status no">●</span>
              </li>
              <li>
                <span className="sample-name">Carla Dias</span>
                <span className="sample-status ok">●</span>
              </li>
            </ul>
            <p className="sample-note">
              Dúvidas? <span className="sample-link">fale conosco</span> pelo formulário.
            </p>
          </div>
          <p className="sim-caption" aria-live="polite">
            <strong>{mode.label}:</strong> {mode.caption}
          </p>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const { ref, visible } = useReveal<HTMLElement>();
  const steps = [
    {
      icon: "target",
      title: "Analise automaticamente",
      text: "Informe a URL. O axe-core abre a página e aponta o que dá para detectar por código."
    },
    {
      icon: "guide",
      title: "Inspecione com o guia",
      text: "Um critério por vez, com passos práticos para o que só uma pessoa consegue julgar."
    },
    {
      icon: "wrench",
      title: "Corrija com o plano",
      text: "Cada achado vem com o porquê, quem é afetado e o código antes e depois."
    }
  ];
  return (
    <section ref={ref} id="como-funciona" className={"welcome-section reveal" + (visible ? " is-visible" : "")} aria-labelledby="how-title">
      <div className="section-head">
        <span className="section-eyebrow">Como funciona</span>
        <h2 id="how-title">Da URL ao relatório em três passos</h2>
      </div>
      <ol className="how-steps">
        {steps.map((s, i) => (
          <li key={s.title} style={{ transitionDelay: `${i * 90}ms` }}>
            <span className="how-number" aria-hidden="true">{i + 1}</span>
            <span className="how-icon" aria-hidden="true">
              <Icon name={s.icon} size={24} />
            </span>
            <h3>{s.title}</h3>
            <p>{s.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** 186 → "18,6" (os números contam em décimos). */
const tenths = (n: number) =>
  (n / 10).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function Facts() {
  const { ref, visible } = useReveal<HTMLElement>();
  return (
    <section ref={ref} className={"welcome-section facts reveal" + (visible ? " is-visible" : "")} aria-labelledby="facts-title">
      <h2 id="facts-title" className="sr-only">Por que acessibilidade importa</h2>
      <div className="fact">
        <strong>
          {visible ? <AnimatedNumber value={186} from={0} duration={1100} format={tenths} /> : "0"}
        </strong>
        <span className="fact-unit">milhões</span>
        <p>de pessoas com deficiência no Brasil, com 2 anos ou mais.</p>
        <small>Fonte: IBGE, PNAD Contínua 2022.</small>
      </div>
      <div className="fact">
        <strong>{visible ? <AnimatedNumber value={13} from={0} duration={1100} format={tenths} /> : "0"}</strong>
        <span className="fact-unit">bilhão</span>
        <p>de pessoas no mundo vivem com deficiência significativa — 1 em cada 6.</p>
        <small>Fonte: OMS, Global report on health equity, 2022.</small>
      </div>
      <div className="fact fact-text">
        <Icon name="spark" size={26} />
        <p>
          Uma página acessível funciona melhor para todo mundo: no teclado, no celular sob o sol, com
          pressa ou com internet lenta.
        </p>
      </div>
    </section>
  );
}

export function Welcome({
  headingRef,
  historyCount,
  onQuickStart,
  onGoNew,
  onGoHistory
}: {
  headingRef: React.RefObject<HTMLHeadingElement>;
  historyCount: number;
  onQuickStart: (url: string) => void;
  onGoNew: () => void;
  onGoHistory: () => void;
}) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [showOnOpen, setShowOnOpen] = useState(shouldShowWelcomeOnOpen);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const validation = validateTargetUrl(url);
    if (!validation.ok || !validation.href) {
      setError(validation.error || "Informe uma URL completa HTTP/HTTPS, sem credenciais.");
      return;
    }
    setError("");
    onQuickStart(validation.href);
  }

  return (
    <div className="welcome">
      <section className="welcome-hero" aria-labelledby="welcome-title">
        <div className="hero-copy">
          <span className="hero-eyebrow">
            <span className="pulse-dot" aria-hidden="true" /> Avaliação de acessibilidade web
          </span>
          <h1 id="welcome-title" ref={headingRef} tabIndex={-1}>
            Descubra quem fica de fora do seu site <span className="hero-accent">— e como trazer todo mundo para dentro.</span>
          </h1>
          <p className="hero-lead">
            O AcessoClaro combina a análise automática do axe-core com uma inspeção humana guiada e
            mostra, passo a passo, como corrigir cada problema.
          </p>

          <form className="quick-start" onSubmit={submit} noValidate>
            <label htmlFor="welcome-url" className="sr-only">
              URL da página para avaliar
            </label>
            <input
              id="welcome-url"
              type="url"
              inputMode="url"
              placeholder="https://seusite.com.br"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              aria-invalid={!!error}
              aria-describedby={error ? "welcome-hint welcome-error" : "welcome-hint"}
            />
            <button type="submit" className="primary">
              Avaliar agora
              <Icon name="arrow" size={18} />
            </button>
          </form>
          <p id="welcome-error" className="error" role="alert">
            {error}
          </p>
          <p id="welcome-hint" className="hero-hint">
            Páginas públicas, HTTP ou HTTPS. Ou{" "}
            <button type="button" className="inline-link" onClick={onGoNew}>
              abra a avaliação completa
            </button>
            {historyCount > 0 && (
              <>
                {" "}
                ·{" "}
                <button type="button" className="inline-link" onClick={onGoHistory}>
                  continue pelo histórico ({historyCount})
                </button>
              </>
            )}
            .
          </p>
        </div>

        <ScanDemo />
      </section>

      <HowItWorks />
      <PerceptionSimulator />
      <Facts />

      <section className="welcome-cta" aria-labelledby="cta-title">
        <div>
          <h2 id="cta-title">Pronto para ver seu site com outros olhos?</h2>
          <p>Leva poucos minutos e nenhum cadastro. Tudo fica salvo só neste navegador.</p>
        </div>
        <div className="cta-actions">
          <button type="button" className="primary cta-button" onClick={onGoNew}>
            Começar avaliação
            <Icon name="arrow" size={18} />
          </button>
          <label className="welcome-pref">
            <input
              type="checkbox"
              checked={showOnOpen}
              onChange={(e) => {
                setShowOnOpen(e.target.checked);
                setShowWelcomeOnOpen(e.target.checked);
              }}
            />
            Mostrar esta tela ao abrir o app
          </label>
        </div>
      </section>
    </div>
  );
}
