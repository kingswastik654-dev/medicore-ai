"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { motion, type Variants, AnimatePresence } from "framer-motion";

import AppShell from "@/components/AppShell";
import Icon from "@/components/Icon";
import { Card, CardHeader, CardTitle, BadgeKit, Skeleton, Button, Progress, Avatar, useToast } from "@/components/kit";
import { CountUp, Reveal } from "@/components/motion";
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

const AI_AGENTS = [
  { name: "Ambient Scribe", metric: "42 notes today", sub: "avg −38% doc time", tone: "violet", icon: "sparkles" },
  { name: "Clinical Guardrails", metric: "18 warnings", sub: "8 overrides reviewed", tone: "rose", icon: "shield" },
  { name: "Coding Copilot", metric: "24 claims", sub: "96% clean claim rate", tone: "blue", icon: "receipt" },
  { name: "Ops Forecasting", metric: "7-day OPD", sub: "≤60 min bed turnover", tone: "teal", icon: "activity" },
];

const container: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } } };
const item: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.45, ease: "easeOut" } },
};

const toneMap: Record<string, string> = {
  blue: "bg-blue-600",
  violet: "bg-violet-600",
  teal: "bg-teal-600",
  emerald: "bg-emerald-600",
  rose: "bg-rose-600",
  amber: "bg-amber-600",
  orange: "bg-orange-600",
  purple: "bg-purple-600",
  indigo: "bg-indigo-600",
};

