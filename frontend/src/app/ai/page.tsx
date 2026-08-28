"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import AppShell from "@/components/AppShell";
import Icon from "@/components/Icon";
import { Card, CardHeader, CardTitle, Button, Textarea, Input, BadgeKit, Tabs, useToast } from "@/components/kit";
import { api } from "@/lib/api";

type ScribeRes = { subjective: string; objective: string; assessment: string; plan: string; provider: string; model?: string; disclaimer: string };
type CodingRes = { code: string; description: string; confidence: number; evidence: string[] }[];
type KnowledgeHit = { title: string; body: string; score: number; tags: string };
type AskRes = { answer: string; supported: boolean; data?: unknown; question?: string };

function StreamingText({ text, speed = 18, className = "" }: { text: string; speed?: number; className?: string }) {
  const [visible, setVisible] = useState("");
  useEffect(() => {
    if (!text) { setVisible(""); return; }
    let i = 0;
    setVisible("");
    const id = setInterval(() => {
      i++;
      setVisible(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);
  return <span className={className}>{visible}<span className="tw-caret" /></span>;
}

const FEEDBACK: Record<string, string> = {};

export default function AIPage() {
  const toast = useToast();
  const [tab, setTab] = useState("scribe");
  const [transcript, setTranscript] = useState(
    "Patient: Doctor, I have fever for two days with cough and chest pain on breathing. Doctor: Any sputum? Patient: Yellowish, also mild breathlessness on exertion."
  );
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

  const [feedback, setFeedback] = useState<Record<string, "positive" | "negative">>(() => {
    const k = "ai_feedback_" + tab;
    if (typeof window !== "undefined") {
      const raw = localStorage.getItem(k);
      if (raw) return JSON.parse(raw);
    }
    return {};
  });

  function saveFeedback(key: string, val: "positive" | "negative") {
    const fb = { ...feedback, [key]: val };
    setFeedback(fb);
    FEEDBACK[tab] = val;
    if (typeof window !== "undefined") {
      localStorage.setItem("ai_feedback_" + tab, JSON.stringify(fb));
    }
  }

  async function runScribe() {
    if (transcript.trim().length < 10) return;
    setScribeLoading(true);
    setScribe(null);
    saveFeedback("scribe", "positive");
    try {
      const r = await api<ScribeRes>("/api/ai/scribe/draft", { method: "POST", body: JSON.stringify({ transcript }) });
      setScribe(r);
      toast.push({ kind: "success", title: "SOAP drafted", description: `${r.provider} · ${r.model ?? "default"}` });
    } catch (e) {
      setScribe({ subjective: "", objective: "", assessment: "", plan: "", provider: "error", disclaimer: e instanceof Error ? e.message : "Failed" });
      toast.push({ kind: "error", title: "Draft failed", description: e instanceof Error ? e.message : "Try again" });
    } finally {
      setScribeLoading(false);
    }
  }

  async function runCoding() {
    if (clinicalText.trim().length < 5) return;
    setCodingLoading(true);
    try {
      setCoding(await api<CodingRes>("/api/ai/coding/suggest", { method: "POST", body: JSON.stringify({ text: clinicalText }) }));
      toast.push({ kind: "success", title: "Suggestions ready", description: `${coding.length} ICD-10 codes` });
    } catch (e) {
      setCoding([]);
      toast.push({ kind: "error", title: "Coding failed", description: e instanceof Error ? e.message : "Try again" });
    } finally {
      setCodingLoading(false);
    }
  }

  async function runKnowledge() {
    if (!q.trim()) return;
    setKnowledgeLoading(true);
    try {
      const data = await api<KnowledgeHit[]>(`/api/ai/knowledge/search?q=${encodeURIComponent(q)}`);
      setHits(data);
      toast.push({ kind: "success", title: "Knowledge search", description: `${data.length} hits` });
    } catch (e) {
      setHits([]);
      toast.push({ kind: "error", title: "Search failed", description: e instanceof Error ? e.message : "Try again" });
    } finally {
      setKnowledgeLoading(false);
    }
  }

  async function runAsk() {
    if (!ask.trim()) return;
    setAskLoading(true);
    setAskRes(null);
    try {
      const r = await api<AskRes>(`/api/analytics/ask?question=${encodeURIComponent(ask)}`, { method: "POST" });
      setAskRes(r);
    } catch (e) {
      setAskRes({ answer: e instanceof Error ? e.message : "Failed", supported: false });
    } finally {
      setAskLoading(false);
    }
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
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <span className="grid h-8 w-8 place-items-center rounded-xl bg-violet-600 text-white"><Icon name="sparkles" className="h-4 w-4" /></span>
                    <div>
                      <CardTitle>Ambient Scribe</CardTitle>
                      <p className="text-xs text-[var(--muted)]">Transcript → structured SOAP · human signs</p>
                    </div>
                    <BadgeKit tone="purple" dot>Streaming</BadgeKit>
                  </div>
                </CardHeader>
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
                {!scribe && !scribeLoading && (
                  <div className="flex h-full flex-col items-center justify-center gap-3 py-12 text-center">
                    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--surface-2)] border border-[var(--line)] text-[var(--muted)]">
                      <Icon name="stethoscope" className="h-6 w-6" />
                    </div>
                    <div className="text-sm font-bold text-[var(--text)]">No draft yet</div>
                    <div className="text-xs text-[var(--muted)]">Run the scribe to see streaming SOAP fields</div>
                  </div>
                )}
                {scribeLoading && (
                  <motion.div
                    className="space-y-3"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ staggerChildren: 0.1 }}
                  >
                    <div className="h-4 w-24 rounded bg-[var(--surface-2)] skeleton" />
                    {[1, 2, 3, 4].map((i) => (
                      <motion.div key={i} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="space-y-2 rounded-xl border border-[var(--line-soft)] bg-[var(--surface-2)] p-3">
                        <div className="h-3 w-20 rounded bg-white/60" />
                        <div className="h-3 w-full rounded bg-white/40" />
                        <div className="h-3 w-5/6 rounded bg-white/40" />
                      </motion.div>
                    ))}
                  </motion.div>
                )}
                {scribe && !scribeLoading && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                    <div className="flex items-center gap-2">
                      <BadgeKit tone="blue">{scribe.provider}</BadgeKit>
                      {scribe.model && <BadgeKit tone="slate">{scribe.model}</BadgeKit>}
                      <BadgeKit tone="green" dot>Draft ready</BadgeKit>
                      <div className="ml-auto flex gap-1">
                        <motion.button whileTap={{ scale: 0.88 }} onClick={() => saveFeedback("scribe", "positive")} aria-label="Helpful">
                          <Icon name="check" className={`h-4 w-4 ${feedback.scribe === "positive" ? "text-green-600" : "text-slate-400"}`} />
                        </motion.button>
                        <motion.button whileTap={{ scale: 0.88 }} onClick={() => saveFeedback("scribe", "negative")} aria-label="Not helpful">
                          <Icon name="alert" className={`h-4 w-4 ${feedback.scribe === "negative" ? "text-rose-600" : "text-slate-400"}`} />
                        </motion.button>
                      </div>
                    </div>
                    <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">{scribe.disclaimer}</div>
                    <div className="grid gap-3">
                      {(["subjective", "objective", "assessment", "plan"] as const).map((k, i) => (
                        <motion.div
                          key={k}
                          className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface-2)] p-3"
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.06 }}
                        >
                          <div className="text-[11px] font-bold uppercase tracking-widest text-[var(--muted)]">{k}</div>
                          <div className="mt-1 text-sm leading-relaxed text-[var(--text)] whitespace-pre-wrap">
                            <StreamingText text={(scribe as Record<string, string>)[k] || "—"} speed={12} />
                          </div>
                        </motion.div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="secondary" size="sm" onClick={() => navigator.clipboard.writeText(Object.entries(scribe).slice(0, 4).map(([k, v]) => `${k.toUpperCase()}: ${v}`).join("\n\n"))}>Copy SOAP</Button>
                      <Button variant="ghost" size="sm" onClick={() => setScribe(null)}>Clear</Button>
                    </div>
                  </motion.div>
                )}
              </Card>
            </motion.div>
          )}

          {tab === "coding" && (
            <motion.div key="coding" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <span className="grid h-8 w-8 place-items-center rounded-xl bg-blue-600 text-white"><Icon name="receipt" className="h-4 w-4" /></span>
                    <div>
                      <CardTitle>Coding Copilot</CardTitle>
                      <p className="text-xs text-[var(--muted)]">ICD-10 with confidence + evidence spans</p>
                    </div>
                  </div>
                </CardHeader>
                <Textarea label="Clinical text" value={clinicalText} onChange={(e) => setClinicalText(e.target.value)} className="min-h-[120px]" />
                <Button onClick={runCoding} loading={codingLoading} className="mt-3" leftIcon="search">Suggest ICD-10</Button>
              </Card>
              <Card>
                <div className="text-sm font-bold mb-3">
                  Suggestions {coding.length > 0 && <BadgeKit tone="blue">{coding.length}</BadgeKit>}
                </div>
                {codingLoading && <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-xl skeleton" />)}</div>}
                {!codingLoading && coding.length === 0 && <div className="py-10 text-center text-sm text-[var(--muted)]">No suggestions yet — describe a diagnosis, symptom, or procedure.</div>}
                <AnimatePresence>
                  <div className="space-y-2.5">
                    {coding.map((s, i) => (
                      <motion.div
                        key={s.code}
                        initial={{ opacity: 0, x: 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 12 }}
                        transition={{ delay: i * 0.06, duration: 0.3 }}
                        className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-3 group"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-sm font-bold text-[var(--text)]">{s.code}</span>
                              <span className="text-sm text-[var(--text-secondary)]">{s.description}</span>
                              <motion.button
                                whileTap={{ scale: 0.85 }}
                                onClick={() => { navigator.clipboard.writeText(s.code); toast.push({ kind: "info", title: "Copied", description: `${s.code} copied to clipboard` }); }}
                                aria-label={`Copy ${s.code}`}
                              >
                                <Icon name="check" className="h-3 w-3 text-[var(--muted-2)] hover:text-[var(--brand)]" />
                              </motion.button>
                            </div>
                            <div className="mt-1 flex flex-wrap gap-1">{s.evidence.map((ev) => <BadgeKit key={ev} tone="slate">{ev}</BadgeKit>)}</div>
                          </div>
                          <BadgeKit tone={s.confidence > 80 ? "green" : s.confidence > 60 ? "amber" : "slate"}>{s.confidence}%</BadgeKit>
                        </div>
                        <div className="mt-2 h-1.5 rounded-full bg-[var(--surface-3)] overflow-hidden">
                          <motion.div
                            className="h-full rounded-full bg-[var(--brand)]"
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(100, Math.max(0, s.confidence))}%` }}
                            transition={{ duration: 0.6, ease: "easeOut", delay: i * 0.06 }}
                          />
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </AnimatePresence>
              </Card>
            </motion.div>
          )}

          {tab === "knowledge" && (
            <motion.div key="knowledge" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">
              <Card>
                <div className="flex gap-2">
                  <div className="flex-1"><Input label="Ask the protocol corpus" placeholder="e.g. sepsis screening criteria" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && runKnowledge()} leftIcon="search" /></div>
                  <Button onClick={runKnowledge} loading={knowledgeLoading} className="self-end" leftIcon="search">Search</Button>
                </div>
                <p className="mt-2 text-xs text-[var(--muted)]">RAG over sepsis qSOFA, HTN, anticoagulation, diabetes — scored hits with citations.</p>
              </Card>
              <AnimatePresence>
                <div className="grid gap-3">
                  {knowledgeLoading && [1, 2, 3].map((i) => <Card key={i} className="h-24 skeleton" />)}
                  {!knowledgeLoading && hits.length === 0 && <Card className="py-10 text-center text-sm text-[var(--muted)]">No results — try "hypertension lifestyle" or "warfarin INR".</Card>}
                  {hits.map((h, i) => (
                    <motion.div key={h.title + i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} exit={{ opacity: 0 }}>
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
              </AnimatePresence>
            </motion.div>
          )}

          {tab === "analytics" && (
            <motion.div key="analytics" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <span className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-600 text-white"><Icon name="activity" className="h-4 w-4" /></span>
                    <div>
                      <CardTitle>Conversational Analytics</CardTitle>
                      <p className="text-xs text-[var(--muted)]">Grounded in governed metrics</p>
                    </div>
                  </div>
                </CardHeader>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {["What is outstanding dues today?", "How many appointments today?", "Revenue today vs last week?", "OT utilization this week?"].map((s) => (
                    <motion.button
                      key={s}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setAsk(s)}
                      className="rounded-full border border-[var(--line)] bg-[var(--surface-2)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--surface-3)]"
                    >
                      {s}
                    </motion.button>
                  ))}
                </div>
                <Textarea label="Ask your hospital anything" value={ask} onChange={(e) => setAsk(e.target.value)} className="min-h-[80px]" />
                <Button onClick={runAsk} loading={askLoading} className="mt-3" leftIcon="activity">Ask</Button>
              </Card>

              <Card className="min-h-[260px]">
                {!askRes && !askLoading && (
                  <div className="py-10 text-center text-sm text-[var(--muted)]">Ask a question about revenue, patients, appointments, or operations.</div>
                )}
                {askLoading && (
                  <motion.div className="space-y-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ staggerChildren: 0.1 }}>
                    <div className="h-4 w-32 rounded skeleton" />
                    <div className="h-4 w-16 rounded skeleton" />
                    <div className="h-20 rounded-xl skeleton" />
                  </motion.div>
                )}
                {askRes && !askLoading && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                    <div className="flex items-center gap-2">
                      <BadgeKit tone={askRes.supported ? "green" : "amber"} dot>{askRes.supported ? "Supported" : "Unsupported intent"}</BadgeKit>
                      {askRes.question && <span className="text-xs text-[var(--muted)]">"{askRes.question}"</span>}
                      <div className="ml-auto flex gap-1">
                        <motion.button whileTap={{ scale: 0.88 }} onClick={() => saveFeedback("analytics", "positive")} aria-label="Helpful">
                          <Icon name="check" className={`h-4 w-4 ${feedback.analytics === "positive" ? "text-green-600" : "text-slate-400"}`} />
                        </motion.button>
                        <motion.button whileTap={{ scale: 0.88 }} onClick={() => saveFeedback("analytics", "negative")} aria-label="Not helpful">
                          <Icon name="alert" className={`h-4 w-4 ${feedback.analytics === "negative" ? "text-rose-600" : "text-slate-400"}`} />
                        </motion.button>
                      </div>
                    </div>
                    <div className="rounded-xl bg-[var(--surface-2)] border border-[var(--line-soft)] p-4 text-sm leading-relaxed whitespace-pre-wrap">
                      <StreamingText text={askRes.answer} speed={14} />
                    </div>
                    {askRes.data !== undefined && (
                      <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                        <pre className="overflow-auto rounded-xl bg-slate-900 p-4 text-xs text-emerald-300">{JSON.stringify(askRes.data, null, 2)}</pre>
                      </motion.div>
                    )}
                  </motion.div>
                )}
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppShell>
  );
}
