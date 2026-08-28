"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import Icon from "@/components/Icon";
import { Reveal, CountUp, TypeWriter, useInView } from "@/components/motion";
import { getToken } from "@/lib/api";
import { useTheme } from "@/components/theme";

const STANDARDS = [
  "HL7 FHIR R4", "HIPAA", "GDPR · EU AI Act", "ABDM / ABHA", "SNOMED CT",
  "LOINC", "ICD-10", "DICOM-ready", "DPDP Act", "NABH-aligned", "AES-256-GCM",
  "HL7 v2.x",
];

const PAINS = [
  { icon: "clock", stat: 45, suffix: "%", label: "of clinician time lost to paperwork", note: "charts, forms and follow-ups swallow the day" },
  { icon: "bed", stat: 111, suffix: " min", label: "average bed turnover time", note: "idle beds while admissions queue at the desk" },
  { icon: "receipt", stat: 18, prefix: "", suffix: "%", label: "of revenue leaks each year", note: "denials, coding gaps and unclaimed dues" },
  { icon: "users", stat: 30, suffix: "%", label: "of staff hours hunting data", note: "across systems that never talk to each other" },
  { icon: "alert", stat: 1, suffix: " in 10", label: "patients harmed by delay", note: "missing results and silent handoffs" },
  { icon: "activity", stat: 71, suffix: "%", label: "of IT projects overrun", note: "18-month legacy implementations" },
];

const BENTO = [
  { icon: "users", title: "Patient Master Index", span: "lg:col-span-3 lg:row-span-2", big: true,
    desc: "One lifelong MRN per human. AI fuzzy-matches duplicates before they're born into your data, merges history safely, and links ABHA / national IDs.",
    points: ["Duplicate scoring at registration", "Safe merge re-points every reference", "Consent & identity capture"] },
  { icon: "stethoscope", title: "Consult workspace", span: "lg:col-span-3",
    desc: "Vitals to vitals-signed note in minutes — scribe drafts, you sign." },
  { icon: "pill", title: "Pharmacy FEFO", span: "lg:col-span-3",
    desc: "Earliest-expiry-first dispensing with interaction & allergy hard-stops." },
  { icon: "flask", title: "LIS with criticals", span: "lg:col-span-2",
    desc: "STAT-first worklists; critical values escalated in seconds." },
  { icon: "calendar", title: "Smart scheduling", span: "lg:col-span-2",
    desc: "Slot engine with token queues and no double-booking." },
  { icon: "receipt", title: "Revenue cycle", span: "lg:col-span-2",
    desc: "Charge-to-cash with pre-submission denial scoring." },
];

const COPILOTS = [
  { title: "Ambient Scribe", desc: "Drafts structured SOAP notes from the room's conversation. You review, edit, sign.", metric: "−40% documentation time" },
  { title: "Clinical Guardrails", desc: "Interaction, allergy and dose guards on every order — explainable, cited, overridable with reason.", metric: "−50% prescription errors" },
  { title: "Coding Copilot", desc: "ICD-10 suggestions with evidence spans before claims leave the building.", metric: "+clean-claim rate" },
  { title: "Ops Forecasting", desc: "Predicts OPD rush and discharge readiness so beds and staff move before the queue does.", metric: "≤60 min bed turnover" },
];

const STEPS = [
  { n: "01", t: "Register", api: "POST /api/patients", d: "Duplicate-aware MPI issues one MRN for life." },
  { n: "02", t: "Schedule", api: "POST /api/appointments", d: "Slot-perfect booking with token queues." },
  { n: "03", t: "Consult with AI", api: "POST /ai/scribe/draft", d: "Notes draft themselves; you stay the author." },
  { n: "04", t: "Bill & learn", api: "GET /analytics/summary", d: "Clean claims out; every rupee tracked back." },
];

