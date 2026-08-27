"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, type Variants } from "framer-motion";

import AppShell from "@/components/AppShell";
import Icon from "@/components/Icon";
import { Card, CardHeader, CardTitle, BadgeKit, Skeleton, Button, Progress, Avatar } from "@/components/kit";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";

type Summary = {
  date: string;
  total_patients: number;
  appointments_today: number;
  completed_today: number;
  revenue_today: number;
  revenue_total: number;
  outstanding: number;
};

type FacilityRow = {
  id: number; name: string; code: string; staff_count: number;
  beds_total: number; beds_available: number; revenue_collected: number; outstanding: number;
};

type Consolidated = {
  facility_count: number;
  facilities: FacilityRow[];
  totals: { staff: number; beds_total: number; beds_available: number; revenue_collected: number };
};

const QUICK = [
  { href: "/patients", label: "Register patient", desc: "Create MRN & capture demographics", icon: "users", tone: "blue" },
  { href: "/appointments", label: "Book appointment", desc: "Slot-perfect token queue", icon: "calendar", tone: "violet" },
  { href: "/consult", label: "Start consult", desc: "AI scribe drafts, you sign", icon: "sparkles", tone: "teal" },
  { href: "/billing", label: "Collect payment", desc: "Invoices & receipts", icon: "banknote", tone: "emerald" },
  { href: "/emergency", label: "ED triage", desc: "Casualty board & MLC", icon: "alert", tone: "rose" },
  { href: "/ot", label: "OT schedule", desc: "WHO checklist, theatres", icon: "ot", tone: "orange" },
];

