"use client";

import { useCallback, useEffect, useState } from "react";

import AppShell from "@/components/AppShell";
import { Alert, EmptyRow } from "@/components/ui";
import { api } from "@/lib/api";

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

export default function PatientsPage() {
  const [q, setQ] = useState("");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [total, setTotal] = useState(0);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [duplicates, setDuplicates] = useState<Duplicate[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (query: string) => {
    try {
      const data = await api<{ items: Patient[]; total: number }>(
        `/api/patients?page_size=50${query ? `&q=${encodeURIComponent(query)}` : ""}`
      );
      setPatients(data.items);
      setTotal(data.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load patients");
    }
  }, []);

  useEffect(() => {
    load("");
  }, [load]);

  function set(field: keyof typeof EMPTY_FORM, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function submit(force: boolean) {
    setBusy(true);
    setError(null);
    setMessage(null);
    setDuplicates(null);
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
      } else if (res.created && res.mrn) {
        setMessage(`Registered ${res.mrn}`);
        setForm({ ...EMPTY_FORM });
        await load(q);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="Patients">
      {error && <Alert kind="error">{error}</Alert>}
      {message && <Alert kind="success">{message}</Alert>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex gap-2">
            <input
              className="input"
              placeholder="Search by MRN, name, phone, national IDâ€¦"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load(q)}
            />
            <button className="btn-secondary" onClick={() => load(q)}>
              Search
            </button>
          </div>

          <div className="card overflow-x-auto">
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
              <tbody className="divide-y divide-slate-100">
                {patients.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="td font-mono">{p.mrn}</td>
                    <td className="td">{p.full_name}</td>
                    <td className="td">{p.phone ?? "â€”"}</td>
                    <td className="td">{p.gender ?? "â€”"}</td>
                    <td className="td">{p.dob ?? "â€”"}</td>
                    <td className="td">{p.blood_group ?? "â€”"}</td>
                  </tr>
                ))}
                {!patients.length && (
                  <EmptyRow colSpan={6} text={q ? `No patients match “${q}”.` : "No patients yet — register the first one on the right."} />
                )}
              </tbody>
            </table>
            <div className="px-3 pt-2 text-xs text-slate-400">
              Showing {patients.length} of {total}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card">
            <div className="text-sm font-semibold mb-3">Register patient</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">First name *</label>
                <input className="input" value={form.first_name} onChange={(e) => set("first_name", e.target.value)} />
              </div>
              <div>
                <label className="label">Last name *</label>
                <input className="input" value={form.last_name} onChange={(e) => set("last_name", e.target.value)} />
              </div>
              <div>
                <label className="label">Date of birth</label>
                <input type="date" className="input" value={form.dob} onChange={(e) => set("dob", e.target.value)} />
              </div>
              <div>
                <label className="label">Gender</label>
                <select className="input" value={form.gender} onChange={(e) => set("gender", e.target.value)}>
                  <option value="">â€”</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label className="label">Phone</label>
                <input className="input" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
              </div>
              <div>
                <label className="label">Blood group</label>
                <input className="input" placeholder="O+" value={form.blood_group} onChange={(e) => set("blood_group", e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className="label">National / ABHA ID</label>
                <input className="input" value={form.national_id} onChange={(e) => set("national_id", e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className="label">Allergies</label>
                <input className="input" value={form.allergies} onChange={(e) => set("allergies", e.target.value)} />
              </div>
            </div>

            {duplicates && (
              <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3">
                <div className="text-xs font-semibold text-amber-800 mb-2">
                  Possible duplicates found â€” review before continuing:
                </div>
                <ul className="space-y-1">
                  {duplicates.map((d) => (
                    <li key={d.patient_id} className="text-xs text-amber-900">
                      <span className="font-mono">{d.mrn}</span> Â· {d.name} Â· {d.phone ?? "no phone"}{" "}
                      (match {d.score}%)
                    </li>
                  ))}
                </ul>
                <button className="btn-secondary mt-3 w-full" disabled={busy} onClick={() => submit(true)}>
                  Register anyway
                </button>
              </div>
            )}

            <button
              className="btn-primary mt-4 w-full"
              disabled={busy || !form.first_name || !form.last_name}
              onClick={() => submit(false)}
            >
              Check &amp; register
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
