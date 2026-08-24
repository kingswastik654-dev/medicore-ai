"use client";

import { useCallback, useEffect, useState } from "react";

import AppShell from "@/components/AppShell";
import Icon from "@/components/Icon";
import { Alert, Badge, EmptyRow } from "@/components/ui";
import { api } from "@/lib/api";

type Ward = { id: number; name: string; code: string; floor?: string | null };
type Bed = {
  id: number; ward_id: number; ward_name: string; bed_no: string;
  bed_type: string; status: string; patient_name?: string | null; admission_id?: number | null;
};
type PatientBrief = { id: number; mrn: string; full_name: string };
type Forecast = {
  model: string;
  provider: string;
  predictions: { date: string; weekday: string; predicted_visits: number | null;
    range_low: number | null; range_high: number | null; confidence: string }[];
};
type BedSuggestion = {
  admission_id: number; patient_name: string; mrn: string; bed_no: string;
  los_days: number; score: number; ready: boolean; blockers: string[];
};
type DenialResult = {
  invoice_id: number; invoice_no?: string; tier: string; score: number;
  factors: { factor: string; risk: string; note: string }[];
  recommendation: string; disclaimer: string;
};
type ArRow = {
  invoice_id: number; invoice_no?: string; patient_name: string; outstanding: number;
  age_days: number; age_bucket: string; priority_score: number; suggested_action: string;
};

const TABS = ["Bed Board", "Forecast", "Revenue Cycle"] as const;

const BED_STYLES: Record<string, string> = {
  AVAILABLE: "border-emerald-300 bg-emerald-50 text-emerald-800 hover:border-emerald-500",
  OCCUPIED: "border-blue-300 bg-blue-50 text-blue-900 hover:border-blue-500",
  CLEANING: "border-amber-300 bg-amber-100 text-amber-900 hover:border-amber-500",
  MAINTENANCE: "border-slate-300 bg-slate-100 text-slate-500 hover:border-slate-400",
};

