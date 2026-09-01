"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import AppShell from "@/components/AppShell";
import Icon from "@/components/Icon";
import { BadgeKit, Button, Card, CardHeader, CardTitle, Input, Select, useToast } from "@/components/kit";
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

const STATUS_TONES: Record<string, "blue" | "green" | "amber" | "rose" | "slate"> = {
  COMPLETED: "green",
  IN_PROGRESS: "blue",
  BOOKED: "slate",
  CANCELLED: "rose",
  NO_SHOW: "rose",
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function AppointmentsPage() {
  const toast = useToast();
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
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<Doctor[]>("/api/doctors")
      .then((docs) => {
        setDoctors(docs);
        if (docs.length) setDoctorId(docs[0].id);
      })
      .catch((e) => toast.push({ kind: "error", title: "Failed", description: e instanceof Error ? e.message : "Load doctors" }));
  }, [toast]);

  const loadQueue = useCallback(async () => {
    if (!doctorId) return;
    try {
      setLoading(true);
      const data = await api<Appointment[]>(
        `/api/appointments?date=${date}&doctor_profile_id=${doctorId}`
      );
      setQueue(data);
    } catch (e) {
      toast.push({ kind: "error", title: "Load failed", description: e instanceof Error ? e.message : "Failed to load queue" });
    } finally {
      setLoading(false);
    }
  }, [doctorId, date, toast]);

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
      toast.push({ kind: "error", title: "Search failed", description: e instanceof Error ? e.message : "Try again" });
    }
  }

  async function book() {
    if (!patient || !selectedSlot || !doctorId) return;
    setBusy(true);
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
      toast.push({ kind: "success", title: "Booked", description: `${patient.full_name} @ ${selectedSlot.slice(0, 5)}` });
      setPatient(null);
      setPatientQuery("");
      setMatches([]);
      setComplaint("");
      setSelectedSlot(null);
      const d = await api<{ slots: Slot[] }>(`/api/doctors/${doctorId}/slots?date=${date}`);
      setSlots(d.slots);
      await loadQueue();
    } catch (e) {
      toast.push({ kind: "error", title: "Booking failed", description: e instanceof Error ? e.message : "Try again" });
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
      toast.push({ kind: "success", title: "Updated", description: `Status changed` });
    } catch (e) {
      toast.push({ kind: "error", title: "Update failed", description: e instanceof Error ? e.message : "Try again" });
    }
  }

  function fmtTime(iso: string) {
    return iso.slice(0, 5);
  }

  function doctorName(d: Doctor) {
    return `${d.doctor_name} — ${d.specialty}`;
  }

  return (
    <AppShell title="Appointments" subtitle="Book → Check-in → Treat → Complete">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="space-y-6"
      >
        <motion.div
          className="card"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.35 }}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <Select label="Doctor" value={doctorId?.toString() ?? ""} onChange={(e) => setDoctorId(e.target.value ? Number(e.target.value) : null)}>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>{doctorName(d)}</option>
              ))}
            </Select>
            <Input type="date" label="Date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div className="flex flex-wrap items-center gap-2 min-h-9">
            {!slots.length && <span className="text-sm text-slate-400">No clinic hours on this day.</span>}
            {slots.map((s, i) => (
              <motion.button
                key={s.start}
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.02, duration: 0.25, ease: "easeOut" }}
                disabled={!s.available}
                onClick={() => setSelectedSlot(s.start)}
                className={`btn text-xs ${
                  selectedSlot === s.start
                    ? "bg-blue-600 text-white shadow-sm"
                    : s.available
                      ? "border border-slate-300 bg-white hover:border-blue-400 hover:text-blue-600"
                      : "bg-slate-100 text-slate-300 line-through cursor-not-allowed"
                }`}
              >
                {s.start.slice(0, 5)}
              </motion.button>
            ))}
          </div>
          {slots.length > 0 && (
            <motion.div
              className="mt-2 flex flex-wrap gap-4 text-xs text-slate-400"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.3 }}
            >
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border border-slate-300 bg-white" /> available</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-blue-600" /> selected</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-slate-200" /> booked</span>
            </motion.div>
          )}
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.35 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>New booking</CardTitle>
              </CardHeader>
              <div>
                <Input
                  label="Find patient"
                  placeholder="Name / MRN / phone…"
                  value={patientQuery}
                  onChange={(e) => setPatientQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && searchPatients()}
                  leftIcon="search"
                />
                <Button variant="secondary" size="sm" className="mt-1" onClick={searchPatients}>Search</Button>
              </div>

              <AnimatePresence>
                {matches.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    className="mt-2 rounded-xl border divide-y max-w-md overflow-hidden"
                  >
                    {matches.map((m, i) => (
                      <motion.button
                        key={m.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04, duration: 0.25 }}
                        onClick={() => setPatient(m)}
                        className={`block w-full text-left px-3 py-2 text-sm transition-colors ${
                          patient?.id === m.id ? "bg-blue-50 font-medium" : "hover:bg-slate-50"
                        }`}
                      >
                        <span className="font-mono text-xs">{m.mrn}</span> · {m.full_name}
                        <span className="text-slate-400 block text-xs">{m.phone ?? "—"}</span>
                      </motion.button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {patient && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    className="mt-2 text-sm"
                  >
                    Selected: <span className="font-medium">{patient.full_name}</span>{" "}
                    <span className="font-mono text-xs text-slate-500">{patient.mrn}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <Input
                label="Chief complaint (optional)"
                placeholder="e.g. Routine checkup"
                value={complaint}
                onChange={(e) => setComplaint(e.target.value)}
                className="mt-3"
              />

              <Button
                className="mt-4 w-full"
                loading={busy}
                disabled={busy || !patient || !selectedSlot}
                onClick={book}
                leftIcon="plus"
              >
                {selectedSlot ? `Book ${selectedSlot.slice(0, 5)}` : "Pick a slot above"}
              </Button>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.35 }}
          >
            <Card className="overflow-x-auto">
              <CardHeader>
                <CardTitle>Day queue</CardTitle>
              </CardHeader>
              <table className="min-w-full">
                <thead>
                  <tr>
                    <th className="th">#</th>
                    <th className="th">Time</th>
                    <th className="th">Patient</th>
                    <th className="th">Status</th>
                    <th className="th">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[var(--line-soft)]">
                  <AnimatePresence>
                    {queue.map((a, i) => (
                      <motion.tr
                        key={a.id}
                        initial={{ opacity: 0, x: 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 12 }}
                        transition={{ delay: i * 0.03, duration: 0.25, ease: "easeOut" }}
                        className="hover:bg-slate-50 dark:hover:bg-[var(--surface-hover)]"
                      >
                        <td className="td font-semibold">{a.token_number}</td>
                        <td className="td">{fmtTime(a.slot_start)}–{fmtTime(a.slot_end)}</td>
                        <td className="td">
                          {a.patient.full_name}
                          {a.chief_complaint && <span className="text-xs text-slate-400 block">{a.chief_complaint}</span>}
                        </td>
                        <td className="td">
                          <BadgeKit tone={STATUS_TONES[a.status] ?? "slate"} dot>{a.status.replaceAll("_", " ")}</BadgeKit>
                        </td>
                        <td className="td space-x-1 whitespace-nowrap">
                          {(NEXT_ACTION[a.status] ?? []).map((act) => (
                            <motion.button
                              key={act.to}
                              whileTap={{ scale: 0.92 }}
                              className={
                                act.label === "Cancel" || act.label === "No show"
                                  ? "btn-secondary !px-2 !py-1 text-xs"
                                  : "btn-primary !px-2 !py-1 text-xs"
                              }
                              onClick={() => setStatus(a.id, act.to)}
                            >
                              {act.label}
                            </motion.button>
                          ))}
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                  {!queue.length && (
                    <motion.tr initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <td className="td text-center text-slate-400" colSpan={5}>
                        No appointments for this doctor/date.
                      </td>
                    </motion.tr>
                  )}
                </tbody>
              </table>
            </Card>
          </motion.div>
        </div>
      </motion.div>
    </AppShell>
  );
}
