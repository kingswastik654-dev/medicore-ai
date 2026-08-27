"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import AppShell from "@/components/AppShell";
import Icon from "@/components/Icon";
import { Card, Button, Textarea, Input, BadgeKit, Tabs } from "@/components/kit";
import { api } from "@/lib/api";

type ScribeRes = { subjective: string; objective: string; assessment: string; plan: string; provider: string; model?: string; disclaimer: string };
type CodingRes = { code: string; description: string; confidence: number; evidence: string[] }[];
type KnowledgeHit = { title: string; body: string; score: number; tags: string };
type AskRes = { answer: string; supported: boolean; data?: unknown; question?: string };

export default function AIPage() {
  const [tab, setTab] = useState("scribe");
  const [transcript, setTranscript] = useState("Patient: Doctor, I have fever for two days with cough and chest pain on breathing. Doctor: Any sputum? Patient: Yellowish, also mild breathlessness on exertion.");
  const [scribe, setScribe] = useState<ScribeRes | null>(null);
  const [scribeLoading, setScribeLoading] = useState(false);

  const [clinicalText, setClinicalText] = useState("62-year-old hypertensive male with crushing substernal chest pain radiating to left arm, diaphoretic, BP 160/95");
  const [coding, setCoding] = useState<CodingRes>([]);
  const [codingLoading, setCodingLoading] = useState(false);

  const [q, setQ] = useState("sepsis screening criteria");
  const [hits, setHits] = useState<KnowledgeHit[]>([]);
  const [knowledgeLoading, setKnowledgeLoading] = useState(false);

  const [ask, setAsk] = useState("What is outstanding dues today?");
  const [askRes, setAskRes] = useState<AskRes | null>(null);
  const [askLoading, setAskLoading] = useState(false);

  async function runScribe() {
    if (transcript.trim().length < 10) return;
    setScribeLoading(true);
    setScribe(null);
    try {
      const r = await api<ScribeRes>("/api/ai/scribe/draft", { method: "POST", body: JSON.stringify({ transcript }) });
      setScribe(r);
    } catch (e) { setScribe({ subjective: "", objective: "", assessment: "", plan: "", provider: "error", disclaimer: e instanceof Error ? e.message : "Failed" }); }
    finally { setScribeLoading(false); }
  }
  async function runCoding() {
    if (clinicalText.trim().length < 5) return;
    setCodingLoading(true);
    try { setCoding(await api<CodingRes>("/api/ai/coding/suggest", { method: "POST", body: JSON.stringify({ text: clinicalText }) })); } catch { setCoding([]); }
    finally { setCodingLoading(false); }
  }
  async function runKnowledge() {
    if (!q.trim()) return;
    setKnowledgeLoading(true);
    try { setHits(await api<KnowledgeHit[]>(`/api/ai/knowledge/search?q=${encodeURIComponent(q)}`, { method: "POST" })); } catch { setHits([]); }
    finally { setKnowledgeLoading(false); }
  }
  async function runAsk() {
    if (!ask.trim()) return;
    setAskLoading(true);
    setAskRes(null);
    try { setAskRes(await api<AskRes>(`/api/analytics/ask?question=${encodeURIComponent(ask)}`, { method: "POST" })); } catch (e) { setAskRes({ answer: e instanceof Error ? e.message : "Failed", supported: false }); }
    finally { setAskLoading(false); }
  }

  const tabs = [
    { id: "scribe", label: "Ambient Scribe", icon: "sparkles" },
    { id: "coding", label: "Coding Copilot", icon: "receipt" },
    { id: "knowledge", label: "Knowledge RAG", icon: "search" },
    { id: "analytics", label: "Ask Analytics", icon: "activity" },
  ];

  return (
    <AppShell title="AI Copilots" subtitle="Governed, cited, and auditable — every prompt, context, model version and human decision is logged. AI drafts. You decide.">
      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      <div className="mt-6">
        <AnimatePresence mode="wait">
          {tab === "scribe" && (
            <motion.div key="scribe" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <Card>
                <div className="flex items-center gap-2 mb-3">
                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-violet-600 text-white"><Icon name="sparkles" className="h-4 w-4" /></span>
                  <div>
                    <div className="text-sm font-bold text-[var(--text)]">Ambient Scribe</div>
                    <div className="text-xs text-[var(--muted)]">Transcript → structured SOAP · human signs</div>
                  </div>
                  <BadgeKit tone="purple" dot>Streaming</BadgeKit>
                </div>
                <Textarea label="Consultation transcript" hint="Paste or dictate — supports English + code-switched Hindi" value={transcript} onChange={(e) => setTranscript(e.target.value)} className="min-h-[160px] font-mono text-xs" />
                <div className="mt-3 flex items-center gap-2">
                  <Button onClick={runScribe} loading={scribeLoading} leftIcon="sparkles">Draft SOAP with AI</Button>
                  <span className="text-xs text-[var(--muted)]">~5 s streaming · never auto-files</span>
                </div>
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800 dark:bg-amber-950/30 dark:border-amber-900/40 dark:text-amber-200">
                  <strong>Governance:</strong> Every draft is labeled AI-assisted, versioned, and requires clinician signature before filing. Refusal layer defers when context is insufficient.
                </div>
              </Card>

              <Card className="min-h-[360px]">
                {!scribe && !scribeLoading && <div className="flex h-full flex-col items-center justify-center gap-3 py-12 text-center"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--surface-2)] border border-[var(--line)] text-[var(--muted)]"><Icon name="stethoscope" className="h-6 w-6" /></div><div className="text-sm font-bold text-[var(--text)]">No draft yet</div><div className="text-xs text-[var(--muted)]">Run the scribe to see streaming SOAP fields</div></div>}
                {scribeLoading && (
                  <div className="space-y-3 animate-pulse">
                    <div className="h-4 w-24 rounded bg-[var(--surface-2)]" />
                    {[1, 2, 3, 4].map((i) => <div key={i} className="space-y-2 rounded-xl border border-[var(--line-soft)] bg-[var(--surface-2)] p-3"><div className="h-3 w-20 rounded bg-white/60" /><div className="h-3 w-full rounded bg-white/40" /><div className="h-3 w-5/6 rounded bg-white/40" /></div>)}
                  </div>
                )}
                {scribe && !scribeLoading && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <BadgeKit tone="blue">{scribe.provider}</BadgeKit>
                      {scribe.model && <BadgeKit tone="slate">{scribe.model}</BadgeKit>}
                      <BadgeKit tone="green" dot>Draft ready</BadgeKit>
                    </div>
                    <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">{scribe.disclaimer}</div>
                    <div className="grid gap-3">
                      {(["subjective", "objective", "assessment", "plan"] as const).map((k) => (
                        <div key={k} className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface-2)] p-3">
                          <div className="text-[11px] font-bold uppercase tracking-widest text-[var(--muted)]">{k}</div>
                          <div className="mt-1 text-sm leading-relaxed text-[var(--text)] whitespace-pre-wrap">{(scribe as Record<string, string>)[k] || "—"}</div>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="secondary" size="sm" onClick={() => navigator.clipboard.writeText(Object.entries(scribe).slice(0, 4).map(([k, v]) => `${k.toUpperCase()}: ${v}`).join("\n\n"))}>Copy SOAP</Button>
                      <Button variant="ghost" size="sm" onClick={() => setScribe(null)}>Clear</Button>
                    </div>
                  </div>
                )}
              </Card>
            </motion.div>
          )}

          {tab === "coding" && (
            <motion.div key="coding" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <Card>
                <div className="flex items-center gap-2 mb-3">
                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-blue-600 text-white"><Icon name="receipt" className="h-4 w-4" /></span>
                  <div><div className="text-sm font-bold">Coding Copilot</div><div className="text-xs text-[var(--muted)]">ICD-10 with confidence + evidence spans</div></div>
                </div>
                <Textarea label="Clinical text" value={clinicalText} onChange={(e) => setClinicalText(e.target.value)} className="min-h-[120px]" />
                <Button onClick={runCoding} loading={codingLoading} className="mt-3" leftIcon="search">Suggest ICD-10</Button>
              </Card>
              <Card>
                <div className="text-sm font-bold mb-3">Suggestions {coding.length > 0 && <BadgeKit tone="blue">{coding.length}</BadgeKit>}</div>
                {codingLoading && <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-xl skeleton" />)}</div>}
                {!codingLoading && coding.length === 0 && <div className="py-10 text-center text-sm text-[var(--muted)]">No suggestions yet — describe a diagnosis, symptom, or procedure.</div>}
                <div className="space-y-2.5">
                  {coding.map((s) => (
                    <div key={s.code} className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div><div className="text-sm font-bold text-[var(--text)]">{s.code} — {s.description}</div><div className="mt-1 flex flex-wrap gap-1">{s.evidence.map((ev) => <BadgeKit key={ev} tone="slate">{ev}</BadgeKit>)}</div></div>
                        <BadgeKit tone={s.confidence > 80 ? "green" : s.confidence > 60 ? "amber" : "slate"}>{s.confidence}%</BadgeKit>
                      </div>
                      <div className="mt-2 h-1.5 rounded-full bg-[var(--surface-3)] overflow-hidden"><div className="h-full bg-[var(--brand)] rounded-full" style={{ width: `${s.confidence}%` }} /></div>
                    </div>
                  ))}
                </div>
              </Card>
            </motion.div>
          )}

          {tab === "knowledge" && (
            <motion.div key="knowledge" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">
              <Card>
                <div className="flex gap-2">
                  <div className="flex-1"><Input label="Ask the protocol corpus" placeholder="e.g. sepsis screening criteria" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && runKnowledge()} /></div>
                  <Button onClick={runKnowledge} loading={knowledgeLoading} className="self-end" leftIcon="search">Search</Button>
                </div>
                <p className="mt-2 text-xs text-[var(--muted)]">RAG over sepsis qSOFA, HTN, anticoagulation, diabetes — scored hits with citations.</p>
              </Card>
              <div className="grid gap-3">
                {knowledgeLoading && [1, 2, 3].map((i) => <Card key={i} className="h-24 skeleton" />)}
                {!knowledgeLoading && hits.length === 0 && <Card className="py-10 text-center text-sm text-[var(--muted)]">No results — try “hypertension lifestyle” or “warfarin INR”.</Card>}
                {hits.map((h, i) => (
                  <motion.div key={h.title + i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                    <Card hover>
                      <div className="flex items-start justify-between gap-3">
                        <div className="text-sm font-bold text-[var(--text)]">{h.title}</div>
                        <BadgeKit tone="blue">{Math.round(h.score * 100)}% match</BadgeKit>
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{h.body}</p>
                      <div className="mt-3 flex flex-wrap gap-1.5">{h.tags.split(",").map((t) => <BadgeKit key={t.trim()} tone="slate">{t.trim()}</BadgeKit>)}</div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {tab === "analytics" && (
            <motion.div key="analytics" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <Card>
                <div className="flex items-center gap-2 mb-3">
                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-600 text-white"><Icon name="activity" className="h-4 w-4" /></span>
                  <div><div className="text-sm font-bold">Conversational Analytics</div><div className="text-xs text-[var(--muted)]">Grounded in governed metrics</div></div>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {["What is outstanding dues today?", "How many appointments today?", "Revenue today vs last week?", "OT utilization this week?"].map((s) => (
                    <button key={s} onClick={() => setAsk(s)} className="rounded-full border border-[var(--line)] bg-[var(--surface-2)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--surface-3)]">{s}</button>
                  ))}
                </div>
                <Textarea label="Ask your hospital anything" value={ask} onChange={(e) => setAsk(e.target.value)} className="min-h-[80px]" />
                <Button onClick={runAsk} loading={askLoading} className="mt-3" leftIcon="activity">Ask</Button>
              </Card>
              <Card className="min-h-[260px]">
                {!askRes && !askLoading && <div className="py-10 text-center text-sm text-[var(--muted)]">Ask a question about revenue, patients, appointments, or operations.</div>}
                {askLoading && <div className="space-y-3"><div className="h-4 w-32 rounded skeleton" /><div className="h-20 rounded-xl skeleton" /></div>}
                {askRes && !askLoading && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <BadgeKit tone={askRes.supported ? "green" : "amber"} dot>{askRes.supported ? "Supported" : "Unsupported intent"}</BadgeKit>
                      {askRes.question && <span className="text-xs text-[var(--muted)]">“{askRes.question}”</span>}
                    </div>
                    <div className="rounded-xl bg-[var(--surface-2)] border border-[var(--line-soft)] p-4 text-sm leading-relaxed whitespace-pre-wrap">{askRes.answer}</div>
                    {askRes.data !== undefined && <pre className="overflow-auto rounded-xl bg-slate-900 p-4 text-xs text-emerald-300">{JSON.stringify(askRes.data, null, 2)}</pre>}
                  </div>
                )}
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppShell>
  );
}
