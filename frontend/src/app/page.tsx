"use client";

import Link from "next/link";

import Icon from "@/components/Icon";
import { getToken } from "@/lib/api";

const STATS = [
  { value: "−40%", label: "Clinician documentation time", note: "ambient scribe" },
  { value: "≤60 min", label: "Bed turnover time", note: "orchestration agents" },
  { value: "−30%", label: "Claim denial rate", note: "coding + denial prediction" },
  { value: "99.9%", label: "Platform uptime SLA", note: "encrypted & audited" },
];

const MODULES = [
  { icon: "users", title: "Patient Master Index", desc: "One lifelong MRN with AI fuzzy duplicate detection and safe record merging." },
  { icon: "calendar", title: "OPD · IPD Scheduling", desc: "Slot-perfect doctor rosters, live token queues, double-booking protection." },
  { icon: "stethoscope", title: "EMR & e-Prescription", desc: "Encounters, vitals, SOAP notes, ICD-10 diagnoses, interaction-checked Rx." },
  { icon: "pill", title: "Pharmacy & Inventory", desc: "FEFO batch dispensing, expiry alerts, narcotics register, stock intelligence." },
  { icon: "flask", title: "Laboratory (LIS)", desc: "Analyzer-ready orders, auto abnormal/critical flagging, verification workflow." },
  { icon: "receipt", title: "Revenue Cycle", desc: "Charge capture to cash: packages, TPA pre-auths, partial payments, denials." },
  { icon: "shield", title: "Immutable Audit", desc: "Every read and write of patient data logged, queryable, tamper-evident." },
  { icon: "bed", title: "Operations Console", desc: "Bed boards, OT scheduling, discharge blockers — one live view." },
];

const AI_FEATURES = [
  {
    icon: "sparkles",
    title: "Ambient AI Scribe",
    desc: "Listens to the consultation, drafts structured SOAP notes. The doctor reviews, edits, signs — documentation time drops ~40%.",
  },
  {
    icon: "activity",
    title: "Clinical Decision Support",
    desc: "Drug–drug and allergy interactions with severity tiers, dose-range guards, deterioration early-warning scores.",
  },
  {
    icon: "search",
    title: "Coding Copilot",
    desc: "Suggests ICD-10 codes from clinical text with confidence scores and cited evidence spans before claims leave the hospital.",
  },
  {
    icon: "banknote",
    title: "Revenue Intelligence",
    desc: "Denial-risk scoring pre-submission, authorization drafting, AR prioritization by recoverability.",
  },
];

const STEPS = [
  { n: "01", title: "Register", api: "POST /api/patients", desc: "Duplicate-aware MPI with MRN issuance" },
  { n: "02", title: "Schedule", api: "POST /api/appointments", desc: "Slot engine with token queues" },
  { n: "03", title: "Consult with AI", api: "POST /api/ai/scribe/draft", desc: "Structured notes drafted, human-signed" },
  { n: "04", title: "Bill & Learn", api: "GET /api/analytics/summary", desc: "Clean claims, live metrics, feedback loop" },
];

