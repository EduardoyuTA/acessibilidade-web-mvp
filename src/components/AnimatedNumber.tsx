import React, { useEffect, useRef, useState } from "react";

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Número que conta suavemente até o novo valor. O texto animado fica
 * escondido de leitores de tela, que recebem só o valor final.
 */
export function AnimatedNumber({
  value,
  suffix = "",
  duration = 600,
  from,
  format = (n: number) => String(n)
}: {
  value: number;
  suffix?: string;
  duration?: number;
  from?: number;
  format?: (n: number) => string;
}) {
  const [shown, setShown] = useState(from ?? value);
  const current = useRef(from ?? value);

  useEffect(() => {
    if (prefersReducedMotion()) {
      current.current = value;
      setShown(value);
      return;
    }
    const start = current.current;
    const startedAt = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = Math.round(start + (value - start) * eased);
      current.current = next;
      setShown(next);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return (
    <>
      <span aria-hidden="true">
        {format(shown)}
        {suffix}
      </span>
      <span className="sr-only">
        {format(value)}
        {suffix}
      </span>
    </>
  );
}
