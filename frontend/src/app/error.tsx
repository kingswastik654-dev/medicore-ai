"use client";

import Icon from "@/components/Icon";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[var(--bg)] px-6 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400">
        <Icon name="alert" className="h-7 w-7" />
      </span>
      <div>
        <h1 className="text-xl font-bold text-[var(--text)]">Something went wrong</h1>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-[var(--muted)]">
          An unexpected error occurred. Try again — if it persists, note the reference code below and contact support.
        </p>
        {error.digest && (
          <p className="mt-3 inline-block rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-2.5 py-1 font-mono text-xs text-[var(--muted)]">
            ref: {error.digest}
          </p>
        )}
      </div>
      <button onClick={reset} className="btn-primary !rounded-full">Try again</button>
    </div>
  );
}
