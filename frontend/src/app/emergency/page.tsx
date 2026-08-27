"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import AppShell from "@/components/AppShell";
import { Alert, Badge, EmptyRow, StatCard, StatusBadge } from "@/components/ui";
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

export default function EmergencyPage() {
  const [board, setBoard] = useState<Board | null>(null);
  const [selected, setSelected] = useState<EdVisit | null>(null);
  const [q, setQ] = useState("");
  const [matches, setMatches] = useState<PatientBrief[]>([]);
  const [complaint, setComplaint] = useState("");
  const [esi, setEsi] = useState(3);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const role = typeof window === "undefined" ? "" : currentUser()?.role ?? "";

  const load = useCallback(async () => {
    try { setBoard(await api<Board>("/api/ed/board")); } catch (e) { setError(e instanceof Error ? e.message : "Failed to load board"); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const allVisits = useMemo(() => board ? Object.values(board.columns).flat() : [], [board]);

  async function act(path: string, body?: unknown, okMsg = "Done") {
    setBusy(true); setError(null); setMessage(null);
    try {
      const res = await api<EdVisit>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined });
      setMessage(okMsg);
      setSelected(res);
      await load();
      return res;
    } catch (e) { setError(e instanceof Error ? e.message : "Action failed"); } finally { setBusy(false); }
  }

  async function search() {
    if (q.trim().length < 2) return;
    try { const data = await api<{ items: PatientBrief[] }>(`/api/patients?page_size=8&q=${encodeURIComponent(q.trim())}`); setMatches(data.items); } catch (e) { setError(e instanceof Error ? e.message : "Search failed"); }
  }

  async function registerVisit(patientId: number) {
    setBusy(true); setError(null);
    try {
      await api("/api/ed/visits", { method: "POST", body: JSON.stringify({ patient_id: patientId, chief_complaint: complaint || undefined }) });
      setMessage("Casualty visit registered"); setComplaint(""); setQ(""); setMatches([]); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Register failed"); } finally { setBusy(false); }
  }

  const canRegister = ["RECEPTIONIST", "NURSE", "DOCTOR", "FACILITY_ADMIN", "SUPER_ADMIN"].includes(role);
  const canTriage = ["NURSE", "DOCTOR"].includes(role);
  const canAdvance = ["NURSE", "DOCTOR"].includes(role);
  const canMlc = ["DOCTOR", "FACILITY_ADMIN", "SUPER_ADMIN"].includes(role);
  const canDispose = role === "DOCTOR";

  return (
    <AppShell title="Emergency — ED Tracking Board" subtitle="Arrival → Triage → Doctor → Diagnostics → Disposition · ESI colour, MLC guard, wait-time clock">
      {board && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Active" value={String(board.stats.active)} sub="open visits" icon="activity" tone="blue" />
          <StatCard label="Critical (ESI 1-2)" value={String(board.stats.critical_open)} sub="needs immediate MD" icon="alert" tone="rose" />
          <StatCard label="MLC open" value={String(board.stats.mlc_open)} sub="medico-legal" icon="shield" tone="amber" />
          <StatCard label="Longest wait" value={`${board.stats.longest_wait_minutes}m`} sub="oldest active" icon="clock" tone="slate" />
          <StatCard label="Disposed today" value={String(board.stats.disposed_today)} sub="closed" icon="check" tone="green" />
        </div>
      )}

      {canRegister && (
        <div className="card mt-5 flex flex-wrap gap-2 p-3">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search patient by name/MRN" className="min-w-[180px] flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
          <button onClick={search} className="btn-ghost px-3 py-1.5 text-sm" disabled={busy}>Search</button>
          <input value={complaint} onChange={(e) => setComplaint(e.target.value)} placeholder="Chief complaint" className="min-w-[180px] flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
          {matches.length > 0 && (
            <div className="flex w-full flex-wrap gap-1.5">
              {matches.map((m) => <button key={m.id} onClick={() => registerVisit(m.id)} className="chip border border-slate-200 bg-white text-xs hover:border-blue-400" disabled={busy}>{m.full_name} — {m.mrn}</button>)}
            </div>
          )}
        </div>
      )}

      {error && <div className="mt-4"><Alert kind="error">{error}</Alert></div>}
      {message && <div className="mt-4"><Alert kind="success">{message}</Alert></div>}

      <div className="mt-5 grid gap-4 xl:grid-cols-5">
        {STAGES.map((stage) => {
          const visits = board?.columns[stage.key] ?? [];
          return (
            <div key={stage.key} className="card p-0">
              <div className="border-b border-slate-100 px-3 py-2.5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{stage.label}</div>
                <div className="text-xs text-slate-500">{visits.length} {visits.length === 1 ? "visit" : "visits"}</div>
              </div>
              <div className="space-y-2 p-2">
                {visits.length === 0 && <div className="py-6 text-center text-xs text-slate-400">Empty</div>}
                {visits.map((v) => (
                  <button key={v.id} onClick={() => setSelected(selected?.id === v.id ? null : v)} className={`w-full rounded-xl border px-3 py-2.5 text-left transition-colors ${selected?.id === v.id ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white hover:border-slate-300"} ${v.esi_level !== null && v.esi_level <= 2 ? "ring-1 ring-rose-200" : ""}`}>
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-semibold text-slate-800">{v.patient_name}</span>
                      {v.mlc_flag && <Badge tone="amber">MLC</Badge>}
                      {v.esi_level !== null && <Badge tone={v.esi_level <= 2 ? "rose" : v.esi_level === 3 ? "amber" : "slate"}>ESI {v.esi_level}</Badge>}
                    </div>
                    <div className="truncate text-xs text-slate-500">{v.chief_complaint || "—"} · {v.arrival_mode}</div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                      <span>{v.wait_minutes}m wait</span><span>·</span><span>#{v.id}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {selected && (
        <div className="card mt-5 animate-fadeUp">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Visit #{selected.id} — {selected.patient_name} <span className="font-normal text-slate-400">{selected.mrn}</span></h2>
              <p className="mt-0.5 text-sm text-slate-500">Arrived {fmt(selected.created_at)} · {selected.arrival_mode} · {selected.chief_complaint ?? "no complaint noted"} {selected.blood_group && `· ${selected.blood_group}`} {selected.allergies && `· allergy: ${selected.allergies}`}</p>
              <p className="mt-1 text-xs text-slate-400">ESI {selected.esi_level ?? "—"} · wait {selected.wait_minutes}m · {selected.status}{selected.disposition ? ` → ${selected.disposition}` : ""}</p>
            </div>
            <div className="flex items-center gap-2"><StatusBadge status={selected.status} />{selected.mlc_flag && <Badge tone="amber">MLC</Badge>}</div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            {canTriage && selected.status === "REGISTERED" && (
              <div className="flex items-center gap-2">
                <select value={esi} onChange={(e) => setEsi(Number(e.target.value))} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"><option value={1}>ESI 1 — resuscitation</option><option value={2}>ESI 2 — emergent</option><option value={3}>ESI 3 — urgent</option><option value={4}>ESI 4 — less urgent</option><option value={5}>ESI 5 — non-urgent</option></select>
                <button onClick={() => act(`/api/ed/visits/${selected.id}/triage`, { esi_level: esi }, `Triaged ESI ${esi}`)} className="btn-primary px-3 py-1.5 text-sm" disabled={busy}>Triage</button>
              </div>
            )}
            {canAdvance && ["TRIAGED", "WITH_DOCTOR"].includes(selected.status) && <button onClick={() => act(`/api/ed/visits/${selected.id}/advance`, undefined, "Moved to next stage")} className="btn-primary px-3 py-1.5 text-sm" disabled={busy}>Advance stage</button>}
            {canMlc && <button onClick={() => act(`/api/ed/visits/${selected.id}/mlc`, { mlc_flag: !selected.mlc_flag }, selected.mlc_flag ? "MLC cleared" : "Flagged MLC")} className={`btn-ghost px-3 py-1.5 text-sm ${selected.mlc_flag ? "text-amber-700" : ""}`} disabled={busy}>{selected.mlc_flag ? "Clear MLC flag" : "Flag MLC"}</button>}
            {canDispose && selected.status !== "REGISTERED" && selected.status !== "DISPOSED" && (
              <div className="flex flex-wrap gap-1.5">
                {(["DISCHARGED", "ADMITTED", "LAMA", "EXPIRED", "REFERRED"] as const).map((d) => (
                  <button key={d} onClick={() => act(`/api/ed/visits/${selected.id}/disposition`, { disposition: d }, `Disposed: ${d}`)} className="chip border border-slate-200 bg-white text-xs hover:border-blue-400" disabled={busy}>{d}</button>
                ))}
              </div>
            )}
            <button onClick={load} className="btn-ghost ml-auto px-3 py-1.5 text-sm" disabled={busy}>Refresh board</button>
          </div>
        </div>
      )}

      {!board && !error && <div className="mt-6 flex items-center gap-2 text-sm text-slate-400"><span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" /> Loading board…</div>}
    </AppShell>
  );
}
