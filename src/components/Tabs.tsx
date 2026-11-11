import React, { useId, useRef, useState } from "react";

/**
 * Abas acessíveis (padrão ARIA): setas, Home e End movem entre as abas;
 * Tab sai para o conteúdo do painel.
 */
export function Tabs({
  label,
  tabs
}: {
  label: string;
  tabs: { id: string; title: React.ReactNode; content: React.ReactNode }[];
}) {
  const baseId = useId();
  const [selected, setSelected] = useState(0);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  function focusTab(index: number) {
    const next = (index + tabs.length) % tabs.length;
    setSelected(next);
    buttons.current[next]?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowRight") focusTab(selected + 1);
    else if (e.key === "ArrowLeft") focusTab(selected - 1);
    else if (e.key === "Home") focusTab(0);
    else if (e.key === "End") focusTab(tabs.length - 1);
    else return;
    e.preventDefault();
  }

  return (
    <div className="tabs">
      <div role="tablist" aria-label={label} className="tab-list" onKeyDown={onKeyDown}>
        {tabs.map((tab, i) => (
          <button
            key={tab.id}
            ref={(el) => {
              buttons.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`${baseId}-tab-${tab.id}`}
            aria-selected={selected === i}
            aria-controls={`${baseId}-panel-${tab.id}`}
            tabIndex={selected === i ? 0 : -1}
            onClick={() => setSelected(i)}
          >
            {tab.title}
          </button>
        ))}
      </div>
      {tabs.map((tab, i) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`${baseId}-panel-${tab.id}`}
          aria-labelledby={`${baseId}-tab-${tab.id}`}
          hidden={selected !== i}
          tabIndex={0}
          className="tab-panel"
        >
          {selected === i && tab.content}
        </div>
      ))}
    </div>
  );
}
