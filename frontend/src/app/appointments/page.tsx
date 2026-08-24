"use client";

import { useCallback, useEffect, useState } from "react";

import AppShell from "@/components/AppShell";
import { api } from "@/lib/api";

type Doctor = { id: number; doctor_name: string; specialty: string; consultation_fee: number };
type Slot = { start: string; end: string; available: boolean };
type PatientBrief = { id: number; mrn: string; full_name: string; phone: string | null };
type Appointment = {
  id: number;
  patient: PatientBrief;
  scheduled_date: string;
  slot_start: string;
  slot_end: string;
  token_number: number;
  status: string;
  chief_complaint: string | null;
};

const NEXT_ACTION: Record<string, { to: string; label: string }[]> = {
  BOOKED: [
    { to: "CHECKED_IN", label: "Check in" },
    { to: "CANCELLED", label: "Cancel" },
    { to: "NO_SHOW", label: "No show" },
  ],
  CHECKED_IN: [{ to: "IN_PROGRESS", label: "Start" }],
  IN_PROGRESS: [{ to: "COMPLETED", label: "Complete" }],
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function AppointmentsPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [doctorId, setDoctorId] = useState<number | null>(null);
  const [date, setDate] = useState(todayISO());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const [patientQuery, setPatientQuery] = useState("");
  const [matches, setMatches] = useState<PatientBrief[]>([]);
  const [patient, setPatient] = useState<PatientBrief | null>(null);
  const [complaint, setComplaint] = useState("");

  const [queue, setQueue] = useState<Appointment[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Doctor[]>("/api/doctors")
      .then((docs) => {
        setDoctors(docs);
        if (docs.length) setDoctorId(docs[0].id);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load doctors"));
  }, []);

  const loadQueue = useCallback(async () => {
    if (!doctorId) return;
    try {
      const data = await api<Appointment[]>(
        `/api/appointments?date=${date}&doctor_profile_id=${doctorId}`
      );
      setQueue(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load queue");
    }
  }, [doctorId, date]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  useEffect(() => {
    if (!doctorId || !date) return;
    setSelectedSlot(null);
    api<{ slots: Slot[] }>(`/api/doctors/${doctorId}/slots?date=${date}`)
      .then((d) => setSlots(d.slots))
      .catch(() => setSlots([]));
  }, [doctorId, date]);

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

  async function book() {
    if (!patient || !selectedSlot || !doctorId) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api("/api/appointments", {
        method: "POST",
        body: JSON.stringify({
          patient_id: patient.id,
          doctor_profile_id: doctorId,
          scheduled_date: date,
          slot_start: selectedSlot,
          chief_complaint: complaint || null,
        }),
      });
      setMessage(`Booked ${patient.full_name} at ${selectedSlot}`);
      setPatient(null);
      setPatientQuery("");
      setMatches([]);
      setComplaint("");
      setSelectedSlot(null);
      const d = await api<{ slots: Slot[] }>(`/api/doctors/${doctorId}/slots?date=${date}`);
      setSlots(d.slots);
      await loadQueue();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Booking failed");
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(apptId: number, status: string) {
    try {
      await api(`/api/appointments/${apptId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await loadQueue();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Status update failed");
    }
  }

  function fmtTime(iso: string) {
    return iso.slice(0, 5);
  }

  return (
    <AppShell title="Appointments">
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 mb-4">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700 mb-4">
          {message}
        </div>
      )}

      <div className="card mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="label">Doctor</label>
            <select
              className="input"
              value={doctorId ?? ""}
              onChange={(e) => setDoctorId(Number(e.target.value))}
            >
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.doctor_name} — {d.specialty}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Date</label>
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 min-h-9">
          {!slots.length && (
            <span className="text-sm text-slate-400">No clinic hours on this day.</span>
          )}
          {slots.map((s) => (
            <button
              key={s.start}
              disabled={!s.available}
              onClick={() => setSelectedSlot(s.start)}
              className={`btn text-xs ${
                selectedSlot === s.start
                  ? "bg-blue-600 text-white"
                  : s.available
                    ? "border border-slate-300 bg-white hover:border-blue-400"
                    : "bg-slate-100 text-slate-300 line-through cursor-not-allowed"
              }`}
            >
              {s.start.slice(0, 5)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card space-y-3">
          <div className="text-sm font-semibold">New booking</div>
          <div>
            <label className="label">Find patient</label>
            <div className="flex gap-2">
              <input
                className="input"
                placeholder="Name / MRN / phone…"
                value={patientQuery}
                onChange={(e) => setPatientQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchPatients()}
              />
              <button className="btn-secondary" onClick={searchPatients}>
                Search
              </button>
            </div>
          </div>

          {matches.length > 0 && (
            <div className="rounded-md border divide-y">
              {matches.map((m) => (
                <button
                  key={m.id}
                  className={`block w-full text-left px-3 py-2 text-sm hover:bg-slate-50 ${
                    patient?.id === m.id ? "bg-blue-50 font-medium" : ""
                  }`}
                  onClick={() => setPatient(m)}
                >
                  <span className="font-mono text-xs">{m.mrn}</span> · {m.full_name}{" "}
                  <span className="text-slate-400">{m.phone}</span>
                </button>
              ))}
            </div>
          )}

          {patient && (
            <div className="text-sm">
              Selected: <span className="font-medium">{patient.full_name}</span>{" "}
              <span className="font-mono text-xs text-slate-500">{patient.mrn}</span>
            </div>
          )}

          <div>
            <label className="label">Chief complaint (optional)</label>
            <input className="input" value={complaint} onChange={(e) => setComplaint(e.target.value)} />
          </div>

          <button
            className="btn-primary w-full"
            disabled={busy || !patient || !selectedSlot}
            onClick={book}
          >
            {selectedSlot ? `Book ${selectedSlot.slice(0, 5)}` : "Pick a slot above"}
          </button>
        </div>

        <div className="card overflow-x-auto">
          <div className="text-sm font-semibold mb-2">Day queue</div>
          <table className="min-w-full divide-y divide-slate-200">
            <thead>
              <tr>
                <th className="th">#</th>
                <th className="th">Time</th>
                <th className="th">Patient</th>
                <th className="th">Status</th>
                <th className="th">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {queue.map((a) => (
                <tr key={a.id}>
                  <td className="td font-semibold">{a.token_number}</td>
                  <td className="td">
                    {fmtTime(a.slot_start)}–{fmtTime(a.slot_end)}
                  </td>
                  <td className="td">
                    {a.patient.full_name}
                    {a.chief_complaint && (
                      <span className="text-xs text-slate-400 block">{a.chief_complaint}</span>
                    )}
                  </td>
                  <td className="td">
                    <span
                      className={`chip ${
                        a.status === "COMPLETED"
                          ? "bg-green-100 text-green-700"
                          : a.status === "IN_PROGRESS"
                            ? "bg-blue-100 text-blue-700"
                            : a.status === "BOOKED"
                              ? "bg-slate-100 text-slate-600"
                              : "bg-red-100 text-red-700"
                      }`}
                    >
                      {a.status.replaceAll("_", " ")}
                    </span>
                  </td>
                  <td className="td space-x-1 whitespace-nowrap">
                    {(NEXT_ACTION[a.status] ?? []).map((act) => (
                      <button
                        key={act.to}
                        className={
                          act.label === "Cancel" || act.label === "No show"
                            ? "btn-secondary !px-2 !py-1 text-xs"
                            : "btn-primary !px-2 !py-1 text-xs"
                        }
                        onClick={() => setStatus(a.id, act.to)}
                      >
                        {act.label}
                      </button>
                    ))}
                  </td>
                </tr>
              ))}
              {!queue.length && (
                <tr>
                  <td className="td text-slate-400" colSpan={5}>
                    No appointments for this doctor/date.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