export default function LandingPage() {
  const authed = typeof window !== "undefined" && !!getToken();
  const primary = { href: authed ? "/dashboard" : "/login", label: authed ? "Open console" : "Sign in to console" };

  return (
    <div className="min-h-screen bg-white text-slate-800">
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <a href="#" className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-lg shadow-blue-600/25">
              <Icon name="heart" className="h-5 w-5" />
            </span>
            <span className="text-[15px] font-bold tracking-tight">MediCore AI</span>
            <span className="chip border border-slate-200 bg-slate-50 text-slate-500 max-sm:hidden">v0.1</span>
          </a>
          <nav className="flex items-center gap-2">
            <a href="#platform" className="btn-ghost !text-slate-600 hover:!bg-slate-100 max-sm:hidden">Platform</a>
            <a href="#ai" className="btn-ghost !text-slate-600 hover:!bg-slate-100 max-sm:hidden">AI Layer</a>
            <a href="#security" className="btn-ghost !text-slate-600 hover:!bg-slate-100 max-sm:hidden">Security</a>
            <Link href={primary.href} className="btn-primary">{primary.label}</Link>
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-32 right-0 h-96 w-96 rounded-full bg-blue-100 blur-3xl opacity-60" />
        <div className="pointer-events-none absolute -left-24 top-24 h-72 w-72 rounded-full bg-indigo-100 blur-3xl opacity-50" />
        <div className="relative mx-auto max-w-6xl px-6 pb-20 pt-20 text-center sm:pt-28">
          <span className="chip mx-auto mb-6 inline-flex border border-blue-200 bg-blue-50 px-3 py-1 text-blue-700">
            <Icon name="sparkles" className="h-3.5 w-3.5" /> Phase 1–2 live · EMR, LIS, Pharmacy &amp; AI copilots
          </span>
          <h1 className="mx-auto max-w-3xl text-4xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-6xl">
            Run your hospital as{" "}
            <span className="bg-gradient-to-r from-blue-600 to-indigo-500 bg-clip-text text-transparent">
              one intelligent organism
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-slate-500 sm:text-lg">
            MediCore unifies patient access, clinical care, diagnostics, pharmacy and revenue on a single
            standards-first core — then layers governed AI agents over every workflow.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link href={primary.href} className="btn-primary !px-6 !py-3 !text-base shadow-lg shadow-blue-600/25">
              {primary.label} <Icon name="arrow" className="h-4 w-4" />
            </Link>
            <a href="http://localhost:8001/docs" target="_blank" rel="noreferrer" className="btn-secondary !px-6 !py-3 !text-base">
              Explore the API
            </a>
          </div>
          <p className="hint mt-4">Interactive OpenAPI docs ship with every deployment · no credit-card hospital required</p>

          <div className="mx-auto mt-14 grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label} className="card !p-4 text-left">
                <div className="text-2xl font-extrabold tracking-tight text-slate-900">{s.value}</div>
                <div className="mt-0.5 text-xs font-medium text-slate-600">{s.label}</div>
                <div className="text-[11px] text-slate-400">{s.note}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="platform" className="border-y border-slate-200/70 bg-slate-50/70 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="max-w-2xl">
            <span className="text-xs font-bold uppercase tracking-widest text-blue-600">The platform</span>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">One database. Every department.</h2>
            <p className="mt-3 text-slate-500">
              No more silos or reconciliation scripts — each module below reads and writes the same FHIR-aligned
              patient record, in real time.
            </p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {MODULES.map((m) => (
              <div key={m.title} className="card group transition-all duration-200 hover:-translate-y-0.5 hover:shadow-pop">
                <div className="mb-3 inline-grid place-items-center rounded-xl border border-blue-100 bg-blue-50 p-2.5 text-blue-600 transition-colors group-hover:bg-blue-600 group-hover:text-white">
                  <Icon name={m.icon} className="h-5 w-5" />
                </div>
                <div className="text-sm font-semibold text-slate-900">{m.title}</div>
                <p className="mt-1.5 text-[13px] leading-relaxed text-slate-500">{m.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="ai" className="relative overflow-hidden bg-slate-950 py-20 text-white">
        <div className="pointer-events-none absolute -right-32 top-0 h-96 w-96 rounded-full bg-blue-600/20 blur-3xl" />
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl">
              <span className="text-xs font-bold uppercase tracking-widest text-blue-400">The AI layer</span>
              <h2 className="mt-2 text-3xl font-bold tracking-tight">AI drafts. Humans decide.</h2>
              <p className="mt-3 text-slate-400">
                Every model call is risk-tiered, logged, and reversible. Clinicians sign; agents assist.
                Provider-pluggable — self-hosted Llama for air-gapped sites, frontier APIs elsewhere.
              </p>
            </div>
            <Link href="/consult" className="btn-secondary !border-white/20 !bg-white/10 !text-white hover:!bg-white/20">
              See the consult workspace <Icon name="arrow" className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {AI_FEATURES.map((f) => (
              <div key={f.title} className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur transition-colors hover:border-blue-500/40">
                <div className="mb-3 inline-grid place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 p-2.5 text-white shadow-lg shadow-blue-900/50">
                  <Icon name={f.icon} className="h-5 w-5" />
                </div>
                <div className="font-semibold">{f.title}</div>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center text-3xl font-bold tracking-tight text-slate-900">From walk-in to insight</h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-slate-500">
            The same journey your staff takes daily — each step backed by a documented REST API.
          </p>
          <div className="mt-12 grid gap-4 md:grid-cols-4">
            {STEPS.map((s, i) => (
              <div key={s.n} className="relative card">
                <div className="text-xs font-black tracking-widest text-blue-600">{s.n}</div>
                <div className="mt-2 font-semibold text-slate-900">{s.title}</div>
                <code className="mt-2 block truncate rounded-md bg-slate-900 px-2 py-1.5 text-[11px] font-medium text-emerald-400">
                  {s.api}
                </code>
                <p className="mt-2 text-xs text-slate-500">{s.desc}</p>
                {i < STEPS.length - 1 && (
                  <Icon name="arrow" className="absolute -right-7 top-1/2 hidden h-5 w-5 -translate-y-1/2 text-slate-300 lg:block" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="security" className="border-t border-slate-200/70 bg-slate-50/70 py-16">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 sm:grid-cols-3">
          {[
            ["Standards-first", "FHIR R4 resources, HL7 v2 feeds, SNOMED CT · LOINC · ICD-10 mappings built into the core."],
            ["Compliance packs", "HIPAA, GDPR/EU-AI-Act and India ABDM/DPDP workflows: consent, DSAR, breach tooling."],
            ["Zero-trust data", "AES-256-GCM at rest, TLS 1.3 in transit, break-glass access with mandatory justification."],
          ].map(([t, d]) => (
            <div key={t}>
              <div className="flex items-center gap-2 font-semibold text-slate-900">
                <Icon name="check" className="h-4 w-4 text-emerald-500" /> {t}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-gradient-to-br from-blue-600 to-indigo-700 py-16 text-center text-white">
        <h2 className="text-3xl font-bold tracking-tight">See your hospital think.</h2>
        <p className="mx-auto mt-3 max-w-md text-blue-100">
          Sign in with a seeded demo account and explore the full console — patients, AI copilots, billing and audit.
        </p>
        <Link href={primary.href} className="btn mt-8 bg-white !px-8 !py-3 !text-base font-semibold text-blue-700 shadow-xl hover:bg-blue-50">
          {primary.label}
        </Link>
      </section>

      <footer className="border-t border-slate-200 py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 text-sm text-slate-400">
          <div className="flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded-md bg-slate-900 text-white"><Icon name="heart" className="h-3.5 w-3.5" /></span>
            MediCore AI — Hospital Management Platform
          </div>
          <div className="flex gap-5">
            <Link href="/login" className="hover:text-slate-600">Console</Link>
            <a href="http://localhost:8001/docs" target="_blank" rel="noreferrer" className="hover:text-slate-600">API Docs</a>
            <span>v0.1.0 · Phase 0–2</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
