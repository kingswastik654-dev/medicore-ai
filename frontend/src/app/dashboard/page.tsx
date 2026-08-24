"use client";

import { useEffect, useState } from "react";

import AppShell from "@/components/AppShell";
import { api } from "@/lib/api";

type Summary = {
  date: string;
  total_patients: number;
  appointments_today: number;
  completed_today: number;
  revenue_today: number;
  revenue_total: number;
  outstanding: number;
};

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Summary>("/api/analytics/summary")
      .then(setSummary)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);

  const cards: { label: string; value: string; accent?: boolean }[] = summary
    ? [
        { label: "Active Patients", value: String(summary.total_patients) },
        { label: "Appointments Today", value: String(summary.appointments_today) },
        { label: "Completed Today", value: String(summary.completed_today) },
        { label: "Revenue Today (₹)", value: summary.revenue_today.toLocaleString(), accent: true },
        { label: "Revenue Total (₹)", value: summary.revenue_total.toLocaleString() },
        { label: "Outstanding (₹)", value: summary.outstanding.toLocaleString() },
      ]
    : [];

  return (
    <AppShell title="Dashboard">
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 mb-4">
          {error}
        </div>
      )}
      {!summary && !error && <div className="text-slate-400 text-sm">Loading metrics…</div>}
      {summary && (
        <>
          <p className="text-xs text-slate-500 mb-3">Data as of {summary.date}</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {cards.map((c) => (
              <div key={c.label} className="card">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  {c.label}
                </div>
                <div className={`mt-1 text-2xl font-semibold ${c.accent ? "text-green-600" : ""}`}>
                  {c.value}
                </div>
              </div>
            ))}
          </div>
          <div className="card mt-6">
            <div className="text-sm font-medium text-slate-700">Phase status</div>
            <ul className="mt-2 list-disc pl-5 space-y-1 text-sm text-slate-600">
              <li>Phase 0 — Foundation (registration, scheduling, billing, audit): live</li>
              <li>Phase 2 — AI Copilot wave (ambient scribe, coding copilot, NL analytics): next</li>
            </ul>
          </div>
        </>
      )}
    </AppShell>
  );
}
