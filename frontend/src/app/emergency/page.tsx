"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";

import AppShell from "@/components/AppShell";
import { Alert, StatCard, StatusBadge } from "@/components/ui";
import { BadgeKit, Button, Card, CardHeader, CardTitle, Input, useToast } from "@/components/kit";
import { api, currentUser } from "@/lib/api";

type EdVisit = {
  id: number; patient_id: number; patient_name: string; mrn: string; blood_group: string; allergies: string;
  arrival_mode: string; esi_level: number | null; chief_complaint: string | null; status: string; mlc_flag: boolean;
  created_at: string; triaged_at: string | null; doctor_at: string | null; diagnostics_at: string | null; disposed_at: string | null;
  disposition: string | null; wait_minutes: number;
};
type PatientBrief = { id: number; mrn: string; full_name: string };
type Board = { columns: Record<string, EdVisit[]>; stats: { active: number; critical_open: number; mlc_open: number; longest_wait_minutes: number; disposed_today: number } };

const STAGES: { key: string; label: string }[] = [
  { key: "REGISTERED", label: "Registered" },
  { key: "TRIAGED", label: "Triaged" },
  { key: "WITH_DOCTOR", label: "With Doctor" },
  { key: "DIAGNOSTICS", label: "Diagnostics" },
  { key: "DISPOSED", label: "Disposed" },
];

