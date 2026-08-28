"use client";

import { useEffect, useState } from "react";

import AppShell from "@/components/AppShell";
import Icon from "@/components/Icon";
import { Alert, Badge } from "@/components/ui";
import { api, currentUser } from "@/lib/api";

type Plugin = {
  id: number;
  slug: string;
  name: string;
  category: string;
  description?: string | null;
  version: string;
  vendor?: string | null;
  enabled: boolean;
};

const CATEGORY_TONE: Record<string, "blue" | "purple" | "amber" | "green" | "slate"> = {
  CHANNEL: "green",
  DIAGNOSTIC_AI: "purple",
  BILLING: "amber",
  ANALYTICS: "blue",
  DEVICE: "slate",
};

export default function PluginsPage() {
  const user = currentUser();
  const isAdmin = user?.role === "SUPER_ADMIN" || user?.role === "FACILITY_ADMIN";

  const [plugins, setPlugins] = useState<Plugin[] | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    api<Plugin[]>("/api/plugins")
      .then(setPlugins)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load plugins"));
  }, []);

  async function toggle(p: Plugin) {
    setBusyId(p.id);
    setError(null);
    try {
      const updated = await api<Plugin>(`/api/plugins/${p.id}/toggle`, { method: "POST" });
      setPlugins((list) => (list ?? []).map((x) => (x.id === p.id ? updated : x)));
      setMessage(`${updated.name} ${updated.enabled ? "enabled" : "disabled"}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Toggle failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AppShell title="Marketplace" subtitle="Extend MediCore with channels, diagnostics AI, billing gateways and devices">
      {!isAdmin && (
        <div className="mb-4"><Alert kind="info">Browsing is read-only — enabling plugins requires an admin role.</Alert></div>
      )}
      {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}
      {message && <div className="mb-4"><Alert kind="success">{message}</Alert></div>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(plugins ?? []).map((p) => (
          <div key={p.id} className={`card flex flex-col transition-all duration-200 ${p.enabled ? "!border-blue-300 !bg-gradient-to-br !from-white !to-blue-50/60 shadow-md" : ""}`}>
            <div className="flex items-start justify-between gap-3">
              <span className={`grid h-11 w-11 place-items-center rounded-xl ${p.enabled ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-500/25" : "bg-slate-100 text-slate-400"}`}>
                <Icon name={p.category === "CHANNEL" ? "activity" : p.category === "DIAGNOSTIC_AI" ? "sparkles" : p.category === "BILLING" ? "receipt" : p.category === "DEVICE" ? "flask" : "dashboard"} className="h-5 w-5" />
              </span>
              <button
                aria-label={p.enabled ? "Disable plugin" : "Enable plugin"}
                disabled={!isAdmin || busyId === p.id}
                onClick={() => toggle(p)}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 disabled:opacity-40 ${
                  p.enabled ? "bg-blue-600" : "bg-slate-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all duration-200 ${
                    p.enabled ? "left-[22px]" : "left-0.5"
                  }`}
                />
              </button>
            </div>

            <div className="mt-3 font-semibold">{p.name}</div>
            <div className="mt-1.5 flex-1 text-[13px] leading-relaxed text-slate-500">{p.description}</div>

            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
              <Badge tone={CATEGORY_TONE[p.category] ?? "slate"}>{p.category.replaceAll("_", " ")}</Badge>
              <span className="text-[11px] text-slate-400">
                v{p.version}{p.vendor ? ` · ${p.vendor}` : ""}
              </span>
            </div>
          </div>
        ))}
        {!plugins && [...Array(5)].map((_, i) => (
          <div key={i} className="card h-44 animate-pulse !bg-slate-50" />
        ))}
      </div>
    </AppShell>
  );
}

