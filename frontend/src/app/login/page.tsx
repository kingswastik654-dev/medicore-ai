"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { currentUser, login } from "@/lib/api";

const DEMO = [
  ["admin", "Admin@123"],
  ["reception.rekha", "Reception@123"],
  ["dr.house", "Doctor@123"],
  ["cashier.amit", "Cashier@123"],
  ["auditor.meena", "Auditor@123"],
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
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="text-2xl font-bold">MediCore AI</div>
          <div className="text-sm text-slate-500">Hospital Management Platform</div>
        </div>

        <form onSubmit={submit} className="card space-y-3">
          <div>
            <label className="label">Username</label>
            <input
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="card mt-4">
          <div className="label">Demo accounts (seeded)</div>
          <div className="grid grid-cols-1 gap-1 mt-1">
            {DEMO.map(([u, p]) => (
              <button
                key={u}
                type="button"
                className="text-left text-xs text-blue-600 hover:underline"
                onClick={() => {
                  setUsername(u);
                  setPassword(p);
                }}
              >
                {u} / {p}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
