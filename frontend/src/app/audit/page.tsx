"use client";

import { useCallback, useEffect, useState } from "react";

import AppShell from "@/components/AppShell";
import { api, currentUser } from "@/lib/api";

type AuditEntry = {
  id: number;
  actor_username: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  patient_id: number | null;
  ip: string | null;
  detail: string | null;
  created_at: string | null;
};

const ALLOWED = ["SUPER_ADMIN", "FACILITY_ADMIN", "AUDITOR"];

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const allowed = ALLOWED.includes(currentUser()?.role ?? "");

  const load = useCallback(async (p: number) => {
    try {
      const data = await api<{ items: AuditEntry[]; total: number }>(
        `/api/audits?page=${p}&page_size=50`
      );
      setEntries(data.items);
      setTotal(data.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load audit trail");
    }
  }, []);

  useEffect(() => {
    if (allowed) load(page);
  }, [allowed, load, page]);

  if (!allowed) {
    return (
      <AppShell title="Audit Trail">
        <div className="card text-sm text-slate-500">
          Your role does not have access to the audit trail.
        </div>
      </AppShell>
    );
  }

  const pages = Math.max(1, Math.ceil(total / 50));

  return (
    <AppShell title="Audit Trail">
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 mb-4">
          {error}
        </div>
      )}
      <div className="card overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead>
            <tr>
              <th className="th">Time (UTC)</th>
              <th className="th">Actor</th>
              <th className="th">Action</th>
              <th className="th">Resource</th>
              <th className="th">Ref</th>
              <th className="th">Patient</th>
              <th className="th">IP</th>
              <th className="th">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {entries.map((e) => (
              <tr key={e.id} className="hover:bg-slate-50">
                <td className="td whitespace-nowrap font-mono text-xs">
                  {e.created_at?.replace("T", " ").slice(0, 19)}
                </td>
                <td className="td">{e.actor_username ?? "—"}</td>
                <td className="td">
                  <span
                    className={`chip ${
                      e.action === "LOGIN_FAILED"
                        ? "bg-red-100 text-red-700"
                        : e.action === "PAYMENT" || e.action === "MERGE"
                          ? "bg-purple-100 text-purple-700"
                          : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {e.action}
                  </span>
                </td>
                <td className="td text-xs">{e.resource_type}</td>
                <td className="td font-mono text-xs">{e.resource_id ?? "—"}</td>
                <td className="td">{e.patient_id ?? "—"}</td>
                <td className="td font-mono text-xs">{e.ip ?? "—"}</td>
                <td className="td text-xs text-slate-500 max-w-xs truncate">{e.detail ?? ""}</td>
              </tr>
            ))}
            {!entries.length && (
              <tr>
                <td className="td text-slate-400" colSpan={8}>
                  No entries.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="flex items-center justify-between pt-3 text-xs text-slate-500">
          <span>
            Page {page} of {pages} · {total} entries
          </span>
          <div className="space-x-2">
            <button className="btn-secondary !py-1" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Prev
            </button>
            <button
              className="btn-secondary !py-1"
              disabled={page >= pages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
