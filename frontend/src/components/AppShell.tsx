"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import Icon from "@/components/Icon";
import { currentUser, logout, type SessionUser } from "@/lib/api";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/patients", label: "Patients", icon: "users" },
  { href: "/appointments", label: "Appointments", icon: "calendar" },
  { href: "/consult", label: "Consult", icon: "stethoscope" },
  { href: "/operations", label: "Operations", icon: "bed" },
  { href: "/billing", label: "Billing", icon: "receipt" },
  {
    href: "/plugins",
    label: "Marketplace",
    icon: "sparkles",
    roles: ["SUPER_ADMIN", "FACILITY_ADMIN"],
  },
  {
    href: "/audit",
    label: "Audit Trail",
    icon: "shield",
    roles: ["SUPER_ADMIN", "FACILITY_ADMIN", "AUDITOR"],
  },
];

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  FACILITY_ADMIN: "Facility Admin",
  DOCTOR: "Doctor",
  NURSE: "Nurse",
  RECEPTIONIST: "Reception",
  CASHIER: "Cashier",
  LAB_TECH: "Lab Tech",
  PHARMACIST: "Pharmacist",
  AUDITOR: "Auditor",
};

export default function AppShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
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
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
          Loading console…
        </div>
      </div>
    );
  }

  const items = NAV.filter((n) => !n.roles || n.roles.includes(user.role));

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-20 flex w-60 flex-col bg-slate-950 max-lg:w-14">
        <Link href="/" className="flex items-center gap-2.5 px-4 py-5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-lg shadow-blue-900/50">
            <Icon name="heart" className="h-5 w-5" />
          </span>
          <span className="min-w-0 max-lg:hidden">
            <span className="block truncate text-sm font-bold tracking-tight text-white">MediCore AI</span>
            <span className="block text-[11px] text-slate-500">Hospital Platform</span>
          </span>
        </Link>

        <nav className="mt-2 flex-1 space-y-1 px-2.5">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={`nav-link ${pathname === item.href ? "nav-active" : ""}`}
            >
              <Icon name={item.icon} className="h-[18px] w-[18px] shrink-0" />
              <span className="max-lg:hidden">{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="border-t border-white/5 p-3">
          <div className="mb-1 flex items-center gap-2.5 px-1 max-lg:justify-center">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-800 text-xs font-bold text-blue-400 ring-2 ring-slate-800">
              {user.full_name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
            </span>
            <div className="min-w-0 max-lg:hidden">
              <div className="truncate text-[13px] font-semibold text-white">{user.full_name}</div>
              <div className="truncate text-[11px] text-slate-500">{ROLE_LABELS[user.role] ?? user.role}</div>
            </div>
          </div>
          <button onClick={logout} className="btn-ghost w-full justify-start px-2.5 max-lg:justify-center" title="Sign out">
            <Icon name="logout" className="h-[18px] w-[18px]" />
            <span className="max-lg:hidden">Sign out</span>
          </button>
        </div>
      </aside>

      <main className="ml-60 min-h-screen flex-1 p-6 lg:p-8 max-lg:ml-14">
        <header className="mb-6 animate-fadeUp">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
        </header>
        <div className="animate-fadeUp">{children}</div>
      </main>
    </div>
  );
}
