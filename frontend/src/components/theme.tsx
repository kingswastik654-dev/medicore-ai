"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

export function useTheme() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("medcore_theme", next ? "dark" : "light");
    setDark(next);
  }

  return { dark, toggle };
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { dark, toggle } = useTheme();

  return (
    <motion.button
      layout
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
      className={`theme-toggle ${className}`}
      whileTap={{ scale: 0.92 }}
      transition={{ type: "spring", stiffness: 400, damping: 20 }}
    >
      <motion.span
        layout
        className="knob"
        transition={{ type: "spring", stiffness: 300, damping: 22 }}
        initial={false}
        animate={{ rotate: dark ? 180 : 0 }}
      >
        {dark ? (
          <motion.svg
            key="moon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3 w-3"
            initial={{ opacity: 0, scale: 0.5, rotate: -90 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.5, rotate: 90 }}
          >
            <path d="M21 12.79A9 9 0 0 1 11.21 3 7 7 0 0 0 21 12z" />
            <line x1="12" y1="2" x2="12" y2="6" />
            <line x1="2" y1="12" x2="6" y2="12" />
            <line x1="12" y1="22" x2="12" y2="18" />
          </motion.svg>
        ) : (
          <motion.svg
            key="sun"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3 w-3"
            initial={{ opacity: 0, scale: 0.5, rotate: 90 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.5, rotate: -90 }}
          >
            <circle cx="12" cy="12" r="4" />
            <line x1="12" y1="2" x2="12" y2="6" />
            <line x1="12" y1="18" x2="12" y2="22" />
            <line x1="2" y1="12" x2="6" y2="12" />
            <line x1="18" y1="12" x2="22" y2="12" />
          </motion.svg>
        )}
      </motion.span>
    </motion.button>
  );
}
