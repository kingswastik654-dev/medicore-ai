"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { currentUser, logout, type SessionUser } from "@/lib/api";

const NAV = [
  { href: "/dashboard", label: "Dashboard", roles: null },
  { href: "/patients", label: "Patients", roles: null },
  { href: "/appointments", label: "Appointments", roles: null },
  { href: "/consult", label: "Consult", roles: null },
  { href: "/billing", label: "Billing", roles: null },
  { href: "/audit", label: "Audit Trail", roles: ["SUPER_ADMIN", "FACILITY_ADMIN", "AUDITOR"] },
];

export default function AppShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const u = currentUser();
    if (!u) {
      router.replace("/login");
      return;
    }
    setUser(u);
    setReady(true);
  }, [router]);

  if (!ready || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400 text-sm">
        Loading…
      </div>
    );
  }

  const items = NAV.filter((n) => !n.roles || n.roles.includes(user.role));

  return (
    <div className="min-h-screen flex">
      <aside className="w-56 shrink-0 bg-slate-900 text-slate-300 flex flex-col">
        <div className="px-4 py-5 border-b border-slate-800">
          <div className="text-white font-semibold">MediCore AI</div>
          <div className="text-xs text-slate-500 mt-0.5">Hospital Platform</div>
        </div>
        <nav className="flex-1 py-3">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`block px-4 py-2 text-sm ${
                pathname === item.href
                  ? "bg-slate-800 text-white"
                  : "hover:bg-slate-800/60 hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-800">
          <div className="text-sm text-white">{user.full_name}</div>
          <div className="text-xs text-slate-500 mb-2">{user.role.replaceAll("_", " ")}</div>
          <button onClick={logout} className="btn-ghost w-full">
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 p-6 overflow-x-auto">
        <h1 className="text-xl font-semibold mb-4">{title}</h1>
        {children}
      </main>
    </div>
  );
}
