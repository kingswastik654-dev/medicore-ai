"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import Icon from "@/components/Icon";
import { ThemeToggle } from "@/components/theme";
import { Avatar } from "@/components/kit";
import { currentUser, logout, type SessionUser } from "@/lib/api";
import { getInitials } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: string; roles?: string[]; badge?: string };

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/patients", label: "Patients", icon: "users" },
  { href: "/appointments", label: "Appointments", icon: "calendar" },
  { href: "/consult", label: "Consult", icon: "stethoscope" },
  { href: "/ai", label: "AI Copilots", icon: "sparkles" },
  { href: "/radiology", label: "Radiology", icon: "scan" },
  { href: "/ot", label: "OT Schedule", icon: "ot" },
  { href: "/emergency", label: "Emergency", icon: "alert" },
  { href: "/operations", label: "Operations", icon: "bed" },
  { href: "/billing", label: "Billing", icon: "receipt" },
  { href: "/plugins", label: "Marketplace", icon: "sparkles", roles: ["SUPER_ADMIN", "FACILITY_ADMIN"] },
  { href: "/audit", label: "Audit Trail", icon: "shield", roles: ["SUPER_ADMIN", "FACILITY_ADMIN", "AUDITOR"] },
];

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  FACILITY_ADMIN: "Facility Admin",
  DOCTOR: "Doctor",
  NURSE: "Nurse",
  RECEPTIONIST: "Reception",
  CASHIER: "Cashier",
  LAB_TECH: "Lab Tech",
  RAD_TECH: "Rad Tech",
  RADIOLOGIST: "Radiologist",
  PHARMACIST: "Pharmacist",
  AUDITOR: "Auditor",
};

