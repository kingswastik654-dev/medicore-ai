"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import AppShell from "@/components/AppShell";
import Icon from "@/components/Icon";
import { StatCard } from "@/components/ui";
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

const QUICK = [
  { href: "/patients", label: "Register patient", icon: "plus" },
  { href: "/appointments", label: "Book appointment", icon: "calendar" },
  { href: "/consult", label: "Start consult (AI)", icon: "sparkles" },
  { href: "/billing", label: "Collect payment", icon: "banknote" },
];

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Summary>("/api/analytics/summary")
      .then(setSummary)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);

  return (
    <AppShell title="Dashboard" subtitle="Live operational picture across your facility">
      {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}
      {!summary && !error && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card h-[104px] animate-pulse !bg-slate-50" />
          ))}
        </div>
      )}
      {summary && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            <StatCard label="Active patients" value={String(summary.total_patients)} sub="lifetime registrations" icon="users" tone="blue" />
            <StatCard label="Appointments today" value={String(summary.appointments_today)} sub="all doctors & queues" icon="calendar" tone="purple" />
            <StatCard label="Completed today" value={String(summary.completed_today)} sub="consultations closed out" icon="check" tone="green" />
            <StatCard label="Revenue today" value={`₹${summary.revenue_today.toLocaleString()}`} sub={`lifetime ₹${summary.revenue_total.toLocaleString()}`} icon="banknote" tone="green" />
            <StatCard label="Outstanding" value={`₹${summary.outstanding.toLocaleString()}`} sub="issued & partially paid" icon="alert" tone="amber" />
            <StatCard
              label="AI copilots"
              value="4 live"
              sub="scribe · CDS · coding · RAG"
              icon="sparkles"
              tone="purple"
            />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="card">
              <div className="section-title mb-3">Quick actions</div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {QUICK.map((q) => (
                  <Link key={q.href} href={q.href}
                    className="group flex items-center justify-between rounded-xl border border-slate-200 px-3.5 py-3 text-sm font-medium text-slate-700 transition-all hover:border-blue-300 hover:bg-blue-50/50 hover:text-blue-700">
                    <span className="flex items-center gap-2.5">
                      <Icon name={q.icon} className="h-4 w-4 text-slate-400 group-hover:text-blue-600" />
                      {q.label}
                    </span>
                    <Icon name="arrow" className="h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-500" />
                  </Link>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="section-title mb-3">Platform status</div>
              <ul className="space-y-2.5 text-sm">
                {[
                  ["Phase 0 · Registration, scheduling, billing, audit", "live"],
                  ["Phase 1 · EMR, e-Rx, pharmacy FEFO, LIS criticals", "live"],
                  ["Phase 2 · Scribe, coding, RAG, NL analytics", "live"],
                  ["Phase 3+ · Bed/OR orchestration agents, denials AI", "roadmap"],
                ].map(([label, state]) => (
                  <li key={label} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                    <span className="text-slate-600">{label}</span>
                    <span className={`chip ${state === "live" ? "border border-emerald-200 bg-emerald-50 text-emerald-700" : "border border-slate-200 bg-slate-50 text-slate-400"}`}>
                      {state === "live" && <Icon name="check" className="h-3 w-3" />}
                      {state}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="hint mt-4">Data as of {summary.date} · every metric is role-scoped and audit-logged.</p>
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}

function Alert({ kind, children }: { kind: "error"; children: React.ReactNode }) {
  const cls = "flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700";
  return <div className={cls}>{children}</div>;
}
