"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import AppShell from "@/components/AppShell";
import { Alert, Badge, EmptyRow, StatCard, StatusBadge } from "@/components/ui";
import { api, currentUser } from "@/lib/api";

type RadOrder = {
  id: number;
  patient_id: number;
  encounter_id: number | null;
  priority: string;
  status: string;
  clinical_notes: string | null;
  ordered_at: string;
  scheduled_at: string | null;
  acquired_at: string | null;
  preliminary_at: string | null;
  finalized_at: string | null;
  prelim_report: string | null;
  final_report: string | null;
  ai_flag: string | null;
  ai_priority: boolean;
  modality: string;
  procedure_code: string;
  procedure_name: string;
  reported_by: string;
};

type PatientBrief = { id: number; mrn: string; full_name: string };

const STATUS_TABS = ["ALL", "ORDERED", "SCHEDULED", "ACQUIRED", "PRELIMINARY", "FINAL"] as const;
const MODALITIES = ["ALL", "XRAY", "CT", "MRI", "US", "MAMMO"] as const;

const PRIORITY_TONES = {
  STAT: "rose",
  URGENT: "amber",
  ROUTINE: "slate",
} as const;

function fmt(dt: string | null): string {
  if (!dt) return "—";
  return new Date(dt).toLocaleString(undefined, {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export default function RadiologyPage() {
  const [orders, setOrders] = useState<RadOrder[]>([]);
  const [patients, setPatients] = useState<Record<number, PatientBrief>>({});
  const [statusTab, setStatusTab] = useState<(typeof STATUS_TABS)[number]>("ALL");
  const [modality, setModality] = useState<(typeof MODALITIES)[number]>("ALL");
  const [selected, setSelected] = useState<RadOrder | null>(null);
  const [slot, setSlot] = useState("");
  const [report, setReport] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const role = typeof window === "undefined" ? "" : currentUser()?.role ?? "";

  const load = useCallback(async () => {
    try {
      const [o, p] = await Promise.all([
        api<RadOrder[]>("/api/rad/orders"),
        api<{ items: PatientBrief[] }>("/api/patients?page_size=200"),
      ]);
      setOrders(o);
      setPatients(Object.fromEntries(p.items.map((x) => [x.id, x])));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load worklist");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(
    () =>
      orders.filter(
        (o) =>
          (statusTab === "ALL" || o.status === statusTab) &&
          (modality === "ALL" || o.modality === modality),
      ),
    [orders, statusTab, modality],
  );

  const stats = useMemo(() => {
    const count = (s: string[]) => orders.filter((o) => s.includes(o.status)).length;
    return {
      pending: count(["ORDERED", "SCHEDULED"]),
      reporting: count(["ACQUIRED", "PRELIMINARY"]),
      stat: orders.filter((o) => o.priority === "STAT" && o.status !== "FINAL").length,
      final: count(["FINAL"]),
      aiFlagged: orders.filter((o) => o.ai_priority).length,
    };
  }, [orders]);

  async function act(path: string, body?: unknown, okMsg = "Done") {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api(path, { method: "POST", body: body ? JSON.stringify(body) : undefined });
      setMessage(okMsg);
      setSelected(null);
      setReport("");
      setSlot("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  function selectOrder(o: RadOrder) {
    setSelected(selected?.id === o.id ? null : o);
    setReport(o.prelim_report ?? "");
    setError(null);
    setMessage(null);
  }

  async function schedule(o: RadOrder) {
    if (!slot) {
      setError("Pick a slot date/time first");
      return;
    }
    await act(`/api/rad/orders/${o.id}/schedule`, { scheduled_at: new Date(slot).toISOString() }, `Study #${o.id} scheduled`);
  }

  async function submitPrelim(o: RadOrder) {
    if (report.trim().length < 5) {
      setError("Report text is too short");
      return;
    }
    await act(`/api/rad/orders/${o.id}/prelim`, { report: report.trim() }, `Preliminary report saved for study #${o.id}`);
  }

  async function finalize(o: RadOrder) {
    await act(`/api/rad/orders/${o.id}/finalize`, report.trim() ? { report: report.trim() } : undefined, `Study #${o.id} signed out as FINAL`);
  }

  async function aiFlag(o: RadOrder) {
    await act(`/api/rad/orders/${o.id}/ai-flag`, { finding: "Imaging Triage AI: priority finding flagged for review", priority: true }, `AI triage flag applied to study #${o.id}`);
  }

  const canOperate = ["RAD_TECH"].includes(role);
  const canReport = ["RADIOLOGIST"].includes(role);
  const canFlag = ["RAD_TECH", "FACILITY_ADMIN", "SUPER_ADMIN"].includes(role);

  return (
    <AppShell title="Radiology — RIS Worklist" subtitle="Modality orders · technologist workflow · radiologist sign-off (AI flags are advisory, never auto-finalized)">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Pending" value={String(stats.pending)} sub="Ordered + scheduled" icon="clock" tone="blue" />
        <StatCard label="Awaiting report" value={String(stats.reporting)} sub="Acquired / preliminary" icon="scan" tone="amber" />
        <StatCard label="STAT open" value={String(stats.stat)} sub="Priority studies" icon="alert" tone="rose" />
        <StatCard label="Final reports" value={String(stats.final)} sub="Signed out" icon="check" tone="green" />
        <StatCard label="AI flagged" value={String(stats.aiFlagged)} sub="Triage markers" icon="sparkles" tone="purple" />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {STATUS_TABS.map((t) => (
          <button
            key={t}
            onClick={() => setStatusTab(t)}
            className={`chip border ${statusTab === t ? "border-blue-500 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"}`}
          >
            {t === "ALL" ? "All" : t.replaceAll("_", " ")}
          </button>
        ))}
        <select
          value={modality}
          onChange={(e) => setModality(e.target.value as (typeof MODALITIES)[number])}
          className="ml-auto rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700"
        >
          {MODALITIES.map((m) => (
            <option key={m} value={m}>{m === "ALL" ? "All modalities" : m}</option>
          ))}
        </select>
        <button onClick={load} className="btn-ghost px-3 py-1.5 text-sm" disabled={busy}>
          Refresh
        </button>
      </div>

      {error && <div className="mt-4"><Alert kind="error">{error}</Alert></div>}
      {message && <div className="mt-4"><Alert kind="success">{message}</Alert></div>}

      <div className="card mt-4 overflow-x-auto p-0">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
              <th className="td">Study</th>
              <th className="td">Patient</th>
              <th className="td">Priority</th>
              <th className="td">Status</th>
              <th className="td">Slot</th>
              <th className="td">Reported by</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <EmptyRow colSpan={6} text="No studies match this filter." />}
            {filtered.map((o) => (
              <tr
                key={o.id}
                onClick={() => selectOrder(o)}
                className={`cursor-pointer border-b border-slate-50 transition-colors hover:bg-blue-50/40 ${selected?.id === o.id ? "bg-blue-50" : ""}`}
              >
                <td className="td">
                  <div className="font-semibold text-slate-800">{o.procedure_name}</div>
                  <div className="text-xs text-slate-400">{o.modality} · #{o.id}</div>
                </td>
                <td className="td">
                  <div className="text-slate-700">{patients[o.patient_id]?.full_name ?? `Patient #${o.patient_id}`}</div>
                  <div className="text-xs text-slate-400">{patients[o.patient_id]?.mrn ?? ""}</div>
                </td>
                <td className="td">
                  <Badge tone={PRIORITY_TONES[o.priority as keyof typeof PRIORITY_TONES] ?? "slate"}>{o.priority}</Badge>
                </td>
                <td className="td">
                  <div className="flex items-center gap-1.5">
                    <StatusBadge status={o.status} />
                    {o.ai_priority && <Badge tone="purple">AI flag</Badge>}
                  </div>
                </td>
                <td className="td text-slate-600">{fmt(o.scheduled_at)}</td>
                <td className="td text-slate-600">{o.reported_by || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="card mt-5 animate-fadeUp">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Study #{selected.id} — {selected.procedure_name}
              </h2>
              <p className="mt-0.5 text-sm text-slate-500">
                {patients[selected.patient_id]?.full_name ?? `Patient #${selected.patient_id}`} ·{" "}
                {selected.modality} · ordered {fmt(selected.ordered_at)}
                {selected.clinical_notes ? ` · indication: ${selected.clinical_notes}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={selected.status} />
              {selected.ai_priority && <Badge tone="purple">AI triage</Badge>}
            </div>
          </div>

          {selected.ai_flag && (
            <div className="mt-3"><Alert kind="warn">
              <span className="font-semibold">AI-generated flag:</span> {selected.ai_flag} — advisory only; a radiologist decides.
            </Alert></div>
          )}

          {(selected.prelim_report || selected.final_report) && (
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {selected.prelim_report && (
                <div className="rounded-xl border border-purple-200 bg-purple-50 p-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-purple-700">Preliminary · {fmt(selected.preliminary_at)}</div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{selected.prelim_report}</p>
                </div>
              )}
              {selected.final_report && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-emerald-700">Final · {fmt(selected.finalized_at)}</div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{selected.final_report}</p>
                </div>
              )}
            </div>
          )}

          <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
            {canOperate && selected.status === "ORDERED" && (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="datetime-local"
                  value={slot}
                  onChange={(e) => setSlot(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
                />
                <button onClick={() => schedule(selected)} className="btn-primary px-4 py-1.5 text-sm" disabled={busy}>
                  Schedule slot
                </button>
              </div>
            )}

            {canOperate && selected.status === "SCHEDULED" && (
              <button onClick={() => act(`/api/rad/orders/${selected.id}/acquire`, undefined, `Images acquired for study #${selected.id}`)} className="btn-primary px-4 py-1.5 text-sm" disabled={busy}>
                Mark images acquired
              </button>
            )}

            {canReport && selected.status === "ACQUIRED" && (
              <div className="space-y-2">
                <textarea
                  value={report}
                  onChange={(e) => setReport(e.target.value)}
                  rows={4}
                  placeholder="Structured findings + impression…"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                />
                <button onClick={() => submitPrelim(selected)} className="btn-primary px-4 py-1.5 text-sm" disabled={busy}>
                  Save preliminary report
                </button>
              </div>
            )}

            {canReport && selected.status === "PRELIMINARY" && (
              <div className="space-y-2">
                <textarea
                  value={report}
                  onChange={(e) => setReport(e.target.value)}
                  rows={4}
                  placeholder="Edit before sign-off (optional — defaults to preliminary text)"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                />
                <button onClick={() => finalize(selected)} className="btn-primary px-4 py-1.5 text-sm" disabled={busy}>
                  Sign out final report
                </button>
              </div>
            )}

            {canFlag && !["FINAL", "CANCELLED"].includes(selected.status) && (
              <button onClick={() => aiFlag(selected)} className="btn-ghost px-3 py-1.5 text-sm text-purple-700" disabled={busy}>
                Simulate imaging-AI triage flag
              </button>
            )}

            {!canOperate && !canReport && (
              <p className="text-sm text-slate-400">Your role has read access to the worklist.</p>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}