export default function AppShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);

  useEffect(() => {
    const u = currentUser();
    if (!u) {
      router.replace("/login");
      return;
    }
    setUser(u);
    setReady(true);
    const c = localStorage.getItem("medcore_sidebar_collapsed");
    if (c) setCollapsed(c === "1");
  }, [router]);

  useEffect(() => {
    localStorage.setItem("medcore_sidebar_collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  // Close the user menu on Escape or any click outside of it
  useEffect(() => {
    if (!userMenu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setUserMenu(false);
    };
    window.addEventListener("keydown", onKey);
    const onClick = () => setUserMenu(false);
    const t = window.setTimeout(() => window.addEventListener("click", onClick), 0);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
      window.removeEventListener("click", onClick);
    };
  }, [userMenu]);

  const items = useMemo(() => {
    if (!user) return [];
    return NAV.filter((n) => !n.roles || n.roles.includes(user.role));
  }, [user]);

  if (!ready || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center gap-4">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg">
            <Icon name="heart" className="h-6 w-6" />
          </span>
          <div className="flex items-center gap-2 text-sm font-medium text-[var(--muted)]">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
            Loading your workspace…
          </div>
        </motion.div>
      </div>
    );
  }

  const sidebarWidth = collapsed ? 72 : 264;

  return (
    <div className="flex min-h-screen bg-[var(--bg)]" style={{ ["--sidebar" as never]: `${sidebarWidth}px` } as React.CSSProperties}>
      {/* Desktop sidebar */}
      <motion.aside
        animate={{ width: sidebarWidth }}
        transition={{ type: "spring", damping: 28, stiffness: 260 }}
        className="fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-white/10 bg-slate-950 lg:flex"
      >
        <div className="flex h-[64px] items-center gap-3 px-4">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-900/40">
              <Icon name="heart" className="h-5 w-5" />
            </span>
            {!collapsed && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-w-0">
                <span className="block text-[13px] font-extrabold tracking-tight text-white leading-none">MediCore AI</span>
                <span className="block text-[11px] font-medium text-slate-400">Hospital OS</span>
              </motion.span>
            )}
          </Link>
          <button
            onClick={(e) => { e.stopPropagation(); setCollapsed((v) => !v); }}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="ml-auto grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
          >
            <Icon name="arrow" className={`h-4 w-4 transition-transform duration-300 ${collapsed ? "rotate-0" : "rotate-180"}`} />
          </button>
        </div>

        <div className="px-3 py-2">
          {!collapsed && (
            <div className="mb-2 px-2 text-[11px] font-bold uppercase tracking-widest text-slate-500">Clinical</div>
          )}
          <nav className="space-y-1">
            {items.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={collapsed ? "grid h-10 w-10 place-items-center mx-auto rounded-xl " + (active ? "bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md" : "text-slate-400 hover:bg-white/10 hover:text-white") : `nav-link ${active ? "nav-active" : ""}`}
                >
                  <Icon name={item.icon} className="h-[18px] w-[18px] shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                  {!collapsed && item.badge && <span className="ml-auto rounded-full bg-white/20 px-1.5 py-0.5 text-[11px] font-bold">{item.badge}</span>}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="mt-auto border-t border-white/10 p-3">
          <div className="relative">
            <button onClick={(e) => { e.stopPropagation(); setUserMenu((v) => !v); }} className="flex w-full items-center gap-3 rounded-xl p-2 hover:bg-white/10 transition-colors text-left">
              <Avatar name={user.full_name} size={36} />
              {!collapsed && (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-bold leading-none text-white">{user.full_name}</span>
                    <span className="block truncate text-[11px] font-medium text-slate-400">{ROLE_LABELS[user.role] ?? user.role}</span>
                  </span>
                  <Icon name="plus" className="h-4 w-4 text-slate-500 rotate-45" />
                </>
              )}
            </button>
            <AnimatePresence>
              {userMenu && !collapsed && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.98 }}
                  className="absolute bottom-full left-0 right-0 mb-2 rounded-2xl border border-slate-800 bg-slate-900 p-2 shadow-xl"
                >
                  <div className="px-3 py-2">
                    <div className="text-sm font-bold text-white">{user.full_name}</div>
                    <div className="text-xs text-slate-400">@{user.username} · {ROLE_LABELS[user.role]}</div>
                  </div>
                  <div className="mt-1 space-y-1">
                    <button onClick={() => setUserMenu(false)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-white/10 hover:text-white">
                      <Icon name="users" className="h-4 w-4" /> Profile
                    </button>
                    <button onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-rose-300 hover:bg-rose-500/20">
                      <Icon name="logout" className="h-4 w-4" /> Sign out
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {!collapsed && (
            <div className="mt-3 flex items-center justify-between rounded-xl bg-white/5 px-3 py-2">
              <span className="text-xs font-semibold text-slate-300">Theme</span>
              <ThemeToggle />
            </div>
          )}
          {collapsed && (
            <div className="mt-3 flex justify-center">
              <ThemeToggle />
            </div>
          )}
        </div>
      </motion.aside>

      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/80 px-4 backdrop-blur lg:hidden dark:bg-slate-950/80 dark:border-white/10">
        <button onClick={() => setMobileOpen(true)} className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200">
          <Icon name="plus" className="h-5 w-5" />
        </button>
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white">
            <Icon name="heart" className="h-4 w-4" />
          </span>
          <span className="text-sm font-extrabold tracking-tight text-slate-900 dark:text-white">MediCore AI</span>
        </Link>
        <span className="ml-auto flex items-center gap-2">
          <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-600 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Live
          </span>
          <Avatar name={user.full_name} size={32} />
        </span>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 lg:hidden">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
            <motion.div initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} transition={{ type: "spring", damping: 28, stiffness: 280 }} className="absolute inset-y-0 left-0 w-[300px] bg-slate-950 p-4 flex flex-col">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white">
                  <Icon name="heart" className="h-5 w-5" />
                </span>
                <span className="text-sm font-extrabold text-white">MediCore AI</span>
                <button onClick={() => setMobileOpen(false)} className="ml-auto grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white">
                  <Icon name="plus" className="h-4 w-4 rotate-45" />
                </button>
              </div>
              <nav className="mt-6 space-y-1 flex-1 overflow-auto">
                {items.map((item) => (
                  <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium ${pathname === item.href ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white" : "text-slate-400 hover:bg-white/10 hover:text-white"}`}>
                    <Icon name={item.icon} className="h-5 w-5" /> {item.label}
                  </Link>
                ))}
              </nav>
              <div className="border-t border-white/10 pt-4 flex items-center gap-3">
                <Avatar name={user.full_name} size={36} />
                <span>
                  <span className="block text-sm font-bold text-white">{user.full_name}</span>
                  <span className="block text-xs text-slate-400">{ROLE_LABELS[user.role] ?? user.role}</span>
                </span>
                <button onClick={logout} className="ml-auto grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white">
                  <Icon name="logout" className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main */}
      <main className="min-h-screen flex-1 lg:ml-[var(--sidebar)]">
        <div className="lg:pl-0">
          <div className="mx-auto max-w-[1400px] p-4 pt-16 lg:p-8 lg:pt-8">
            <motion.header initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: "easeOut" }} className="mb-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="text-[22px] font-extrabold tracking-tight text-[var(--text)]">{title}</h1>
                  {subtitle && <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">{subtitle}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-500/15 dark:text-emerald-300">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /> All systems live
                  </span>
                </div>
              </div>
            </motion.header>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.06, ease: "easeOut" }}>
              {children}
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  );
}