function fmt(dt: string | null): string {
  if (!dt) return "—";
  return new Date(dt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

const container: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
};

export default function EmergencyPage() {
  const toast = useToast();
  const [board, setBoard] = useState<Board | null>(null);
  const [selected, setSelected] = useState<EdVisit | null>(null);
  const [q, setQ] = useState("");
  const [matches, setMatches] = useState<PatientBrief[]>([]);
  const [complaint, setComplaint] = useState("");
  const [esi, setEsi] = useState(3);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [loading, setLoading] = useState(true);

  const role = typeof window === "undefined" ? "" : currentUser()?.role ?? "";

  const load = useCallback(async () => {
    try {
      setBoard(await api<Board>("/api/ed/board"));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load board");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(() => {
      if (autoRefresh) load();
    }, 30000);
    return () => clearInterval(id);
  }, [load, autoRefresh]);

  const allVisits = useMemo(() => board ? Object.values(board.columns).flat() : [], [board]);

  async function act(path: string, body?: unknown, okMsg = "Done") {
    setBusy(true);
    try {
      const res = await api<EdVisit>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined });
      toast.push({ kind: "success", title: "Action complete", description: okMsg });
      setSelected(res);
      await load();
      return res;
    } catch (e) {
      toast.push({ kind: "error", title: "Action failed", description: e instanceof Error ? e.message : "Try again" });
    } finally {
      setBusy(false);
    }
  }

  async function search() {
    if (q.trim().length < 2) return;
    try {
      const data = await api<{ items: PatientBrief[] }>(`/api/patients?page_size=8&q=${encodeURIComponent(q.trim())}`);
      setMatches(data.items);
    } catch (e) {
      toast.push({ kind: "error", title: "Search failed", description: e instanceof Error ? e.message : "Try again" });
    }
  }

  async function registerVisit(patientId: number) {
    setBusy(true);
    try {
      await api("/api/ed/visits", { method: "POST", body: JSON.stringify({ patient_id: patientId, chief_complaint: complaint || undefined }) });
      toast.push({ kind: "success", title: "Visit registered", description: "Casualty visit registered" });
      setComplaint(""); setQ(""); setMatches([]);
      await load();
    } catch (e) {
      toast.push({ kind: "error", title: "Register failed", description: e instanceof Error ? e.message : "Try again" });
    } finally {
      setBusy(false);
    }
  }

  const canRegister = ["RECEPTIONIST", "NURSE", "DOCTOR", "FACILITY_ADMIN", "SUPER_ADMIN"].includes(role);
  const canTriage = ["NURSE", "DOCTOR"].includes(role);
  const canAdvance = ["NURSE", "DOCTOR"].includes(role);
  const canMlc = ["DOCTOR", "FACILITY_ADMIN", "SUPER_ADMIN"].includes(role);
  const canDispose = role === "DOCTOR";

  function esiTone(level: number): "blue" | "rose" | "amber" | "slate" {
    if (level <= 2) return "rose";
    if (level === 3) return "amber";
    return "slate";
  }

  return (
    <AppShell
      title="Emergency — ED Tracking Board"
      subtitle="Arrival → Triage → Doctor → Diagnostics → Disposition · ESI colour, MLC guard, wait-time clock"
    >
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: "easeOut" }}>
        {board && (
          <motion.div variants={container} initial="hidden" animate="show" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <motion.div variants={item}><StatCard label="Active" value={String(board.stats.active)} sub="open visits" icon="activity" tone="blue" /></motion.div>
            <motion.div variants={item}><StatCard label="Critical (ESI 1-2)" value={String(board.stats.critical_open)} sub="needs immediate MD" icon="alert" tone="rose" /></motion.div>
            <motion.div variants={item}><StatCard label="MLC open" value={String(board.stats.mlc_open)} sub="medico-legal" icon="shield" tone="amber" /></motion.div>
            <motion.div variants={item}><StatCard label="Longest wait" value={`${board.stats.longest_wait_minutes}m`} sub="oldest active" icon="clock" tone="slate" /></motion.div>
            <motion.div variants={item}><StatCard label="Disposed today" value={String(board.stats.disposed_today)} sub="closed" icon="check" tone="green" /></motion.div>
          </motion.div>
        )}

        <motion.div
          className="mt-5 flex items-center justify-between"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.35 }}
        >
          <div className="flex items-center gap-3 text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => {
                  setAutoRefresh(e.target.checked);
                  if (e.target.checked) toast.push({ kind: "info", title: "Auto-refresh ON", description: "Board updates every 30s" });
                }}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              Auto-refresh (30s)
            </label>
          </div>
        </motion.div>

        {canRegister && (
          <motion.div
            className="card mt-4 flex flex-wrap gap-2 p-3"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.35 }}
          >
            <Input
              placeholder="Search patient by name/MRN"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
              leftIcon="search"
              className="min-w-[180px] flex-1"
            />
            <Button variant="ghost" size="sm" onClick={search} loading={busy} leftIcon="search">Search</Button>
            <Input
              placeholder="Chief complaint"
              value={complaint}
              onChange={(e) => setComplaint(e.target.value)}
              className="min-w-[180px] flex-1"
            />
            <AnimatePresence>
              {matches.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="flex w-full flex-wrap gap-1.5"
                >
                  {matches.map((m) => (
                    <motion.button
                      key={m.id}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => registerVisit(m.id)}
                      className="chip border border-slate-200 bg-white text-xs hover:border-blue-400"
                      disabled={busy}
                    >
                      {m.full_name} — {m.mrn}
                    </motion.button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {error && <div className="mt-4"><Alert kind="error">{error}</Alert></div>}

        <motion.div
          className="mt-5 grid gap-4 xl:grid-cols-5"
          variants={container}
          initial="hidden"
          animate="show"
        >
          {STAGES.map((stage) => {
            const visits = board?.columns[stage.key] ?? [];
            return (
              <motion.div key={stage.key} variants={item} className="card p-0">
                <div className="border-b border-slate-100 px-3 py-2.5">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400">{stage.label}</div>
                  <div className="text-xs text-slate-500">{visits.length} {visits.length === 1 ? "visit" : "visits"}</div>
                </div>
                <div className="space-y-2 p-2">
                  {visits.length === 0 && <div className="py-6 text-center text-xs text-slate-400">Empty</div>}
                  <AnimatePresence>
                    {visits.map((v) => (
                      <motion.button
                        key={v.id}
                        layoutId={`visit-${v.id}`}
                        layout
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                        onClick={() => setSelected(selected?.id === v.id ? null : v)}
                        className={`group w-full rounded-xl border px-3 py-2.5 text-left transition-all ${
                          selected?.id === v.id
                            ? "border-blue-300 bg-blue-50"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        } ${v.esi_level !== null && v.esi_level <= 2 ? "ring-1 ring-rose-200" : ""}`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-semibold text-slate-800 group-hover:text-blue-700 transition-colors">{v.patient_name}</span>
                          {v.mlc_flag && <BadgeKit tone="amber" dot>MLC</BadgeKit>}
                          {v.esi_level !== null && (
                            <BadgeKit tone={esiTone(v.esi_level)} dot>ESI {v.esi_level}</BadgeKit>
                          )}
                        </div>
                        <div className="truncate text-xs text-slate-500">{v.chief_complaint || "—"} · {v.arrival_mode}</div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                          <span className="font-medium text-rose-600">{v.wait_minutes}m wait</span>
                          <span>·</span>
                          <span>#{v.id}</span>
                        </div>
                      </motion.button>
                    ))}
                  </AnimatePresence>
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        <AnimatePresence>
          {selected && (
            <motion.div
              layoutId={`visit-${selected.id}-panel`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="card mt-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Visit #{selected.id} — {selected.patient_name}
                    <span className="font-normal text-slate-400"> {selected.mrn}</span>
                  </h2>
                  <p className="mt-0.5 text-sm text-slate-500">
                    Arrived {fmt(selected.created_at)} · {selected.arrival_mode} · {selected.chief_complaint ?? "no complaint noted"}
                    {selected.blood_group && ` · ${selected.blood_group}`}
                    {selected.allergies && ` · allergy: ${selected.allergies}`}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    ESI {selected.esi_level ?? "—"} · wait {selected.wait_minutes}m · {selected.status}
                    {selected.disposition ? ` → ${selected.disposition}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={selected.status} />
                  {selected.mlc_flag && <BadgeKit tone="amber" dot>MLC</BadgeKit>}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                {canTriage && selected.status === "REGISTERED" && (
                  <div className="flex items-center gap-2">
                    <select
                      value={esi}
                      onChange={(e) => setEsi(Number(e.target.value))}
                      className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
                    >
                      <option value={1}>ESI 1 — resuscitation</option>
                      <option value={2}>ESI 2 — emergent</option>
                      <option value={3}>ESI 3 — urgent</option>
                      <option value={4}>ESI 4 — less urgent</option>
                      <option value={5}>ESI 5 — non-urgent</option>
                    </select>
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={() => act(`/api/ed/visits/${selected.id}/triage`, { esi_level: esi }, `Triaged ESI ${esi}`)}
                      className="btn-primary px-3 py-1.5 text-sm"
                      disabled={busy}
                    >
                      Triage
                    </motion.button>
                  </div>
                )}
                {canAdvance && ["TRIAGED", "WITH_DOCTOR"].includes(selected.status) && (
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => act(`/api/ed/visits/${selected.id}/advance`, undefined, "Moved to next stage")}
                    className="btn-primary px-3 py-1.5 text-sm"
                    disabled={busy}
                  >
                    Advance stage
                  </motion.button>
                )}
                {canMlc && (
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() =>
                      act(`/api/ed/visits/${selected.id}/mlc`, { mlc_flag: !selected.mlc_flag }, selected.mlc_flag ? "MLC cleared" : "Flagged MLC")
                    }
                    className={`btn-ghost px-3 py-1.5 text-sm ${selected.mlc_flag ? "text-amber-700" : ""}`}
                    disabled={busy}
                  >
                    {selected.mlc_flag ? "Clear MLC flag" : "Flag MLC"}
                  </motion.button>
                )}
                {canDispose && selected.status !== "REGISTERED" && selected.status !== "DISPOSED" && (
                  <div className="flex flex-wrap gap-1.5">
                    {(["DISCHARGED", "ADMITTED", "LAMA", "EXPIRED", "REFERRED"] as const).map((d) => (
                      <motion.button
                        key={d}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => act(`/api/ed/visits/${selected.id}/disposition`, { disposition: d }, `Disposed: ${d}`)}
                        className="chip border border-slate-200 bg-white text-xs hover:border-blue-400"
                        disabled={busy}
                      >
                        {d}
                      </motion.button>
                    ))}
                  </div>
                )}
                <button onClick={load} className="btn-ghost ml-auto px-3 py-1.5 text-sm" disabled={busy}>
                  {busy ? "Refreshing…" : "Refresh board"}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!board && !error && (
          <div className="mt-6 flex items-center gap-2 text-sm text-slate-400">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" /> Loading board…
          </div>
        )}
      </motion.div>
    </AppShell>
  );
}
