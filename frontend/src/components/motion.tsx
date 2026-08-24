"use client";

import { useEffect, useRef, useState } from "react";

export function useInView<T extends HTMLElement>(threshold = 0.15, once = true) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          if (once) observer.disconnect();
        } else if (!once) {
          setInView(false);
        }
      },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, once]);

  return { ref, inView };
}

export function Reveal({
  children,
  delay = 0,
  y = 24,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? "translateY(0)" : `translateY(${y}px)`,
        transition: `opacity .7s cubic-bezier(.21,.61,.35,1) ${delay}ms, transform .7s cubic-bezier(.21,.61,.35,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

export function CountUp({
  to,
  prefix = "",
  suffix = "",
  duration = 1500,
  decimals = 0,
}: {
  to: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  decimals?: number;
}) {
  const { ref, inView } = useInView<HTMLSpanElement>(0.4);
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(to * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, to, duration]);

  return (
    <span ref={ref}>
      {prefix}
      {value.toLocaleString(undefined, { maximumFractionDigits: decimals, minimumFractionDigits: decimals })}
      {suffix}
    </span>
  );
}

export function TypeWriter({
  words,
  typing = 55,
  deleting = 28,
  pause = 1600,
  className = "",
}: {
  words: string[];
  typing?: number;
  deleting?: number;
  pause?: number;
  className?: string;
}) {
  const [index, setIndex] = useState(0);
  const [text, setText] = useState("");
  const [deletingMode, setDeletingMode] = useState(false);

  useEffect(() => {
    const word = words[index % words.length];
    let timer: ReturnType<typeof setTimeout>;

    if (!deletingMode && text === word) {
      timer = setTimeout(() => setDeletingMode(true), pause);
    } else if (deletingMode && text === "") {
      setDeletingMode(false);
      setIndex((i) => (i + 1) % words.length);
    } else {
      timer = setTimeout(
        () => setText(word.slice(0, text.length + (deletingMode ? -1 : 1))),
        deletingMode ? deleting : typing
      );
    }
    return () => clearTimeout(timer);
  }, [text, deletingMode, index, words, typing, deleting, pause]);

  return (
    <span className={className}>
      {text}
      <span className="tw-caret" />
    </span>
  );
}
