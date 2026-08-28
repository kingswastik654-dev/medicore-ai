"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";

import AppShell from "@/components/AppShell";
import Icon from "@/components/Icon";
import { Card, CardHeader, CardTitle, BadgeKit, Button, Input, Select } from "@/components/kit";
import { api } from "@/lib/api";
import { useToast } from "@/components/kit";

type Patient = {
  id: number;
  mrn: string;
  full_name: string;
  dob: string | null;
  gender: string | null;
  phone: string | null;
  blood_group: string | null;
};

type Duplicate = {
  patient_id: number;
  mrn: string;
  name: string;
  phone: string | null;
  score: number;
};

type RegisterResponse = {
  created?: boolean;
  id?: number;
  mrn?: string;
  potential_duplicates?: Duplicate[];
};

const EMPTY_FORM = {
  first_name: "",
  last_name: "",
  dob: "",
  gender: "",
  phone: "",
  email: "",
  blood_group: "",
  allergies: "",
  national_id: "",
};

const rowVariants: Variants = {
  hidden: { opacity: 0, x: -8 },
  show: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.35, ease: "easeOut", staggerChildren: 0.03 },
  },
};

export default function PatientsPage() {
  const toast = useToast();
  const [q, setQ] = useState("");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [total, setTotal] = useState(0);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [duplicates, setDuplicates] = useState<Duplicate[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (query: string) => {
    try {
      setLoading(true);
      const data = await api<{ items: Patient[]; total: number }>(
        `/api/patients?page_size=50${query ? `&q=${encodeURIComponent(query)}` : ""}`
      );
      setPatients(data.items);
      setTotal(data.total);
    } catch (e) {
      toast.push({ kind: "error", title: "Load failed", description: e instanceof Error ? e.message : "Failed to load patients" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load("");
  }, [load]);

  const set = (field: keyof typeof EMPTY_FORM, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  async function submit(force: boolean) {
    setBusy(true);
    try {
      const payload = {
        ...form,
        dob: form.dob || null,
        gender: form.gender || null,
      };
      const res = await api<RegisterResponse>(
        `/api/patients${force ? "?force=true" : ""}`,
        { method: "POST", body: JSON.stringify(payload) }
      );
      if (res.created === false && res.potential_duplicates?.length) {
        setDuplicates(res.potential_duplicates);
        toast.push({ kind: "warning", title: "Duplicates found", description: `${res.potential_duplicates.length} potential duplicates need review` });
      } else if (res.created && res.mrn) {
        toast.push({ kind: "success", title: "Registered", description: `Patient ${res.mrn} created` });
        setForm({ ...EMPTY_FORM });
        setDuplicates(null);
        await load(q);
      }
    } catch (e) {
      toast.push({ kind: "error", title: "Registration failed", description: e instanceof Error ? e.message : "Failed" });
    } finally {
      setBusy(false);
    }
  }

  function genderTone(g: string | null): "blue" | "green" | "rose" | "slate" {
    if (g === "MALE") return "blue";
    if (g === "FEMALE") return "rose";
    return "slate";
  }

  return (
    <AppShell title="Patients" subtitle="Patient Master Index · duplicate-aware MRN lifecycle">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="grid grid-cols-1 lg:grid-cols-3 gap-6"
      >
        <div className="lg:col-span-2 space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.35 }}
            className="flex gap-2"
          >
            <Input
              placeholder="Search by MRN, name, phone, national ID…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load(q)}
              leftIcon="search"
              className="max-w-md"
            />
            <Button variant="secondary" size="md" onClick={() => load(q)} leftIcon="search">Search</Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.35 }}
            className="table-wrap"
          >
            <table className="min-w-full divide-y divide-slate-200">
              <thead>
                <tr>
                  <th className="th">MRN</th>
                  <th className="th">Name</th>
                  <th className="th">Phone</th>
                  <th className="th">Gender</th>
                  <th className="th">DOB</th>
                  <th className="th">Blood</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[var(--line-soft)]">
                {patients.map((p, i) => (
                  <motion.tr
                    key={p.id}
                    className="hover:bg-slate-50 dark:hover:bg-[var(--surface-hover)] transition-colors"
                    variants={rowVariants}
                    initial="hidden"
                    animate="show"
                  >
                    <td className="td font-mono">{p.mrn}</td>
                    <td className="td font-medium text-[var(--text)]">{p.full_name}</td>
                    <td className="td">{p.phone ?? "—"}</td>
                    <td className="td">
                      {p.gender ? <BadgeKit tone={genderTone(p.gender)} dot>{p.gender}</BadgeKit> : "—"}
                    </td>
                    <td className="td">{p.dob ?? "—"}</td>
                    <td className="td">{p.blood_group ? <span className="font-bold text-rose-600">{p.blood_group}</span> : "—"}</td>
                  </motion.tr>
                ))}
                {!patients.length && !loading && (
                  <tr>
                    <td className="td text-center text-slate-400" colSpan={6}>
                      {q ? `No patients match "${q}".` : "No patients yet — register the first one on the right."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <div className="px-3 pt-2 text-xs text-[var(--muted)]">
              Showing {patients.length} of {total}
            </div>
          </motion.div>
        </div>

        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Register patient</CardTitle>
                <BadgeKit tone="blue">AI-matched</BadgeKit>
              </CardHeader>
              <div className="grid grid-cols-2 gap-3">
                <Input label="First name *" placeholder="Jane" value={form.first_name} onChange={(e) => set("first_name", e.target.value)} />
                <Input label="Last name *" placeholder="Doe" value={form.last_name} onChange={(e) => set("last_name", e.target.value)} />
                <Input type="date" label="Date of birth" value={form.dob} onChange={(e) => set("dob", e.target.value)} />
                <Select label="Gender" value={form.gender} onChange={(e) => set("gender", e.target.value)}>
                  <option value="">—</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </Select>
                <Input label="Phone" placeholder="+91 98765 43210" value={form.phone} onChange={(e) => set("phone", e.target.value)} leftIcon="search" />
                <Input label="Blood group" placeholder="O+" value={form.blood_group} onChange={(e) => set("blood_group", e.target.value)} />
                <div className="col-span-2">
                  <Input label="National / ABHA ID" placeholder="ABHA / Aadhaar" value={form.national_id} onChange={(e) => set("national_id", e.target.value)} />
                </div>
                <div className="col-span-2">
                  <Input label="Allergies" placeholder="e.g. Penicillin, Sulfa" value={form.allergies} onChange={(e) => set("allergies", e.target.value)} />
                </div>
              </div>

              <AnimatePresence>
                {duplicates && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3"
                  >
                    <div className="text-xs font-semibold text-amber-800 mb-2 flex items-center gap-1.5">
                      <Icon name="alert" className="h-3 w-3" />
                      Possible duplicates found — review before continuing:
                    </div>
                    <ul className="space-y-1.5">
                      {duplicates.map((d) => (
                        <li key={d.patient_id} className="text-xs text-amber-900 flex items-center justify-between">
                          <span>
                            <span className="font-mono">{d.mrn}</span> · {d.name} · {d.phone ?? "no phone"}
                          </span>
                          <BadgeKit tone="amber">{d.score}% match</BadgeKit>
                        </li>
                      ))}
                    </ul>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="mt-3 w-full"
                      disabled={busy}
                      onClick={() => submit(true)}
                    >
                      Register anyway
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>

              <Button
                className="mt-4 w-full"
                loading={busy}
                disabled={busy || !form.first_name || !form.last_name}
                onClick={() => submit(false)}
                leftIcon="plus"
              >
                Check &amp; register
              </Button>
            </Card>
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </AppShell>
  );
}