export default function OperationsPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Bed Board");

  const [wards, setWards] = useState<Ward[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [selected, setSelected] = useState<Bed | null>(null);
  const [admitFor, setAdmitFor] = useState<Bed | null>(null);
  const [patientQuery, setPatientQuery] = useState("");
  const [matches, setMatches] = useState<PatientBrief[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [forecast, setForecast] = useState<Forecast | null>(null);

  const [invoiceId, setInvoiceId] = useState("");
  const [denial, setDenial] = useState<DenialResult | null>(null);
  const [ar, setAr] = useState<ArRow[] | null>(null);

  const loadBoard = useCallback(async () => {
    try {
      const [w, b] = await Promise.all([
        api<Ward[]>("/api/ipd/wards"),
        api<Bed[]>("/api/ipd/beds"),
      ]);
      setWards(w);
      setBeds(b);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load board");
    }
  }, []);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  useEffect(() => {
    if (tab === "Forecast" && !forecast) {
      api<Forecast>("/api/ai/ops/forecast/opd?days=7").then(setForecast).catch(() => setForecast(null));
    }
    if (tab === "Revenue Cycle" && !ar) {
      api<{ priorities: ArRow[] }>("/api/ai/ops/rcm/ar-priorities")
        .then((r) => setAr(r.priorities))
        .catch(() => setAr([]));
    }
  }, [tab, forecast, ar]);

  async function searchPatients() {
    if (patientQuery.trim().length < 2) return;
    try {
      const data = await api<{ items: PatientBrief[] }>(
        `/api/patients?page_size=8&q=${encodeURIComponent(patientQuery.trim())}`
      );
      setMatches(data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    }
  }

  async function admit(bed: Bed, patient: PatientBrief) {
    setBusy(true);
    setError(null);
    try {
      await api("/api/ipd/admissions", {
        method: "POST",
        body: JSON.stringify({ patient_id: patient.id, bed_id: bed.id }),
      });
      setMessage(`${patient.full_name} admitted to ${bed.bed_no}`);
      setAdmitFor(null);
      setPatientQuery("");
      setMatches([]);
      await loadBoard();
      setSelected(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Admission failed");
    } finally {
      setBusy(false);
    }
  }

  async function discharge(bed: Bed) {
    if (!bed.admission_id) return;
    setBusy(true);
    try {
      await api(`/api/ipd/admissions/${bed.admission_id}/discharge`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      setMessage(`Discharged — ${bed.bed_no} is now cleaning`);
      setSelected(null);
      await loadBoard();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Discharge failed");
    } finally {
      setBusy(false);
    }
  }

  async function markReady(bed: Bed) {
    setBusy(true);
    try {
      await api(`/api/ipd/beds/${bed.id}/ready`, { method: "POST" });
      setMessage(`${bed.bed_no} marked available`);
      setSelected(null);
      await loadBoard();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function scoreDenial() {
    if (!invoiceId.trim()) return;
    setBusy(true);
    setError(null);
    try {
      setDenial(await api<DenialResult>(`/api/ai/ops/denials/score?invoice_id=${Number(invoiceId)}`, { method: "POST" }));
    } catch (e) {
      setDenial(null);
      setError(e instanceof Error ? e.message : "Scoring failed");
    } finally {
      setBusy(false);
    }
  }

  const grouped = beds.reduce<Record<string, Bed[]>>((acc, b) => {
    acc[b.ward_name] = [...(acc[b.ward_name] ?? []), b];
    return acc;
  }, {});

  const tierTone = (t: string): "rose" | "amber" | "green" =>
    t === "HIGH" ? "rose" : t === "MEDIUM" ? "amber" : "green";

  return (
    <AppShell title="Operations" subtitle="Bed management · demand forecast · revenue-cycle intelligence">
      {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}
      {message && <div className="mb-4"><Alert kind="success">{message}</Alert></div>}

      <div className="mb-6 flex gap-2">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`btn ${tab === t ? "bg-slate-900 text-white" : "btn-secondary"}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === "Bed Board" && (
        <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            {Object.entries(grouped).map(([wardName, wardBeds]) => (
              <div key={wardName} className="card">
                <div className="mb-3 flex items-center justify-between">
                  <div className="section-title">{wardName}</div>
                  <span className="hint">{wardBeds.filter((b) => b.status === "AVAILABLE").length}/{wardBeds.length} free</span>
                </div>
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
                  {wardBeds.map((b) => (
                    <button key={b.id} onClick={() => { setSelected(b); setAdmitFor(null); }}
                      title={`${b.bed_no} · ${b.status}${b.patient_name ? ` · ${b.patient_name}` : ""}`}
                      className={`rounded-lg border px-1 py-2.5 text-center transition-all ${BED_STYLES[b.status]} ${selected?.id === b.id ? "ring-2 ring-blue-500 ring-offset-1" : ""}`}>
                      <div className="text-xs font-bold">{b.bed_no}</div>
                      <div className="mt-0.5 truncate text-[10px] opacity-70">{b.patient_name ?? b.bed_type}</div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="card h-fit">
            {!selected && !admitFor && <p className="text-sm text-slate-400">Select a bed tile to view details &amp; actions.</p>}
            {admitFor && (
              <div>
                <div className="section-title mb-2">Admit to {admitFor.bed_no} ({admitFor.bed_type})</div>
                <div className="flex gap-2 mb-2">
                  <input className="input" placeholder="Find patient…" value={patientQuery}
                    onChange={(e) => setPatientQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && searchPatients()} />
                  <button className="btn-secondary" onClick={searchPatients}>Go</button>
                </div>
                <div className="space-y-1">
                  {matches.map((m) => (
                    <button key={m.id} disabled={busy}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-sm hover:bg-emerald-50"
                      onClick={() => admit(admitFor, m)}>
                      <span className="font-mono text-xs">{m.mrn}</span> · {m.full_name}
                    </button>
                  ))}
                </div>
                <button className="btn-secondary mt-3 w-full" onClick={() => { setAdmitFor(null); setMatches([]); }}>Cancel</button>
              </div>
            )}
            {selected && !admitFor && (
              <div>
                <div className="flex items-center justify-between">
                  <div className="section-title">Bed {selected.bed_no}</div>
                  <Badge tone={selected.status === "AVAILABLE" ? "green" : selected.status === "OCCUPIED" ? "blue" : selected.status === "CLEANING" ? "amber" : "slate"}>
                    {selected.status}
                  </Badge>
                </div>
                <dl className="mt-3 space-y-1.5 text-sm">
                  <div className="flex justify-between"><dt className="text-slate-400">Ward</dt><dd>{selected.ward_name}</dd></div>
                  <div className="flex justify-between"><dt className="text-slate-400">Type</dt><dd>{selected.bed_type}</dd></div>
                  {selected.patient_name && (
                    <div className="flex justify-between"><dt className="text-slate-400">Patient</dt><dd className="font-medium">{selected.patient_name}</dd></div>
                  )}
                </dl>
                <div className="mt-4 space-y-2">
                  {selected.status === "AVAILABLE" && (
                    <button className="btn-primary w-full" onClick={() => { setAdmitFor(selected); setPatientQuery(""); setMatches([]); }}>
                      <Icon name="plus" className="h-4 w-4" /> Admit patient here
                    </button>
                  )}
                  {selected.status === "OCCUPIED" && selected.admission_id && (
                    <button className="btn-danger w-full" disabled={busy} onClick={() => discharge(selected)}>
                      Discharge patient → cleaning
                    </button>
                  )}
                  {(selected.status === "CLEANING" || selected.status === "MAINTENANCE") && (
                    <button className="btn-primary w-full" disabled={busy} onClick={() => markReady(selected)}>
                      Mark available
                    </button>
                  )}
                </div>
                <p className="hint mt-4">Lifecycle: Available → Occupied → Cleaning → Available.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "Forecast" && (
        <div>
          {!forecast && <p className="text-sm text-slate-400">Loading forecast…</p>}
          {forecast && (
            <>
              <div className="card mb-4 flex flex-wrap items-center gap-3">
                <Icon name="sparkles" className="h-5 w-5 text-purple-600" />
                <span className="text-sm font-medium">Model: {forecast.model}</span>
                <span className="chip border border-purple-200 bg-purple-50 text-purple-700">{forecast.provider}</span>
                <span className="hint ml-auto">Predictions are advisory; staffing decisions stay with ward managers.</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {forecast.predictions.map((p) => (
                  <div key={p.date} className="card">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{p.weekday}</div>
                    <div className="text-xs text-slate-400">{p.date}</div>
                    {p.predicted_visits === null ? (
                      <div className="mt-2 text-lg text-slate-400">No data</div>
                    ) : (
                      <>
                        <div className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{p.predicted_visits}</div>
                        <div className="text-xs text-slate-500">expected visits ({p.range_low}–{p.range_high})</div>
                        <div className="mt-2 chip border border-blue-200 bg-blue-50 text-blue-600">confidence: {p.confidence}</div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {tab === "Revenue Cycle" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card">
            <div className="section-title mb-1">Denial risk scorer</div>
            <p className="hint mb-3">Scores an issued invoice for payer-denial risk factors before submission.</p>
            <div className="flex gap-2">
              <input className="input max-w-40" placeholder="Invoice ID" value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} />
              <button className="btn-primary" disabled={busy || !invoiceId} onClick={scoreDenial}>Score</button>
            </div>
            {denial && (
              <div className="mt-4 rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{denial.invoice_no ?? `Invoice #${denial.invoice_id}`}</span>
                  <Badge tone={tierTone(denial.tier)}>{denial.tier} · {denial.score}</Badge>
                </div>
                {denial.factors.length > 0 ? (
                  <ul className="mt-3 space-y-1.5">
                    {denial.factors.map((f) => (
                      <li key={f.factor} className="text-xs text-slate-600">
                        <b>{f.risk}</b> {f.note}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-emerald-600">No risk factors detected.</p>
                )}
                <p className="mt-3 rounded-lg bg-slate-50 p-2 text-xs text-slate-500"><b>Action:</b> {denial.recommendation}</p>
                <p className="mt-2 text-[11px] italic text-slate-400">{denial.disclaimer}</p>
              </div>
            )}
          </div>

          <div className="card overflow-x-auto">
            <div className="section-title mb-2">AR follow-up priorities</div>
            <table className="min-w-full divide-y divide-slate-200">
              <thead>
                <tr><th className="th">#</th><th className="th">Invoice</th><th className="th">Patient</th><th className="th">₹ Due</th><th className="th">Age</th><th className="th">Action</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(ar ?? []).map((r) => (
                  <tr key={r.invoice_id}>
                    <td className="td font-bold text-blue-600">{r.priority_score.toLocaleString()}</td>
                    <td className="td font-mono text-xs">{r.invoice_no}</td>
                    <td className="td">{r.patient_name}</td>
                    <td className="td">{r.outstanding.toLocaleString()}</td>
                    <td className="td"><Badge tone={r.age_bucket === "60+" ? "rose" : r.age_bucket === "31-60" ? "amber" : "slate"}>{r.age_bucket}d</Badge></td>
                    <td className="td text-xs text-slate-500">{r.suggested_action}</td>
                  </tr>
                ))}
                {(!ar || ar.length === 0) && <EmptyRow colSpan={6} text="No outstanding invoices — clean book." />}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AppShell>
  );
}
