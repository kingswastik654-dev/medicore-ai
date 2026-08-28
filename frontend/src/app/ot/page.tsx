"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import AppShell from "@/components/AppShell";
import { Alert, Badge, EmptyRow, StatCard, StatusBadge } from "@/components/ui";
import { api, currentUser } from "@/lib/api";

type OtRoom = { id: number; code: string; name: string; floor?: string | null; status: string };
type OtBooking = {
  id: number; room_id: number; room_code: string; room_name: string;
  patient_id: number; patient_name: string; mrn: string; surgeon_profile_id: number; surgeon_name: string;
  procedure_name: string; procedure_code: string | null; anesthesia_type: string | null;
  start_at: string; end_at: string; status: string; cleared: boolean; cleared_by: string;
  sign_in_done: boolean; time_out_done: boolean; sign_out_done: boolean;
  started_at: string | null; completed_at: string | null; implants_note: string | null; cancel_reason: string | null;
};
type Doctor = { id: number; specialty: string; doctor_name?: string; user?: { full_name: string } };
type PatientBrief = { id: number; mrn: string; full_name: string };

const STATUS_TABS = ["ALL", "PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;

function fmt(dt: string | null): string {
  if (!dt) return "—";
  return new Date(dt).toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function OtPage() {
  const [rooms, setRooms] = useState<OtRoom[]>([]);
  const [bookings, setBookings] = useState<OtBooking[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [patients, setPatients] = useState<Record<number, PatientBrief>>({});
  const [filterDate, setFilterDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [statusTab, setStatusTab] = useState<(typeof STATUS_TABS)[number]>("ALL");
  const [selected, setSelected] = useState<OtBooking | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [q, setQ] = useState("");
  const [matches, setMatches] = useState<PatientBrief[]>([]);
  const [form, setForm] = useState({ patient_id: 0, room_id: 0, surgeon_profile_id: 0, procedure_name: "", anesthesia_type: "GA", start_at: "", end_at: "" });
  const [implants, setImplants] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const role = typeof window === "undefined" ? "" : currentUser()?.role ?? "";

  const load = useCallback(async () => {
    try {
      const [r, b, d, p] = await Promise.all([
        api<OtRoom[]>("/api/ot/rooms"),
        api<OtBooking[]>(`/api/ot/bookings?date=${filterDate}`),
        api<Doctor[]>("/api/doctors"),
        api<{ items: PatientBrief[] }>("/api/patients?page_size=200"),
      ]);
      setRooms(r);
      setBookings(b);
      setDoctors(d);
      setPatients(Object.fromEntries(p.items.map((x) => [x.id, x])));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load OT schedule");
    }
  }, [filterDate]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => bookings.filter((b) => statusTab === "ALL" || b.status === statusTab), [bookings, statusTab]);

  const stats = useMemo(() => ({
    planned: bookings.filter((b) => b.status === "PLANNED").length,
    inprog: bookings.filter((b) => b.status === "IN_PROGRESS").length,
    completed: bookings.filter((b) => b.status === "COMPLETED").length,
    available: rooms.filter((r) => r.status === "AVAILABLE").length,
  }), [bookings, rooms]);

  async function act(path: string, body?: unknown, okMsg = "Done") {
    setBusy(true); setError(null); setMessage(null);
    try {
      await api(path, { method: "POST", body: body ? JSON.stringify(body) : undefined });
      setMessage(okMsg);
      setSelected(null); setImplants(""); setCancelReason("");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Action failed"); } finally { setBusy(false); }
  }

  async function searchPatients() {
    if (q.trim().length < 2) return;
    try {
      const data = await api<{ items: PatientBrief[] }>(`/api/patients?page_size=8&q=${encodeURIComponent(q.trim())}`);
      setMatches(data.items);
    } catch (e) { setError(e instanceof Error ? e.message : "Search failed"); }
  }

  async function createBooking(e: React.FormEvent) {
    e.preventDefault();
    if (!form.patient_id || !form.room_id || !form.surgeon_profile_id || !form.procedure_name || !form.start_at || !form.end_at) {
      setError("Fill all booking fields"); return;
    }
    setBusy(true); setError(null);
    try {
      await api("/api/ot/bookings", {
        method: "POST",
        body: JSON.stringify({
          room_id: form.room_id, patient_id: form.patient_id, surgeon_profile_id: form.surgeon_profile_id,
          procedure_name: form.procedure_name, anesthesia_type: form.anesthesia_type,
          start_at: new Date(form.start_at).toISOString(), end_at: new Date(form.end_at).toISOString(),
        }),
      });
      setMessage("OT case booked");
      setShowCreate(false);
      setForm({ patient_id: 0, room_id: 0, surgeon_profile_id: 0, procedure_name: "", anesthesia_type: "GA", start_at: "", end_at: "" });
      setQ(""); setMatches([]);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Booking failed"); } finally { setBusy(false); }
  }

  const canClear = role === "DOCTOR";
  const canChecklist = ["NURSE", "DOCTOR"].includes(role);
  const canStart = ["NURSE", "DOCTOR"].includes(role);
  const canComplete = role === "DOCTOR";
  const canCancel = ["DOCTOR", "FACILITY_ADMIN", "SUPER_ADMIN"].includes(role);

  return (
    <AppShell title="Operation Theatre" subtitle="WHO surgical safety checklist enforced — Sign-In → Time-Out → Sign-Out">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Planned" value={String(stats.planned)} sub={`on ${filterDate}`} icon="clock" tone="blue" />
        <StatCard label="In progress" value={String(stats.inprog)} sub="knife-to-skin" icon="ot" tone="amber" />
        <StatCard label="Completed" value={String(stats.completed)} sub="today" icon="check" tone="green" />
        <StatCard label="Rooms available" value={String(stats.available)} sub={`${rooms.length} total`} icon="bed" tone="slate" />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm" />
        {STATUS_TABS.map((t) => (
          <button key={t} onClick={() => setStatusTab(t)} className={`chip border ${statusTab === t ? "border-blue-500 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"}`}>{t === "ALL" ? "All" : t.replace("_", " ")}</button>
        ))}
        <button onClick={load} className="btn-ghost px-3 py-1.5 text-sm" disabled={busy}>Refresh</button>
        {["DOCTOR"].includes(role) && (
          <button onClick={() => setShowCreate((v) => !v)} className="btn-primary ml-auto px-3 py-1.5 text-sm">{showCreate ? "Close" : "Book case"}</button>
        )}
      </div>

      {error && <div className="mt-4"><Alert kind="error">{error}</Alert></div>}
      {message && <div className="mt-4"><Alert kind="success">{message}</Alert></div>}

      {showCreate && (
        <form onSubmit={createBooking} className="card mt-4 grid gap-3 p-4 md:grid-cols-2">
          <div className="md:col-span-2 flex gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search patient (min 2 chars)" className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
            <button type="button" onClick={searchPatients} className="btn-ghost px-3 py-1.5 text-sm">Search</button>
            {matches.length > 0 && (
              <select value={form.patient_id} onChange={(e) => setForm({ ...form, patient_id: Number(e.target.value) })} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm">
                <option value={0}>Pick patient</option>{matches.map((m) => <option key={m.id} value={m.id}>{m.full_name} — {m.mrn}</option>)}
              </select>
            )}
          </div>
          <select value={form.room_id} onChange={(e) => setForm({ ...form, room_id: Number(e.target.value) })} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm">
            <option value={0}>OT room</option>{rooms.map((r) => <option key={r.id} value={r.id}>{r.code} — {r.name} ({r.status})</option>)}
          </select>
          <select value={form.surgeon_profile_id} onChange={(e) => setForm({ ...form, surgeon_profile_id: Number(e.target.value) })} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm">
            <option value={0}>Surgeon</option>{doctors.map((d) => <option key={d.id} value={d.id}>{(d as unknown as { doctor_name: string }).doctor_name ?? `Surgeon #${d.id}`}</option>)}
          </select>
          <input value={form.procedure_name} onChange={(e) => setForm({ ...form, procedure_name: e.target.value })} placeholder="Procedure (e.g. Laparoscopic Cholecystectomy)" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
          <select value={form.anesthesia_type} onChange={(e) => setForm({ ...form, anesthesia_type: e.target.value })} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm">
            <option value="GA">GA</option><option value="RA">RA</option><option value="LOCAL">LOCAL</option><option value="SEDATION">SEDATION</option>
          </select>
          <input type="datetime-local" value={form.start_at} onChange={(e) => setForm({ ...form, start_at: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
          <input type="datetime-local" value={form.end_at} onChange={(e) => setForm({ ...form, end_at: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
          <button type="submit" className="btn-primary md:col-span-2 py-1.5 text-sm" disabled={busy}>Confirm booking</button>
        </form>
      )}

      <div className="card mt-4 overflow-x-auto p-0">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <th className="td">Time</th><th className="td">Room</th><th className="td">Patient</th><th className="td">Surgeon</th><th className="td">Procedure</th><th className="td">Status</th><th className="td">Checklist</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <EmptyRow colSpan={7} text="No cases on this date." />}
            {filtered.map((b) => (
              <tr key={b.id} onClick={() => setSelected(selected?.id === b.id ? null : b)} className={`cursor-pointer border-b border-slate-50 hover:bg-blue-50/40 ${selected?.id === b.id ? "bg-blue-50" : ""}`}>
                <td className="td text-slate-700">{fmt(b.start_at)} — {fmt(b.end_at)}</td>
                <td className="td"><Badge tone={b.room_code ? "slate" : "rose"}>{b.room_code}</Badge></td>
                <td className="td"><div className="font-medium text-slate-700">{b.patient_name || patients[b.patient_id]?.full_name || `Patient #${b.patient_id}`}</div><div className="text-xs text-slate-400">{b.mrn || patients[b.patient_id]?.mrn || ""}</div></td>
                <td className="td text-slate-600">{b.surgeon_name}</td>
                <td className="td"><div className="text-slate-800">{b.procedure_name}</div><div className="text-xs text-slate-400">{b.anesthesia_type ?? ""}</div></td>
                <td className="td"><StatusBadge status={b.status} /></td>
                <td className="td"><div className="flex gap-1">{[
                  [b.sign_in_done, "In"], [b.time_out_done, "Out"], [b.sign_out_done, "Sign"]
                ].map(([done, label]) => <span key={label as string} className={`h-2 w-2 rounded-full ${done ? "bg-emerald-500" : "bg-slate-300"}`} title={label as string} />)}</div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="card mt-5 animate-fadeUp">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h2 className="text-base font-bold text-slate-900">Case #{selected.id} — {selected.procedure_name}</h2><p className="mt-0.5 text-sm text-slate-500">{selected.room_code} · {selected.patient_name} · {selected.surgeon_name} · {fmt(selected.start_at)}</p></div>
            <StatusBadge status={selected.status} />
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <Badge tone={selected.cleared ? "green" : "amber"}>Clearance: {selected.cleared ? `yes (${selected.cleared_by})` : "pending"}</Badge>
            <Badge tone={selected.sign_in_done ? "green" : "slate"}>Sign-In {selected.sign_in_done ? "✓" : "·"}</Badge>
            <Badge tone={selected.time_out_done ? "green" : "slate"}>Time-Out {selected.time_out_done ? "✓" : "·"}</Badge>
            <Badge tone={selected.sign_out_done ? "green" : "slate"}>Sign-Out {selected.sign_out_done ? "✓" : "·"}</Badge>
          </div>

          {selected.implants_note && <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">Implants: {selected.implants_note}</div>}
          {selected.cancel_reason && <div className="mt-3"><Alert kind="error">Cancelled: {selected.cancel_reason}</Alert></div>}

          <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            {canClear && selected.status === "PLANNED" && !selected.cleared && <button onClick={() => act(`/api/ot/bookings/${selected.id}/clearance`, undefined, "Clearance granted")} className="btn-primary px-3 py-1.5 text-sm" disabled={busy}>Grant anesthesia clearance</button>}
            {canChecklist && ["PLANNED", "IN_PROGRESS"].includes(selected.status) && !selected.sign_in_done && <button onClick={() => act(`/api/ot/bookings/${selected.id}/checklist`, { phase: "SIGN_IN" })} className="btn-ghost px-3 py-1.5 text-sm" disabled={busy}>Mark Sign-In</button>}
            {canChecklist && selected.sign_in_done && !selected.time_out_done && <button onClick={() => act(`/api/ot/bookings/${selected.id}/checklist`, { phase: "TIME_OUT" })} className="btn-ghost px-3 py-1.5 text-sm" disabled={busy}>Mark Time-Out</button>}
            {canChecklist && selected.time_out_done && !selected.sign_out_done && <button onClick={() => act(`/api/ot/bookings/${selected.id}/checklist`, { phase: "SIGN_OUT" })} className="btn-ghost px-3 py-1.5 text-sm" disabled={busy}>Mark Sign-Out</button>}
            {canStart && selected.status === "PLANNED" && <button onClick={() => act(`/api/ot/bookings/${selected.id}/start`, undefined, "Case started")} className="btn-primary px-3 py-1.5 text-sm" disabled={busy}>Start case (knife-to-skin)</button>}
            {canComplete && selected.status === "IN_PROGRESS" && (
              <div className="flex w-full gap-2">
                <input value={implants} onChange={(e) => setImplants(e.target.value)} placeholder="Implants / lot traceability (optional)" className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
                <button onClick={() => act(`/api/ot/bookings/${selected.id}/complete`, implants ? { implants_note: implants } : undefined, "Case completed")} className="btn-primary px-3 py-1.5 text-sm" disabled={busy}>Complete</button>
              </div>
            )}
            {canCancel && !["COMPLETED", "CANCELLED"].includes(selected.status) && (
              <div className="flex w-full gap-2">
                <input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Cancel reason" className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
                <button onClick={() => cancelReason.trim().length >= 3 && act(`/api/ot/bookings/${selected.id}/cancel`, { reason: cancelReason.trim() }, "Case cancelled")} className="btn-ghost px-3 py-1.5 text-sm text-rose-600" disabled={busy || cancelReason.trim().length < 3}>Cancel case</button>
              </div>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}