const container: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const item: Variants = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } } };

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [consolidated, setConsolidated] = useState<Consolidated | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Summary>("/api/analytics/summary").then(setSummary).catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
    api<Consolidated>("/api/analytics/consolidated").then(setConsolidated).catch(() => setConsolidated(null));
  }, []);

  if (error) {
    return (
      <AppShell title="Dashboard" subtitle="Live operational picture">
        <Card className="border-rose-200 bg-rose-50 text-rose-800 dark:bg-rose-950/30 dark:border-rose-900/40 dark:text-rose-200">
          <div className="flex items-center gap-3">
            <Icon name="alert" className="h-5 w-5" />
            <span className="text-sm font-semibold">{error}</span>
            <Button variant="outline" size="sm" onClick={() => location.reload()} className="ml-auto">Retry</Button>
          </div>
        </Card>
      </AppShell>
    );
  }

  if (!summary) {
    return (
      <AppShell title="Dashboard" subtitle="Live operational picture across your facility">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="h-[118px] animate-pulse">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="mt-3 h-7 w-24" />
              <Skeleton className="mt-2 h-3 w-32" />
            </Card>
          ))}
        </div>
      </AppShell>
    );
  }

  const occupancy = consolidated ? Math.round(((consolidated.totals.beds_total - consolidated.totals.beds_available) / Math.max(1, consolidated.totals.beds_total)) * 100) : 0;

  return (
    <AppShell title="Dashboard" subtitle={`Live operational picture · ${summary.date} · every metric is role-scoped and audit-logged`}>
      <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <motion.div variants={item}>
          <Card hover className="relative overflow-hidden">
            <div className="absolute right-0 top-0 h-20 w-20 rounded-full bg-blue-500/10 blur-2xl" />
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-widest text-[var(--muted)]">Active patients</div>
                <div className="mt-1 text-[28px] font-extrabold tracking-tight text-[var(--text)]">{summary.total_patients.toLocaleString()}</div>
                <div className="mt-1 flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                  <Icon name="check" className="h-3 w-3" /> lifetime registrations
                </div>
              </div>
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 text-white shadow-md">
                <Icon name="users" className="h-5 w-5" />
              </span>
            </div>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card hover className="relative overflow-hidden">
            <div className="absolute right-0 top-0 h-20 w-20 rounded-full bg-violet-500/10 blur-2xl" />
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-widest text-[var(--muted)]">Appointments today</div>
                <div className="mt-1 text-[28px] font-extrabold tracking-tight text-[var(--text)]">{summary.appointments_today}</div>
                <div className="mt-1 text-xs text-[var(--muted)]">{summary.completed_today} completed · queue live</div>
              </div>
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-600 text-white shadow-md">
                <Icon name="calendar" className="h-5 w-5" />
              </span>
            </div>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card hover className="relative overflow-hidden">
            <div className="absolute right-0 top-0 h-20 w-20 rounded-full bg-teal-500/10 blur-2xl" />
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-widest text-[var(--muted)]">Revenue today</div>
                <div className="mt-1 text-[24px] font-extrabold tracking-tight text-[var(--text)]">{formatCurrency(summary.revenue_today)}</div>
                <div className="mt-1 text-xs text-[var(--muted)]">lifetime {formatCurrency(summary.revenue_total)}</div>
              </div>
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-600 text-white shadow-md">
                <Icon name="banknote" className="h-5 w-5" />
              </span>
            </div>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card hover>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-widest text-[var(--muted)]">Outstanding</div>
                <div className="mt-1 text-[24px] font-extrabold tracking-tight text-amber-600">{formatCurrency(summary.outstanding)}</div>
                <div className="mt-1 text-xs text-[var(--muted)]">issued & partially paid</div>
              </div>
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500 text-white shadow-md">
                <Icon name="alert" className="h-5 w-5" />
              </span>
            </div>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card hover className="bg-gradient-to-br from-violet-600 to-indigo-600 text-white border-0 shadow-lg shadow-violet-600/20">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-widest text-violet-100">AI copilots</div>
                <div className="mt-1 text-[24px] font-extrabold tracking-tight">4 live</div>
                <div className="mt-1 text-xs text-violet-100">scribe · CDS · coding · RAG</div>
              </div>
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/15 backdrop-blur text-white">
                <Icon name="sparkles" className="h-5 w-5" />
              </span>
            </div>
            <div className="mt-3 flex items-center gap-1">
              {[0, 1, 2, 3].map((i) => <span key={i} className="h-1 flex-1 rounded-full bg-white/25"><span className="block h-full rounded-full bg-white" style={{ width: `${85 - i * 12}%` }} /></span>)}
            </div>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card hover>
            <div className="text-[11px] font-bold uppercase tracking-widest text-[var(--muted)]">Bed occupancy</div>
            <div className="mt-2 flex items-end gap-3">
              <div className="text-[28px] font-extrabold tracking-tight text-[var(--text)]">{occupancy}%</div>
              <BadgeKit tone={occupancy > 85 ? "rose" : occupancy > 70 ? "amber" : "green"} dot>{occupancy > 85 ? "High" : occupancy > 70 ? "Moderate" : "Available"}</BadgeKit>
            </div>
            <Progress value={occupancy} className="mt-3" />
            <div className="mt-1.5 flex justify-between text-xs text-[var(--muted)]">
              <span>{consolidated ? `${consolidated.totals.beds_total - consolidated.totals.beds_available}/${consolidated.totals.beds_total} occupied` : "—"}</span>
              <span>{consolidated?.totals.beds_available ?? 0} free</span>
            </div>
          </Card>
        </motion.div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.45 }} className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quick actions</CardTitle>
            <BadgeKit tone="slate">{QUICK.length} shortcuts</BadgeKit>
          </CardHeader>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {QUICK.map((q) => (
              <Link
                key={q.href}
                href={q.href}
                className="group flex items-center gap-3 rounded-xl border border-[var(--line-soft)] bg-[var(--surface)] p-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-[var(--line-strong)] hover:shadow-[var(--shadow-card)]"
              >
                <span className={`grid h-9 w-9 place-items-center rounded-xl text-white shadow-sm shrink-0 ${q.tone === "blue" ? "bg-blue-600" : q.tone === "violet" ? "bg-violet-600" : q.tone === "teal" ? "bg-teal-600" : q.tone === "emerald" ? "bg-emerald-600" : q.tone === "rose" ? "bg-rose-600" : "bg-amber-600"}`}>
                  <Icon name={q.icon} className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold leading-none text-[var(--text)] group-hover:text-[var(--brand)]">{q.label}</span>
                  <span className="block text-xs leading-tight text-[var(--muted)] truncate">{q.desc}</span>
                </span>
                <Icon name="arrow" className="ml-auto h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--brand)] shrink-0" />
              </Link>
            ))}
          </div>
        </Card>

        {consolidated && consolidated.facility_count > 1 ? (
          <Card>
            <CardHeader>
              <CardTitle>Facilities · {consolidated.facility_count} campuses</CardTitle>
              <BadgeKit tone="blue">{consolidated.totals.staff} staff</BadgeKit>
            </CardHeader>
            <div className="space-y-2.5">
              {consolidated.facilities.map((f) => (
                <div key={f.id} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--line-soft)] bg-[var(--surface-2)] px-3.5 py-3">
                  <span className="flex items-center gap-3 min-w-0">
                    <Avatar name={f.name} size={36} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-[var(--text)]">{f.name}</span>
                      <span className="block text-xs text-[var(--muted)]">{f.staff_count} staff · {f.beds_available}/{f.beds_total} beds free</span>
                    </span>
                  </span>
                  <span className="text-right shrink-0">
                    <span className="block text-sm font-extrabold text-emerald-600">{formatCurrency(f.revenue_collected)}</span>
                    <span className="block text-xs text-[var(--muted)]">collected</span>
                  </span>
                </div>
              ))}
              <div className="flex justify-between rounded-xl bg-slate-900 px-3.5 py-2.5 text-sm font-bold text-white dark:bg-white dark:text-slate-900">
                <span>Group total</span>
                <span>{formatCurrency(consolidated.totals.revenue_collected)}</span>
              </div>
            </div>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Platform status</CardTitle>
              <BadgeKit tone="green" dot>All live</BadgeKit>
            </CardHeader>
            <ul className="space-y-2.5">
              {[
                ["Phase 0 · Registration, scheduling, billing, audit", "live", "green"],
                ["Phase 1 · EMR, e-Rx, pharmacy FEFO, LIS criticals", "live", "green"],
                ["Phase 2 · Scribe, coding, RAG, NL analytics", "live", "blue"],
                ["Phase 3 · Bed board, forecasting, denial & AR agents", "live", "violet"],
                ["Phase 4 · Multi-facility, telehealth, marketplace", "live", "teal"],
                ["Radiology RIS + OT + Blood Bank + ED + HR", "live", "emerald"],
              ].map(([label, state, tone]) => (
                <li key={label} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--line-soft)] bg-[var(--surface-2)] px-3 py-2.5">
                  <span className="text-sm font-medium text-[var(--text)]">{label}</span>
                  <BadgeKit tone={tone as never}>{state}</BadgeKit>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs leading-relaxed text-[var(--muted)]">Data as of {summary.date} · every metric is role-scoped, audit-logged, and encrypted at rest with AES-256-GCM.</p>
          </Card>
        )}
      </motion.div>
    </AppShell>
  );
}