const INTEGRATIONS = [
  ["FHIR R4", "clinical resources"], ["HL7 v2", "ADT · ORM · ORU"], ["DICOM", "imaging ready"],
  ["ABHA", "India health ID"], ["SNOMED CT", "terminology"], ["LOINC", "lab coding"],
  ["ICD-10", "diagnoses"], ["X12 837/835", "payer EDI"], ["WhatsApp", "patient channel"],
  ["UPI", "payments"], ["ASTM", "analyzers"], ["REST + Webhooks", "everything else"],
];

export default function LandingPage() {
  // Resolve auth after mount — avoids SSR/client hydration mismatch on the CTA
  const [authed, setAuthed] = useState(false);
  useEffect(() => {
    setAuthed(!!getToken());
  }, []);
  const primary = { href: authed ? "/dashboard" : "/login", label: authed ? "Open console" : "Open live console" };
  const [menu, setMenu] = useState(false);
  const statsRef = useInView<HTMLDivElement>(0.3);
  const { dark, toggle } = useTheme();

  return (
    <div className={`min-h-screen font-sans ${dark ? "bg-[#0b1220] text-slate-200" : "bg-white text-navy"}`}>
      {/* NAV */}
      <header className={`fixed inset-x-0 top-0 z-50 border-b backdrop-blur-xl ${dark ? "border-white/10 bg-slate-950/70" : "border-white/40 bg-white/70"}`}>
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-clinical-500 to-clinical-700 text-white shadow-lg shadow-blue-600/30">
              <Icon name="heart" className="h-5 w-5" />
            </span>
            <span className="text-[15px] font-bold tracking-tight">MediCore<span className="text-blue-600">AI</span></span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {[["Platform", "#platform"], ["AI layer", "#ai"], ["How it works", "#how"], ["Security", "#security"]].map(([label, href]) => (
              <a key={href} href={href} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-clinical-100 hover:text-navy dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white">{label}</a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <a href="http://localhost:8000/docs" target="_blank" rel="noreferrer" className="hidden rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-clinical-100 hover:text-navy sm:block dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white">API</a>
            <Link href={primary.href} className="btn-primary !rounded-full !px-5 shadow-blue-600/25">{primary.label}</Link>
            <button onClick={() => toggle()} aria-label="Toggle theme" className="theme-toggle ml-1 hidden sm:inline-flex"><span className="knob" /></button>
            <button className="btn-secondary !px-2.5 md:hidden" aria-label="Menu" onClick={() => setMenu((m) => !m)}>
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
            </button>
          </div>
        </div>
        {menu && (
          <div className="border-t border-slate-100 bg-white/95 px-5 py-3 backdrop-blur-xl md:hidden dark:border-white/10 dark:bg-slate-950/95">
            {[["Platform", "#platform"], ["AI layer", "#ai"], ["How it works", "#how"], ["Security", "#security"]].map(([label, href]) => (
              <a key={href} href={href} onClick={() => setMenu(false)} className="block rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-clinical-100 dark:text-slate-300 dark:hover:bg-white/10">{label}</a>
            ))}
            <div className="mt-2 flex items-center justify-between gap-3 border-t border-slate-100 pt-3 dark:border-white/10">
              <Link href={primary.href} className="btn-primary flex-1 !rounded-full text-center shadow-blue-600/25">{primary.label}</Link>
              <button onClick={() => toggle()} aria-label="Toggle theme" className="theme-toggle shrink-0"><span className="knob" /></button>
            </div>
          </div>
        )}
      </header>

      {/* HERO */}
      <section className="noise relative overflow-hidden hero-bg pb-24 pt-36 sm:pt-44">
        <div className="float-a pointer-events-none absolute -left-32 top-32 h-96 w-96 rounded-full bg-blue-200/50 blur-3xl dark:bg-blue-500/20" />
        <div className="float-b pointer-events-none absolute -right-24 top-16 h-[28rem] w-[28rem] rounded-full bg-indigo-200/40 blur-3xl dark:bg-indigo-500/15" />

        <div className="relative mx-auto max-w-6xl px-5 text-center">
          <Reveal>
            <span className="chip mx-auto border border-blue-200 bg-white/80 px-3.5 py-1.5 text-blue-700 shadow-sm dark:border-blue-500/30 dark:bg-white/10 dark:text-blue-300">
              <span className="eq-bar inline-block h-3 w-[3px] rounded bg-blue-600" style={{ ["--i" as never]: 0 }} />
              <span className="eq-bar inline-block h-3 w-[3px] rounded bg-blue-500" style={{ ["--i" as never]: 1 }} />
              <span className="eq-bar inline-block h-3 w-[3px] rounded bg-indigo-500" style={{ ["--i" as never]: 2 }} />
              Live now · EMR, LIS, pharmacy, billing &amp; four AI copilots
            </span>
          </Reveal>

          <Reveal delay={90}>
            <h1 className="font-display mx-auto mt-7 max-w-4xl text-5xl font-bold leading-[1.08] tracking-tight sm:text-7xl">
              The hospital that
              <br />
              <span className="gradient-text italic">thinks ahead of you</span>
            </h1>
          </Reveal>

          <Reveal delay={180}>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-500 dark:text-slate-400">
              MediCore runs patient flow, clinical care, diagnostics, pharmacy and revenue on one core —
              then puts AI copilots on top:{" "}
              <span className="font-semibold text-navy dark:text-slate-100">
                <TypeWriter
                  words={[
                    "notes that write themselves.",
                    "drug interactions caught before they happen.",
                    "claims scored before payers deny them.",
                    "beds turned while the lift is still coming.",
                  ]}
                />
              </span>
            </p>
          </Reveal>

          <Reveal delay={260}>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <span className="shine-wrap">
                <Link href={primary.href} className="btn relative !rounded-full !bg-blue-600 !px-8 !py-3.5 !text-base !text-white hover:!bg-blue-700">
                  {primary.label} <Icon name="arrow" className="h-4 w-4" />
                </Link>
              </span>
              <a href="http://localhost:8000/docs" target="_blank" rel="noreferrer" className="btn btn-secondary !rounded-full !px-8 !py-3.5 !text-base">
                Explore the API
              </a>
            </div>
          </Reveal>

          {/* PRODUCT MOCK */}
          <Reveal delay={340}>
            <div className="relative mx-auto mt-16 max-w-5xl">
              <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-r from-blue-200/60 via-indigo-100/60 to-teal-100/60 blur-2xl dark:from-blue-500/25 dark:via-indigo-500/20 dark:to-teal-500/20" />
              <div className="glass overflow-hidden rounded-2xl shadow-pop ring-1 ring-slate-900/5">
                <div className="flex items-center gap-2 border-b border-slate-200/70 bg-white/60 px-4 py-3">
                  <span className="h-3 w-3 rounded-full bg-rose-400" />
                  <span className="h-3 w-3 rounded-full bg-amber-400" />
                  <span className="h-3 w-3 rounded-full bg-emerald-400" />
                  <span className="ml-3 hidden rounded-md bg-slate-900/90 px-3 py-1 font-mono text-[11px] text-emerald-400 sm:block">
                    medcore.local/consult
                  </span>
                  <span className="ml-auto chip border border-emerald-200 bg-emerald-50 text-emerald-600">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> all systems live
                  </span>
                </div>

                <div className="grid gap-0 md:grid-cols-[220px_1fr_240px]">
                  <div className="hidden border-r border-slate-200/70 bg-white/50 p-4 md:block">
                    {[["dashboard", "Dashboard"], ["users", "Patients"], ["calendar", "Appointments"], ["stethoscope", "Consult"], ["bed", "Operations"], ["receipt", "Billing"]].map(([icon, label], i) => (
                      <div key={label} className={`mb-1 flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium ${i === 3 ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow" : "text-slate-500"}`}>
                        <Icon name={icon} className="h-4 w-4" /> {label}
                      </div>
                    ))}
                  </div>

                  <div className="p-5 text-left">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Ward A · bed telemetry</div>
                        <div className="mt-1 flex items-end gap-3">
                          <span className="text-3xl font-extrabold tracking-tight">A05</span>
                          <span className="chip border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-300">occupied · HR 76</span>
                        </div>
                      </div>
                    </div>
                    <svg viewBox="0 0 600 120" className="mt-3 w-full">
                      <path className="ecg-path" fill="none" stroke="#1B4FD8" strokeWidth="2.5" strokeLinecap="round"
                        d="M0 70 H60 L75 70 82 38 92 95 102 55 110 70 H180 L195 70 202 42 212 92 222 58 230 70 H330 L345 70 352 34 362 98 372 52 380 70 H480 L495 70 502 44 512 90 522 56 530 70 H600" />
                      <circle cx="82" cy="38" r="4" fill="#03C3B6" className="ecg-dot" />
                    </svg>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                      {[["SpO₂", "97%"], ["BP", "128/82"], ["Temp", "98.9°F"]].map(([k, v]) => (
                        <div key={k} className="rounded-lg border border-slate-200/80 bg-white/70 py-2">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{k}</div>
                          <div className="text-sm font-bold">{v}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border-l border-slate-200/70 bg-gradient-to-b from-clinical-100/70 to-white p-4 text-left">
                    <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-purple-600">
                      <Icon name="sparkles" className="h-4 w-4" /> AI copilot
                    </div>
                    <div className="space-y-2.5 text-[12px] leading-relaxed">
                      <div className="rounded-xl rounded-tl-sm border border-purple-100 bg-white p-2.5 shadow-sm">
                        <b>Warfarin + Aspirin</b><br />MAJOR bleed risk flagged. Suggest stopping ASA-75.
                      </div>
                      <div className="rounded-xl rounded-tl-sm border border-amber-100 bg-amber-50/70 p-2.5 text-amber-800">
                        Discharge readiness A05: <b>score 85</b> — labs verified ✓, bill cleared ✓.
                      </div>
                      <div className="rounded-xl rounded-tl-sm bg-navy p-2.5 text-white">
                        Tomorrow&apos;s OPD forecast: <b>142 visits</b> ±15%. Suggest 2 extra slots at 09:00.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* MARQUEE */}
      <section className="marquee-strip marquee overflow-hidden border-y border-slate-200/70 py-4 dark:border-white/10">
        <div className="marquee-track items-center gap-10 pr-10">
          {[...STANDARDS, ...STANDARDS].map((s, i) => (
            <span key={`${s}-${i}`} className="flex items-center gap-3 whitespace-nowrap text-sm font-semibold text-slate-400 dark:text-slate-400">
              <Icon name="check" className="h-4 w-4 text-teal-500" /> {s}
              <span className="ml-7 h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-600" />
            </span>
          ))}
        </div>
      </section>

      {/* PROBLEM */}
      <section ref={statsRef.ref as never}>
        <Reveal>
          <span className="eyebrow">The problem</span>
          <h2 className="font-display mt-3 max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
            Hospitals are drowning in their own admin.
          </h2>
          <p className="mt-4 max-w-xl text-slate-500 dark:text-slate-400">The math every COO already feels — measured across the industry, not hypothetical.</p>
        </Reveal>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PAINS.map((p, i) => (
            <Reveal key={p.label} delay={i * 70}>
              <div className="card-recolor h-full p-6">
                <div className="flex items-start justify-between">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-clinical-100 text-clinical-600 dark:bg-blue-500/15 dark:text-blue-300"><Icon name={p.icon} className="h-5 w-5" /></span>
                  <span className="text-right font-display text-3xl font-bold text-navy dark:text-slate-100">
                    <CountUp to={p.stat} suffix={p.suffix} />
                  </span>
                </div>
                <div className="mt-4 font-semibold leading-snug">{p.label}</div>
                <p className="hint mt-1.5">{p.note}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* PLATFORM BENTO */}
      <section id="platform" className="section-tint py-24">
        <div className="mx-auto max-w-6xl px-5">
          <Reveal>
            <span className="eyebrow">One platform</span>
            <h2 className="font-display mt-3 max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
              Every department. One heartbeat.
            </h2>
          </Reveal>
          <div className="mt-12 grid auto-rows-[minmax(140px,auto)] gap-4 sm:grid-cols-2 lg:grid-cols-6">
            {BENTO.map((m, i) => (
              <Reveal key={m.title} delay={i * 60} className={`${m.span} h-full`}>
                <div className="card-recolor flex h-full flex-col p-6">
                  <span className="mb-4 inline-grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-clinical-500 to-indigo-500 text-white shadow-md shadow-blue-600/20">
                    <Icon name={m.icon} className="h-5 w-5" />
                  </span>
                  <div className="font-semibold">{m.title}</div>
                  <p className={`mt-1.5 text-slate-500 dark:text-slate-400 ${m.big ? "text-sm leading-relaxed" : "text-[13px]"}`}>{m.desc}</p>
                  {m.points && (
                    <ul className="mt-auto space-y-1.5 pt-4 text-xs text-slate-500 dark:text-slate-400">
                      {m.points.map((pt) => (
                        <li key={pt} className="flex items-center gap-2"><Icon name="check" className="h-3.5 w-3.5 text-teal-500" />{pt}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* AI DARK */}
      <section id="ai" className="noise relative overflow-hidden bg-navy py-24 text-white">
        <div className="pointer-events-none absolute -right-40 top-0 h-[30rem] w-[30rem] rounded-full bg-blue-600/25 blur-3xl" />
        <div className="pointer-events-none absolute -left-40 bottom-0 h-[26rem] w-[26rem] rounded-full bg-teal-500/15 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-5">
          <div className="max-w-2xl">
            <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-teal-300">Governed AI layer</span>
            <h2 className="font-display mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
              Four copilots. Every guardrail.
            </h2>
            <p className="mt-4 text-slate-400">
              Risk-tiered autonomy with human sign-off on anything clinical. Self-hosted models for air-gapped
              sites; frontier APIs where policy allows. Every prompt, output and acceptance logged forever.
            </p>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2">
            {COPILOTS.map((c, i) => (
              <Reveal key={c.title} delay={i * 80}>
                <div className="group h-full rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur transition-all duration-300 hover:border-teal-400/40 hover:bg-white/[0.07]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-end gap-1" aria-hidden>
                      {[0, 1, 2, 3, 4, 5].map((b) => (
                        <span key={b} className="eq-bar inline-block h-6 w-1 rounded-sm bg-gradient-to-t from-teal-400 to-blue-400" style={{ ["--i" as never]: b }} />
                      ))}
                    </div>
                    <span className="chip border border-teal-400/30 bg-teal-400/10 text-teal-300">{c.metric}</span>
                  </div>
                  <div className="mt-4 font-semibold">{c.title}</div>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{c.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <p className="mt-8 text-center font-display text-xl italic text-slate-300">
            “AI drafts. Humans decide. Everything is audited.”
          </p>
        </div>
      </section>

      {/* HOW */}
      <section id="how" className="mx-auto max-w-6xl px-5 py-24">
        <Reveal><h2 className="font-display text-center text-4xl font-bold tracking-tight">Walk-in to insight, in four moves</h2></Reveal>
        <div className="relative mt-14 grid gap-4 md:grid-cols-4">
          <div className="absolute left-0 right-0 top-7 hidden h-px bg-gradient-to-r from-transparent via-blue-300 to-transparent md:block" />
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 90}>
              <div className="card relative h-full pt-8 text-center">
                <span className="absolute -top-5 left-1/2 grid h-10 w-10 -translate-x-1/2 place-items-center rounded-full bg-blue-600 font-display text-sm font-bold text-white shadow-lg shadow-blue-600/30 ring-4 ring-white dark:ring-[#070d1f]">
                  {s.n}
                </span>
                <div className="font-semibold">{s.t}</div>
                <code className="mt-2 block truncate rounded-lg bg-slate-950 px-2 py-1.5 text-[11px] font-medium text-emerald-400">{s.api}</code>
                <p className="hint mt-2">{s.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* INTEGRATIONS */}
      <section className="section-tint py-20">
        <div className="mx-auto max-w-6xl px-5 text-center">
          <Reveal>
            <span className="eyebrow">Speaks healthcare natively</span>
            <h2 className="font-display mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Standards in, standards out</h2>
          </Reveal>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            {INTEGRATIONS.map(([name, note], i) => (
              <Reveal key={name} delay={i * 35}>
                <div className="glass group flex items-center gap-3 rounded-2xl px-5 py-3.5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-pop">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-navy text-teal-300 dark:bg-white/10"><Icon name="activity" className="h-4 w-4" /></span>
                  <span className="text-left"><span className="block text-sm font-bold">{name}</span>
                  <span className="block text-[11px] text-slate-400">{note}</span></span>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* SECURITY */}
      <section id="security" className="mx-auto max-w-6xl px-5 py-24">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <Reveal>
            <span className="eyebrow">Trust architecture</span>
            <h2 className="font-display mt-3 text-4xl font-bold tracking-tight">Built like a bank.<br />Audited like a lab.</h2>
            <p className="mt-4 max-w-md text-slate-500 dark:text-slate-400">
              Immutable audit trails on every record touch, break-glass access with mandatory justification,
              region-pinned storage, and AI that refuses when it isn&apos;t sure.
            </p>
          </Reveal>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ["shield", "Immutable audit", "Every PHI read/write, forever queryable"],
              ["lock", "AES-256-GCM", "At rest, in transit, field-level for IDs"],
              ["users", "Least privilege", "RBAC + break-glass with justification"],
              ["sparkles", "Honest AI", "Refusal layer — defers rather than invents"],
            ].map(([icon, t, d], i) => (
              <Reveal key={t} delay={i * 70}>
                <div className="card-recolor p-5">
                  <Icon name={icon} className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <div className="mt-3 text-sm font-semibold">{t}</div>
                  <p className="hint mt-1">{d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden bg-gradient-to-br from-clinical-600 via-blue-700 to-indigo-800 py-20 text-center text-white noise">
        <Reveal>
          <h2 className="font-display mx-auto max-w-2xl px-5 text-4xl font-bold tracking-tight sm:text-5xl">
            Your hospital already generates the data. Start generating the intelligence.
          </h2>
          <div className="mt-9 flex justify-center">
            <span className="shine-wrap">
              <Link href={primary.href} className="btn relative !rounded-full bg-white !px-9 !py-4 !text-base font-semibold !text-clinical-700 hover:!bg-blue-50">
                {primary.label} — it&apos;s seeded with demo patients <Icon name="arrow" className="h-4 w-4" />
              </Link>
            </span>
          </div>
          <p className="mt-5 text-sm text-blue-200">No install. No sales call. Six demo roles, full console.</p>
        </Reveal>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-slate-200 bg-white py-10 dark:border-white/10 dark:bg-slate-950">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-5 px-5 text-sm text-slate-400">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-navy text-teal-300 dark:bg-white/10"><Icon name="heart" className="h-4 w-4" /></span>
            <span className="font-semibold text-slate-600 dark:text-slate-300">MediCore<span className="text-blue-600 dark:text-blue-400">AI</span></span>
            <span className="hidden sm:inline">— The Intelligent Hospital OS</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/login" className="hover:text-slate-600">Console</Link>
            <a href="http://localhost:8000/docs" target="_blank" rel="noreferrer" className="hover:text-slate-600">API docs</a>
            <span>v0.1 · Phases 0–4 live</span>
          </div>
        </div>
      </footer>
    </div>
  );
}


