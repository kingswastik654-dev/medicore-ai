export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
      <div className="flex flex-col items-center gap-4">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden>
            <path d="M12 20.5S4 15 4 9.6C4 6.9 6 5 8.4 5c1.5 0 2.9.8 3.6 2 .7-1.2 2.1-2 3.6-2C18 5 20 6.9 20 9.6c0 5.4-8 10.9-8 10.9z" />
          </svg>
        </span>
        <div className="flex items-center gap-2 text-sm font-medium text-[var(--muted)]">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600 dark:border-slate-600 dark:border-t-blue-400" />
          Loading MediCore…
        </div>
      </div>
    </div>
  );
}
