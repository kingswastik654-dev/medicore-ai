"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import Icon from "@/components/Icon";
import { currentUser, login } from "@/lib/api";

const DEMO: { user: string; pass: string; role: string; desc: string }[] = [
  { user: "dr.house", pass: "Doctor@123", role: "Doctor", desc: "Full consult + AI copilots" },
  { user: "reception.rekha", pass: "Reception@123", role: "Reception", desc: "Registration & booking" },
  { user: "cashier.amit", pass: "Cashier@123", role: "Cashier", desc: "Billing & payments" },
  { user: "pharm.suresh", pass: "Pharma@123", role: "Pharmacist", desc: "FEFO dispensing" },
  { user: "lab.vikram", pass: "Lab@12345", role: "Lab Tech", desc: "Order lifecycle" },
  { user: "admin", pass: "Admin@123", role: "Super Admin", desc: "Everything + audit" },
];

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (currentUser()) router.replace("/dashboard");
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(username.trim(), password);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-slate-950 p-12 text-white lg:flex lg:flex-col">
        <div className="pointer-events-none absolute -right-24 top-1/4 h-96 w-96 rounded-full bg-blue-600/25 blur-3xl" />
        <Link href="/" className="relative flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 shadow-lg shadow-blue-900/50">
            <Icon name="heart" className="h-5 w-5" />
          </span>
          <span className="font-bold tracking-tight">MediCore AI</span>
        </Link>
        <div className="relative mt-auto mb-auto max-w-md">
          <h1 className="text-3xl font-bold leading-snug tracking-tight">
            The console where your hospital{" "}
            <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">thinks.</span>
          </h1>
          <ul className="mt-8 space-y-3.5 text-sm text-slate-400">
            {[
              "Ambient scribe drafts your SOAP notes",
              "Interaction & allergy guards on every Rx",
              "Critical lab values escalated in seconds",
              "Every PHI touch audited, immutably",
            ].map((line) => (
              <li key={line} className="flex items-center gap-2.5">
                <Icon name="check" className="h-4 w-4 shrink-0 text-emerald-400" /> {line}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-slate-600">FHIR R4 · HL7 v2 · SNOMED CT · LOINC · ICD-10</p>
      </div>

      <div className="flex flex-col justify-center px-6 py-12 sm:px-16">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-600 text-white"><Icon name="heart" className="h-4 w-4" /></span>
              MediCore AI
            </Link>
          </div>

          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Sign in</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Use a demo account below or your staff credentials.</p>

          <form onSubmit={submit} className="mt-7 space-y-4">
            <div>
              <label className="label">Username</label>
              <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
            </div>
            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">{error}</div>
            )}
            <button type="submit" className="btn-primary w-full !py-2.5" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <div className="mt-8 card !bg-slate-50/60 dark:!bg-white/5">
            <div className="label !mb-2.5">Demo accounts — one click to fill</div>
            <div className="space-y-1">
              {DEMO.map((d) => (
                <button
                  key={d.user}
                  type="button"
                  onClick={() => { setUsername(d.user); setPassword(d.pass); }}
                  className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs transition hover:bg-white hover:shadow-sm dark:hover:bg-white/10"
                >
                  <span><b className="text-slate-700 dark:text-slate-200">{d.user}</b> <span className="text-slate-400">· {d.role}</span></span>
                  <span className="hidden text-slate-400 sm:inline">{d.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <p className="mt-6 text-xs text-slate-400">
            <Link href="/" className="hover:text-slate-600">← Back to landing page</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