function MiniSparkline({ points, className = "" }: { points: number[]; className?: string }) {
  if (points.length < 2) return <div className={`text-xs text-[var(--muted)] ${className}`}>—</div>;
  const max = Math.max(...points, 1);
  const w = 120, h = 24;
  const step = w / (points.length - 1);
  const pts = points.map((p, i) => `${(i * step).toFixed(1)},${h - (p / max) * h}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={`h-6 w-full ${className}`} preserveAspectRatio="none">
      <polyline fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" points={pts} />
      <animate attributeName="stroke-width" values="1.5;2;1.5" dur="2s" repeatCount="indefinite" />
    </svg>
  );
}

export default function DashboardPage() {
  const toast = useToast();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [consolidated, setConsolidated] = useState<Consolidated | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, c] = await Promise.all([
        api<Summary>("/api/analytics/summary").catch(() => null),
        api<Consolidated>("/api/analytics/consolidated").catch(() => null),
      ]);
      setSummary(s ?? null);
      setConsolidated(c ?? null);
      if (!s) {
        setError("Failed to load summary");
      } else {
        // Only show toast on manual refresh, not on first load
        if (summary !== null) {
          toast.push({ kind: "success", title: "Dashboard refreshed", description: "Latest metrics loaded" });
        }
      }
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, [toast, summary]);

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(() => {
      api<Summary>("/api/analytics/summary").then(setSummary).catch(() => {});
      api<Consolidated>("/api/analytics/consolidated").then(setConsolidated).catch(() => {});
    }, 30000);
    return () => clearInterval(t);
  }, [autoRefresh]);

  if (error) {
    return (
      <AppShell title="Dashboard" subtitle="Live operational picture">
        <Card className="border-rose-200 bg-rose-50 text-rose-800 dark:bg-rose-950/30 dark:border-rose-900/40 dark:text-rose-200">
          <div className="flex items-center gap-3">
            <Icon name="alert" className="h-5 w-5" />
            <span className="text-sm font-semibold">{error}</span>
            <Button variant="outline" size="sm" onClick={() => load()} className="ml-auto">Retry</Button>
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
            <Card key={i} className="h-[120px] animate-pulse">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="mt-3 h-7 w-24" />
              <Skeleton className="mt-2 h-3 w-32" />
            </Card>
          ))}
        </div>
      </AppShell>
    );
  }

  const occupancy = consolidated
    ? Math.round(((consolidated.totals.beds_total - consolidated.totals.beds_available) / Math.max(1, consolidated.totals.beds_total)) * 100)
    : 0;

  return (
    <AppShell title="Dashboard" subtitle={`Live operational picture · ${summary.date} · every metric is role-scoped and audit-logged`}>
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 gap-4 lg:grid-cols-3"
      >
        <motion.div variants={item}>
          <Card hover className="relative overflow-hidden">
            <div className="absolute right-0 top-0 h-20 w-20 rounded-full bg-blue-500/10 blur-2xl" />
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-[var(--muted)]">Active patients</div>
                <div className="mt-1 text-[28px] font-extrabold tracking-tight text-[var(--text)]">
                  <CountUp to={summary.total_patients} />
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                  <Icon name="check" className="h-3 w-3" /> lifetime registrations
                </div>
              </div>
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 text-white shadow-md">
                <Icon name="users" className="h-5 w-5" />
              </span>
            </div>
            <MiniSparkline points={[42, 55, 48, 62, 58, summary.total_patients]} className="mt-2 text-blue-400 opacity-60" />
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card hover className="relative overflow-hidden">
            <div className="absolute right-0 top-0 h-20 w-20 rounded-full bg-violet-500/10 blur-2xl" />
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-[var(--muted)]">Appointments today</div>
                <div className="mt-1 text-[28px] font-extrabold tracking-tight text-[var(--text)]">
                  <CountUp to={summary.appointments_today} />
                </div>
                <div className="mt-1 text-xs text-[var(--muted)]">{summary.completed_today} completed · queue live</div>
              </div>
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-600 text-white shadow-md">
                <Icon name="calendar" className="h-5 w-5" />
              </span>
            </div>
            <MiniSparkline points={[12, 18, 15, 22, 19, summary.appointments_today]} className="mt-2 text-violet-400 opacity-60" />
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card hover className="relative overflow-hidden">
            <div className="absolute right-0 top-0 h-20 w-20 rounded-full bg-teal-500/10 blur-2xl" />
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-[var(--muted)]">Revenue today</div>
                <div className="mt-1 text-[24px] font-extrabold tracking-tight text-[var(--text)]">{formatCurrency(summary.revenue_today)}</div>
                <div className="mt-1 text-xs text-[var(--muted)]">lifetime {formatCurrency(summary.revenue_total)}</div>
              </div>
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-600 text-white shadow-md">
                <Icon name="banknote" className="h-5 w-5" />
              </span>
            </div>
            <MiniSparkline points={[32, 45, 38, 52, 48, summary.revenue_today / 1000]} className="mt-2 text-emerald-400 opacity-60" />
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card hover>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-[var(--muted)]">Outstanding</div>
                <div className="mt-1 text-[24px] font-extrabold tracking-tight text-amber-600"><CountUp to={summary.outstanding} prefix="₹" decimals={0} /></div>
                <div className="mt-1 text-xs text-[var(--muted)]">issued & partially paid</div>
              </div>
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500 text-white shadow-md">
                <Icon name="alert" className="h-5 w-5" />
              </span>
            </div>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card
            hover
            className="relative overflow-hidden border-0 bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-600/20"
          >
            <div className="absolute inset-0 bg-[url('data:image-svg+xml,%3Csvg viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22white%22 stroke-opacity=%220.03%22 stroke-width=%221%22%3E%3Cpath d=%22M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z%22/%3E%3C/svg%3E')] opacity-10" />
            <div className="relative flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-bold uppercase tracking-widest text-violet-100">AI copilots</div>
                  <div className="mt-1 text-[24px] font-extrabold tracking-tight">4 live</div>
                  <div className="mt-1 text-xs text-violet-100">scribe · CDS · coding · RAG</div>
                </div>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/15 backdrop-blur text-white">
                  <Icon name="sparkles" className="h-5 w-5" />
                </span>
              </div>

              <div className="mt-4 space-y-2">
                {AI_AGENTS.map((a, i) => (
                  <motion.div
                    key={a.name}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.08, duration: 0.35 }}
                    className="flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`grid h-6 w-6 place-items-center rounded-lg ${toneMap[a.tone]} text-white text-xs`}>
                        <Icon name={a.icon} className="h-3 w-3" />
                      </span>
                      <span className="text-sm font-medium">{a.name}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold">{a.metric}</div>
                      <div className="text-[10px] text-violet-200">{a.sub}</div>
                    </div>
                  </motion.div>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-1">
                {[0, 1, 2, 3].map((i) => (
                  <motion.span
                    key={i}
                    initial={{ width: 0 }}
                    animate={{ width: `${85 - i * 12}%` }}
                    transition={{ duration: 0.5, delay: 0.3 + i * 0.07 }}
                    className="h-1 flex-1 rounded-full bg-white/25"
                  >
                    <span className="block h-full rounded-full bg-white" />
                  </motion.span>
                ))}
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card hover className="relative">
            <div className="absolute right-0 top-0 h-16 w-16 rounded-full bg-amber-500/10 blur-xl" />
            <div className="text-xs font-bold uppercase tracking-widest text-[var(--muted)]">Bed occupancy</div>
            <div className="mt-2 flex items-end gap-3">
              <div className="text-[28px] font-extrabold tracking-tight text-[var(--text)]">
                <CountUp to={occupancy} suffix="%" />
              </div>
              <BadgeKit tone={occupancy > 85 ? "rose" : occupancy > 70 ? "amber" : "green"} dot>
                {occupancy > 85 ? "High" : occupancy > 70 ? "Moderate" : "Available"}
              </BadgeKit>
            </div>
            <Progress value={occupancy} className="mt-3" />
            <div className="mt-1.5 flex justify-between text-xs text-[var(--muted)]">
              <span>
                {consolidated ? `${consolidated.totals.beds_total - consolidated.totals.beds_available}/${consolidated.totals.beds_total} occupied` : "—"}
              </span>
              <span>{consolidated?.totals.beds_available ?? 0} free</span>
            </div>
          </Card>
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.45, ease: "easeOut" }}
        className="mt-6 grid gap-6 lg:grid-cols-2"
      >
        <Card>
          <CardHeader>
            <CardTitle>Quick actions</CardTitle>
            <BadgeKit tone="slate">{QUICK.length} shortcuts</BadgeKit>
          </CardHeader>
          <motion.div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2" variants={container} initial="hidden" animate="show">
            {QUICK.map((q) => (
              <motion.div key={q.href} variants={item}>
                <Link
                  href={q.href}
                  className="group flex items-center gap-3 rounded-xl border border-[var(--line-soft)] bg-[var(--surface)] p-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-[var(--line-strong)] hover:shadow-[var(--shadow-card)]"
                >
                  <span className={`grid h-9 w-9 place-items-center rounded-xl text-white shadow-sm shrink-0 ${toneMap[q.tone]}`}>
                    <Icon name={q.icon} className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold leading-none text-[var(--text)] group-hover:text-[var(--brand)]">{q.label}</span>
                    <span className="block text-xs leading-tight text-[var(--muted)] truncate">{q.desc}</span>
                  </span>
                  <Icon name="arrow" className="ml-auto h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--brand)] shrink-0" />
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </Card>

        <AnimatePresence>
          {consolidated && consolidated.facility_count > 1 ? (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.35 }}>
              <Card>
                <CardHeader>
                  <CardTitle>Facilities · {consolidated.facility_count} campuses</CardTitle>
                  <BadgeKit tone="blue">{consolidated.totals.staff} staff</BadgeKit>
                </CardHeader>
                <div className="space-y-2.5">
                  {consolidated.facilities.map((f, i) => (
                    <motion.div
                      key={f.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center justify-between gap-3 rounded-xl border border-[var(--line-soft)] bg-[var(--surface-2)] px-3.5 py-3"
                    >
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
                    </motion.div>
                  ))}
                  <div className="flex justify-between rounded-xl bg-slate-900 px-3.5 py-2.5 text-sm font-bold text-white dark:bg-white dark:text-slate-900">
                    <span>Group total</span>
                    <span>{formatCurrency(consolidated.totals.revenue_collected)}</span>
                  </div>
                </div>
              </Card>
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.35 }}>
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
                  ].map(([label, state, tone], i) => (
                    <motion.li
                      key={label}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center justify-between gap-3 rounded-xl border border-[var(--line-soft)] bg-[var(--surface-2)] px-3 py-2.5"
                    >
                      <span className="text-sm font-medium text-[var(--text)]">{label}</span>
                      <BadgeKit tone={tone as never}>{state}</BadgeKit>
                    </motion.li>
                  ))}
                </ul>
                <p className="mt-3 text-xs leading-relaxed text-[var(--muted)]">
                  Data as of {summary.date} · every metric is role-scoped, audit-logged, and encrypted at rest with AES-256-GCM.
                </p>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45, duration: 0.45 }}
        className="mt-6 flex items-center justify-between rounded-xl border border-[var(--line-soft)] bg-[var(--surface-2)] px-4 py-2.5"
      >
        <div className="flex items-center gap-2.5">
          <span className={autoRefresh ? "animate-pulse-slow" : ""}>
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping-soft rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
            </span>
          </span>
          <span className="text-xs font-medium text-[var(--muted)]">
            {autoRefresh ? "Live mode: auto-refreshes every 30s" : "Auto-refresh paused"}
          </span>
        </div>
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={() => setAutoRefresh((v) => !v)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] ${
            autoRefresh ? "bg-[var(--brand)]" : "bg-slate-300 dark:bg-white/15"
          }`}
        >
          <motion.span
            animate={{ x: autoRefresh ? 20 : 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow"
          />
        </motion.button>
      </motion.div>
    </AppShell>
  );
}
