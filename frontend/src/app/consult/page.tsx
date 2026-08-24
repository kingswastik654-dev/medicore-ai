"use client";

import { useState } from "react";

import AppShell from "@/components/AppShell";
import { Alert } from "@/components/ui";
import { api, currentUser } from "@/lib/api";

type PatientBrief = { id: number; mrn: string; full_name: string; phone: string | null };
type EncounterDetail = {
  id: number;
  status: string;
  chief_complaint: string | null;
  patient_name: string;
  notes: { id: number; note_type: string; source: string; subjective?: string; objective?: string; assessment?: string; plan?: string }[];
  diagnoses: { id: number; code: string; description: string; is_primary: boolean; added_via: string }[];
  vitals: Record<string, unknown>[];
};
type Suggestion = { code: string; description: string; confidence: number; evidence: string[] };
type DrugRow = { id: number; code: string; name: string; in_stock: number };
type RxItem = { drug_id: number; name: string; dosage: string; frequency: string; duration_days: number | null; quantity: number };
type Warning = { severity: string; type: string; detail: string };

const EMPTY_VITALS = { temperature_c: "", pulse: "", spo2: "", systolic: "", diastolic: "", resp_rate: "" };

export default function ConsultPage() {
  const user = currentUser();
  const isDoctor = user?.role === "DOCTOR";
  const canVitals = isDoctor || user?.role === "NURSE";

  const [patientQuery, setPatientQuery] = useState("");
  const [matches, setMatches] = useState<PatientBrief[]>([]);
  const [patient, setPatient] = useState<PatientBrief | null>(null);
  const [encounter, setEncounter] = useState<EncounterDetail | null>(null);

  const [vitals, setVitals] = useState({ ...EMPTY_VITALS });

  const [transcript, setTranscript] = useState("");
  const [soap, setSoap] = useState({ subjective: "", objective: "", assessment: "", plan: "" });
  const [aiMeta, setAiMeta] = useState<string | null>(null);
  const [drafting, setDrafting] = useState(false);

  const [clinicalText, setClinicalText] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  const [drugs, setDrugs] = useState<DrugRow[]>([]);
  const [rxItems, setRxItems] = useState<RxItem[]>([]);
  const [rxWarnings, setRxWarnings] = useState<Warning[]>([]);

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  async function startEncounter() {
    if (!patient || !isDoctor) return;
    setBusy(true);
    setError(null);
    try {
      const enc = await api<EncounterDetail>("/api/encounters", {
        method: "POST",
        body: JSON.stringify({ patient_id: patient.id, enc_type: "OPD" }),
      });
      setEncounter(enc);
      setMessage(`Encounter opened for ${enc.patient_name}`);
      api<DrugRow[]>("/api/drugs").then(setDrugs).catch(() => setDrugs([]));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to open encounter");
    } finally {
      setBusy(false);
    }
  }

  async function saveVitals() {
    if (!encounter) return;
    setBusy(true);
    setError(null);
    try {
      const payload: Record<string, number> = {};
      Object.entries(vitals).forEach(([k, v]) => {
        if (v !== "") payload[k] = Number(v);
      });
      await api(`/api/encounters/${encounter.id}/vitals`, { method: "POST", body: JSON.stringify(payload) });
      setMessage("Vitals recorded");
      setVitals({ ...EMPTY_VITALS });
      setEncounter(await api<EncounterDetail>(`/api/encounters/${encounter.id}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save vitals");
    } finally {
      setBusy(false);
    }
  }

  async function draftScribe() {
    if (transcript.trim().length < 10) return;
    setDrafting(true);
    setError(null);
    try {
      const res = await api<{
        subjective: string; objective: string; assessment: string; plan: string;
        provider: string; model?: string; disclaimer: string;
      }>("/api/ai/scribe/draft", { method: "POST", body: JSON.stringify({ transcript }) });
      setSoap({ subjective: res.subjective, objective: res.objective, assessment: res.assessment, plan: res.plan });
      setAiMeta(`${res.provider}${res.model ? ` Â· ${res.model}` : ""} â€” ${res.disclaimer}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI draft failed");
    } finally {
      setDrafting(false);
    }
  }

  async function saveNote() {
    if (!encounter || !isDoctor) return;
    setBusy(true);
    try {
      await api(`/api/encounters/${encounter.id}/notes`, {
        method: "POST",
        body: JSON.stringify({
          note_type: "SOAP",
          subjective: soap.subjective || null,
          objective: soap.objective || null,
          assessment: soap.assessment || null,
          plan: soap.plan || null,
          source: aiMeta ? "AI_SCRIBE" : "MANUAL",
        }),
      });
      setMessage("Note saved and signed");
      setSoap({ subjective: "", objective: "", assessment: "", plan: "" });
      setTranscript("");
      setAiMeta(null);
      setEncounter(await api<EncounterDetail>(`/api/encounters/${encounter.id}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save note");
    } finally {
      setBusy(false);
    }
  }

  async function suggestCodes() {
    if (clinicalText.trim().length < 5) return;
    setBusy(true);
    try {
      setSuggestions(await api<Suggestion[]>("/api/ai/coding/suggest", {
        method: "POST",
        body: JSON.stringify({ text: clinicalText }),
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Coding suggestion failed");
    } finally {
      setBusy(false);
    }
  }

  async function addDiagnosis(s: Suggestion) {
    if (!encounter) return;
    try {
      await api(`/api/encounters/${encounter.id}/diagnoses`, {
        method: "POST",
        body: JSON.stringify({
          code: s.code,
          description: s.description,
          is_primary: !encounter.diagnoses.length,
          added_via: "AI_SUGGESTION",
          confidence: s.confidence,
        }),
      });
      setSuggestions([]);
      setClinicalText("");
      setMessage(`Added ${s.code}`);
      setEncounter(await api<EncounterDetail>(`/api/encounters/${encounter.id}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add diagnosis");
    }
  }

  function addRxLine(drugId: number) {
    const drug = drugs.find((d) => d.id === Number(drugId));
    if (!drug) return;
    setRxItems((items) => [
      ...items,
      { drug_id: drug.id, name: drug.name, dosage: "", frequency: "BD", duration_days: 5, quantity: 10 },
    ]);
  }

  async function createPrescription() {
    if (!patient || !rxItems.length || !isDoctor) return;
    setBusy(true);
    setError(null);
    setRxWarnings([]);
    try {
      const res = await api<{ id: number; warnings: Warning[]; status: string }>("/api/prescriptions", {
        method: "POST",
        body: JSON.stringify({
          patient_id: patient.id,
          encounter_id: encounter?.id ?? null,
          items: rxItems.map(({ drug_id, dosage, frequency, duration_days, quantity }) => ({
            drug_id, dosage, frequency, duration_days, quantity,
          })),
        }),
      });
      setRxWarnings(res.warnings);
      setMessage(res.warnings.length
        ? `Prescription saved with ${res.warnings.length} safety warning(s)`
        : "Prescription saved â€” no interactions detected");
      setRxItems([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create prescription");
    } finally {
      setBusy(false);
    }
  }

  const vitalsFields: [keyof typeof EMPTY_VITALS, string][] = [
    ["temperature_c", "Temp Â°C"],
    ["pulse", "Pulse"],
    ["spo2", "SpOâ‚‚ %"],
    ["systolic", "BP sys"],
    ["diastolic", "BP dia"],
    ["resp_rate", "Resp rate"],
  ];
  const soapFields: [keyof typeof soap, string][] = [
    ["subjective", "Subjective"],
    ["objective", "Objective"],
    ["assessment", "Assessment"],
    ["plan", "Plan"],
  ];

  return (
    <AppShell title="Consult">
      {error && <Alert kind="error">{error}</Alert>}
      {message && <Alert kind="success">{message}</Alert>}

      <div className="card mb-6">
        <label className="label">1 Â· Select patient</label>
        {patient ? (
          <div className="flex items-center gap-3 text-sm">
            <span className="font-medium">{patient.full_name}</span>
            <span className="font-mono text-xs text-slate-500">{patient.mrn}</span>
            <button className="btn-secondary !py-1 text-xs" onClick={() => { setPatient(null); setEncounter(null); }}>Change</button>
            {isDoctor && !encounter && (
              <button className="btn-primary !py-1 text-xs" disabled={busy} onClick={startEncounter}>Start OPD encounter</button>
            )}
            {encounter && (
              <span className="chip bg-blue-100 text-blue-700">Encounter #{encounter.id} Â· {encounter.status}</span>
            )}
          </div>
        ) : (
          <div className="flex gap-2 max-w-md">
            <input className="input" placeholder="Name / MRN / phoneâ€¦" value={patientQuery}
              onChange={(e) => setPatientQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && searchPatients()} />
            <button className="btn-secondary" onClick={searchPatients}>Search</button>
          </div>
        )}
        {!patient && matches.length > 0 && (
          <div className="mt-2 rounded-md border divide-y max-w-md">
            {matches.map((m) => (
              <button key={m.id} className="block w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
                onClick={() => { setPatient(m); setMatches([]); }}>
                <span className="font-mono text-xs">{m.mrn}</span> Â· {m.full_name} <span className="text-slate-400">{m.phone}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {!encounter && patient && (
        <div className="card text-sm text-slate-500">
          {isDoctor ? "Start an encounter to begin documentation." : "Waiting for a clinician to open the encounter. You may record vitals once it exists."}
        </div>
      )}

      {encounter && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="space-y-4">
            <div className="card">
              <div className="text-sm font-semibold mb-2">2 Â· Vitals</div>
              <div className="grid grid-cols-3 gap-2">
                {vitalsFields.map(([key, label]) => (
                  <div key={key}>
                    <label className="label">{label}</label>
                    <input type="number" className="input" value={vitals[key]} disabled={!canVitals}
                      onChange={(e) => setVitals((v) => ({ ...v, [key]: e.target.value }))} />
                  </div>
                ))}
              </div>
              <button className="btn-primary mt-3 w-full" disabled={!canVitals || busy} onClick={saveVitals}>Save vitals</button>
              {encounter.vitals.length > 0 && (
                <div className="mt-2 text-xs text-slate-500">Last recorded: {new Date(encounter.vitals[0].recorded_at as string).toLocaleString()}</div>
              )}
            </div>

            <div className="card">
              <div className="text-sm font-semibold mb-1">4 Â· Coding copilot</div>
              <p className="text-xs text-slate-400 mb-2">Suggests ICD-10 codes from clinical text with cited evidence.</p>
              <textarea className="input min-h-20" placeholder="e.g. crushing chest pain with hypertensionâ€¦" value={clinicalText}
                onChange={(e) => setClinicalText(e.target.value)} />
              <button className="btn-secondary mt-2 w-full" disabled={busy} onClick={suggestCodes}>Suggest ICD-10</button>
              <div className="mt-2 space-y-2">
                {suggestions.map((s) => (
                  <div key={s.code} className="rounded border border-slate-200 p-2">
                    <div className="flex justify-between text-xs font-medium">
                      <span>{s.code} â€” {s.description}</span>
                      <span>{s.confidence}%</span>
                    </div>
                    <div className="h-1 bg-slate-100 rounded mt-1 mb-1">
                      <div className="h-1 bg-blue-500 rounded" style={{ width: `${s.confidence}%` }} />
                    </div>
                    <div className="text-[11px] text-slate-400">Evidence: {s.evidence.join(", ")}</div>
                    {isDoctor && (
                      <button className="btn-secondary mt-1 !px-2 !py-0.5 text-[11px]" onClick={() => addDiagnosis(s)}>Add diagnosis</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4 xl:col-span-2">
            <div className="card">
              <div className="text-sm font-semibold mb-1">3 Â· Ambient scribe</div>
              <p className="text-xs text-slate-400 mb-2">
                Paste the consultation transcript. AI drafts structured SOAP notes â€” clinician reviews, edits, and signs.
              </p>
              <textarea className="input min-h-24 font-mono text-xs" placeholder={"Patient: I have fever since two daysâ€¦\nDoctor: Chest examination clear."}
                value={transcript} onChange={(e) => setTranscript(e.target.value)} />
              <button className="btn-primary mt-2" disabled={drafting || transcript.trim().length < 10} onClick={draftScribe}>
                {drafting ? "Draftingâ€¦" : "Draft SOAP with AI"}
              </button>

              {(soap.subjective || aiMeta) && (
                <>
                  {aiMeta && (
                    <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      âš  {aiMeta}
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                    {soapFields.map(([key, label]) => (
                      <div key={key}>
                        <label className="label">{label}</label>
                        <textarea className="input min-h-20 text-xs" value={soap[key]}
                          onChange={(e) => setSoap((s) => ({ ...s, [key]: e.target.value }))} />
                      </div>
                    ))}
                  </div>
                  <button className="btn-primary mt-3 w-full" disabled={!isDoctor || busy} onClick={saveNote}>
                    Review &amp; sign note {aiMeta ? "(recorded as AI-assisted)" : ""}
                  </button>
                </>
              )}
            </div>

            <div className="card">
              <div className="text-sm font-semibold mb-1">5 Â· e-Prescription</div>
              {isDoctor ? (
                <>
                  <select className="input mb-2" value="" onChange={(e) => e.target.value && addRxLine(Number(e.target.value))}>
                    <option value="">+ Add drug from formularyâ€¦</option>
                    {drugs.filter((d) => !rxItems.some((i) => i.drug_id === d.id)).map((d) => (
                      <option key={d.id} value={d.id}>{d.name} (stock {d.in_stock})</option>
                    ))}
                  </select>
                  <div className="space-y-2">
                    {rxItems.map((item, idx) => (
                      <div key={item.drug_id} className="rounded border border-slate-200 p-2 grid grid-cols-5 gap-2 items-end">
                        <div className="col-span-5 text-xs font-medium">{item.name}</div>
                        <div><label className="label">Dosage</label><input className="input" placeholder="500 mg" value={item.dosage}
                          onChange={(e) => setRxItems((it) => it.map((x, i) => i === idx ? { ...x, dosage: e.target.value } : x))} /></div>
                        <div><label className="label">Freq</label><input className="input" value={item.frequency}
                          onChange={(e) => setRxItems((it) => it.map((x, i) => i === idx ? { ...x, frequency: e.target.value } : x))} /></div>
                        <div><label className="label">Days</label><input type="number" min={1} className="input" value={item.duration_days ?? ""}
                          onChange={(e) => setRxItems((it) => it.map((x, i) => i === idx ? { ...x, duration_days: Number(e.target.value) || null } : x))} /></div>
                        <div><label className="label">Qty</label><input type="number" min={1} className="input" value={item.quantity}
                          onChange={(e) => setRxItems((it) => it.map((x, i) => i === idx ? { ...x, quantity: Number(e.target.value) } : x))} /></div>
                        <button className="btn-ghost !px-1" onClick={() => setRxItems((it) => it.filter((_, i) => i !== idx))}>âœ•</button>
                      </div>
                    ))}
                  </div>
                  <button className="btn-primary mt-3 w-full" disabled={busy || !rxItems.length} onClick={createPrescription}>
                    Create prescription (runs interaction &amp; allergy checks)
                  </button>
                  {rxWarnings.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {rxWarnings.map((w, i) => (
                        <div key={i} className={`rounded-md border px-3 py-2 text-xs ${
                          w.severity === "MAJOR" ? "border-red-300 bg-red-50 text-red-700"
                          : w.severity === "MODERATE" ? "border-amber-300 bg-amber-50 text-amber-800"
                          : "border-slate-300 bg-slate-50 text-slate-600"}`}>
                          <strong>{w.severity} Â· {w.type}</strong> â€” {w.detail}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-xs text-slate-400">Only prescribers can create prescriptions.</p>
              )}
            </div>

            <div className="card">
              <div className="text-sm font-semibold mb-2">Encounter summary</div>
              <div className="text-xs text-slate-500 mb-1">Diagnoses ({encounter.diagnoses.length})</div>
              <ul className="list-disc pl-5 text-xs space-y-0.5 mb-3">
                {encounter.diagnoses.map((d) => (
                  <li key={d.id}>
                    <span className="font-medium">{d.code}</span> {d.description}
                    {d.is_primary && <span className="chip bg-blue-100 text-blue-700 ml-1">primary</span>}
                    {d.added_via === "AI_SUGGESTION" && <span className="chip bg-purple-100 text-purple-700 ml-1">AI</span>}
                  </li>
                ))}
                {!encounter.diagnoses.length && <li className="list-none text-slate-400">None yet</li>}
              </ul>
              <div className="text-xs text-slate-500 mb-1">Notes ({encounter.notes.length})</div>
              <div className="space-y-2">
                {encounter.notes.map((n) => (
                  <div key={n.id} className="rounded border border-slate-200 p-2 text-xs">
                    <span className="font-medium">{n.note_type}</span>
                    {n.source === "AI_SCRIBE" && <span className="chip bg-purple-100 text-purple-700 ml-1">AI-assisted</span>}
                    <div className="mt-1 grid grid-cols-2 gap-2 text-slate-600">
                      {[["S", n.subjective], ["O", n.objective], ["A", n.assessment], ["P", n.plan]].map(([k, v]) =>
                        v ? <div key={k as string}><b>{k as string}:</b> {v as string}</div> : null)}
                    </div>
                  </div>
                ))}
                {!encounter.notes.length && <div className="text-xs text-slate-400">No notes yet</div>}
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
