"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import Icon from "@/components/Icon";

// ─────────────────────────────────────────────────────────────────────────────
// Button
// ─────────────────────────────────────────────────────────────────────────────
type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline" | "soft";
type ButtonSize = "sm" | "md" | "lg" | "icon";

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--brand)] text-white shadow-sm hover:bg-[var(--brand-hover)] hover:shadow-md hover:-translate-y-[1px] active:translate-y-0 active:scale-[0.98]",
  secondary:
    "bg-[var(--surface)] text-[var(--text)] border border-[var(--line)] hover:bg-[var(--surface-hover)] hover:border-[var(--line-strong)] hover:-translate-y-[1px] active:translate-y-0",
  ghost: "bg-transparent text-[var(--muted)] hover:text-white hover:bg-slate-800 dark:hover:bg-white/[0.08]",
  danger: "bg-[var(--danger)] text-white hover:brightness-110 shadow-sm",
  outline: "bg-transparent border border-[var(--line)] text-[var(--text)] hover:bg-[var(--surface-hover)]",
  soft: "bg-[var(--brand-soft)] text-[var(--brand)] hover:bg-blue-100 dark:hover:bg-white/10 border border-transparent",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs rounded-lg",
  md: "h-9 px-4 text-[13px] rounded-xl",
  lg: "h-11 px-6 text-sm rounded-xl",
  icon: "h-9 w-9 p-0 rounded-xl",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: string;
  rightIcon?: string;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, leftIcon, rightIcon, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center gap-2 font-semibold leading-none transition-all duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2",
          "disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:translate-y-0",
          buttonVariants[variant],
          buttonSizes[size],
          className
        )}
        {...props}
      >
        {loading ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
        ) : leftIcon ? (
          <Icon name={leftIcon} className="h-4 w-4 shrink-0" />
        ) : null}
        {children}
        {!loading && rightIcon ? <Icon name={rightIcon} className="h-4 w-4 shrink-0" /> : null}
      </button>
    );
  }
);
Button.displayName = "Button";

// ─────────────────────────────────────────────────────────────────────────────
// Card
// ─────────────────────────────────────────────────────────────────────────────
export function Card({
  className,
  hover,
  interactive,
  padding = true,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { hover?: boolean; interactive?: boolean; padding?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-[16px] border bg-[var(--surface)] shadow-[var(--shadow-card)]",
        "border-[var(--line)]",
        hover && "hover:-translate-y-1 hover:shadow-[var(--shadow-pop)] hover:border-[var(--line-strong)] transition-all duration-200",
        interactive && "cursor-pointer active:translate-y-0 active:scale-[0.99]",
        padding && "p-5",
        className
      )}
      {...props}
    >
      {props.children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode }) {
  return <div className={cn("mb-3 flex items-center justify-between gap-3", className)} {...props}>{children}</div>;
}
export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-[13px] font-bold tracking-tight text-[var(--text)]", className)} {...props} />;
}
export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-xs leading-relaxed text-[var(--muted)]", className)} {...props} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Badge (enhanced)
// ─────────────────────────────────────────────────────────────────────────────
type BadgeTone = "blue" | "green" | "amber" | "rose" | "slate" | "purple" | "teal" | "orange";
const badgeTones: Record<BadgeTone, string> = {
  blue: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30",
  green: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30",
  amber: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30",
  rose: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30",
  slate: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-white/10 dark:text-slate-300 dark:border-white/15",
  purple: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/15 dark:text-purple-300 dark:border-purple-500/30",
  teal: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-500/15 dark:text-teal-300 dark:border-teal-500/30",
  orange: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/30",
};
export function BadgeKit({ tone = "slate", dot, className, children, ...props }: { tone?: BadgeTone; dot?: boolean; children: React.ReactNode } & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold leading-none", badgeTones[tone], className)} {...props}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />}
      {children}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Input (enhanced)
// ─────────────────────────────────────────────────────────────────────────────
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  leftIcon?: string;
  rightIcon?: string;
}
export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, label, hint, error, leftIcon, rightIcon, id, ...props }, ref) => {
  const inputId = id || `input-${React.useId()}`;
  return (
    <div className="space-y-1.5">
      {label && <label htmlFor={inputId} className="block text-[11px] font-bold uppercase tracking-widest text-[var(--muted)]">{label}</label>}
      <div className="relative">
        {leftIcon && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-2)]"><Icon name={leftIcon} className="h-4 w-4" /></span>}
        <input
          id={inputId}
          ref={ref}
          className={cn(
            "flex h-10 w-full rounded-xl border bg-[var(--surface)] px-3.5 py-2 text-sm font-medium text-[var(--text)]",
            "border-[var(--line)] placeholder:text-[var(--muted-2)] transition-all duration-200",
            "hover:border-[var(--line-strong)] focus:border-[var(--brand)] focus:outline-none focus:ring-4 focus:ring-[var(--brand-ring)]",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            leftIcon && "pl-9",
            rightIcon && "pr-9",
            error && "border-[var(--danger)] focus:border-[var(--danger)] focus:ring-[rgba(220,38,38,0.12)]",
            className
          )}
          {...props}
        />
        {rightIcon && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-2)]"><Icon name={rightIcon} className="h-4 w-4" /></span>}
      </div>
      {error ? <p className="text-xs font-medium text-[var(--danger)] flex items-center gap-1"><Icon name="alert" className="h-3 w-3" />{error}</p> : hint ? <p className="text-xs text-[var(--muted)]">{hint}</p> : null}
    </div>
  );
});
Input.displayName = "Input";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}
export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, label, hint, error, id, ...props }, ref) => {
  const inputId = id || `textarea-${React.useId()}`;
  return (
    <div className="space-y-1.5">
      {label && <label htmlFor={inputId} className="block text-[11px] font-bold uppercase tracking-widest text-[var(--muted)]">{label}</label>}
      <textarea
        id={inputId}
        ref={ref}
        className={cn(
          "flex min-h-[80px] w-full rounded-xl border bg-[var(--surface)] px-3.5 py-2.5 text-sm text-[var(--text)]",
          "border-[var(--line)] placeholder:text-[var(--muted-2)] transition-all duration-200",
          "hover:border-[var(--line-strong)] focus:border-[var(--brand)] focus:outline-none focus:ring-4 focus:ring-[var(--brand-ring)]",
          error && "border-[var(--danger)] focus:border-[var(--danger)]",
          className
        )}
        {...props}
      />
      {error ? <p className="text-xs font-medium text-[var(--danger)]">{error}</p> : hint ? <p className="text-xs text-[var(--muted)]">{hint}</p> : null}
    </div>
  );
});
Textarea.displayName = "Textarea";

// ─────────────────────────────────────────────────────────────────────────────
// Select
// ─────────────────────────────────────────────────────────────────────────────
export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
}
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(({ className, label, hint, error, children, id, ...props }, ref) => {
  const inputId = id || `select-${React.useId()}`;
  return (
    <div className="space-y-1.5">
      {label && <label htmlFor={inputId} className="block text-[11px] font-bold uppercase tracking-widest text-[var(--muted)]">{label}</label>}
      <select
        id={inputId}
        ref={ref}
        className={cn(
          "flex h-10 w-full rounded-xl border bg-[var(--surface)] px-3.5 py-2 text-sm font-medium text-[var(--text)]",
          "border-[var(--line)] transition-all duration-200",
          "hover:border-[var(--line-strong)] focus:border-[var(--brand)] focus:outline-none focus:ring-4 focus:ring-[var(--brand-ring)]",
          className
        )}
        {...props}
      >
        {children}
      </select>
      {error ? <p className="text-xs font-medium text-[var(--danger)]">{error}</p> : hint ? <p className="text-xs text-[var(--muted)]">{hint}</p> : null}
    </div>
  );
});
Select.displayName = "Select";

// ─────────────────────────────────────────────────────────────────────────────
// Switch / Toggle
// ─────────────────────────────────────────────────────────────────────────────
export function Switch({ checked, onCheckedChange, label, description, disabled }: { checked: boolean; onCheckedChange: (v: boolean) => void; label?: string; description?: string; disabled?: boolean }) {
  return (
    <label className={cn("flex items-center justify-between gap-3", disabled && "opacity-50 cursor-not-allowed")}>
      {(label || description) && (
        <span className="space-y-0.5">
          {label && <span className="block text-sm font-semibold text-[var(--text)]">{label}</span>}
          {description && <span className="block text-xs text-[var(--muted)]">{description}</span>}
        </span>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2",
          checked ? "bg-[var(--brand)]" : "bg-slate-200 dark:bg-white/15"
        )}
      >
        <span className={cn("pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200", checked ? "translate-x-5" : "translate-x-0")} />
      </button>
    </label>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────────────────────────────────────
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("skeleton h-4 w-full rounded-lg", className)} {...props} />;
}
export function SkeletonCard() {
  return (
    <Card className="space-y-3">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-4/5" />
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Spinner
// ─────────────────────────────────────────────────────────────────────────────
export function Spinner({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <span
      style={{ width: size, height: size }}
      className={cn("inline-block animate-spin rounded-full border-2 border-[var(--line-strong)] border-t-[var(--brand)]", className)}
      aria-hidden
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty State
// ─────────────────────────────────────────────────────────────────────────────
export function EmptyState({ icon = "search", title, description, action }: { icon?: string; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        <Icon name={icon} className="h-6 w-6" />
      </div>
      <div className="space-y-1 text-center">
        <h3 className="text-sm font-bold text-[var(--text)]">{title}</h3>
        {description && <p className="max-w-sm text-sm text-[var(--muted)]">{description}</p>}
      </div>
      {action}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tabs
// ─────────────────────────────────────────────────────────────────────────────
export function Tabs({ tabs, active, onChange }: { tabs: { id: string; label: string; icon?: string; count?: number }[]; active: string; onChange: (id: string) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-xl bg-[var(--surface-2)] p-1 border border-[var(--line-soft)]">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            "relative flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-all duration-200",
            active === t.id ? "bg-[var(--surface)] text-[var(--text)] shadow-sm border border-[var(--line)]" : "text-[var(--muted)] hover:text-[var(--text)] hover:bg-white/60 dark:hover:bg-white/5"
          )}
        >
          {t.icon && <Icon name={t.icon} className="h-4 w-4" />}
          {t.label}
          {t.count !== undefined && (
            <span className={cn("ml-1 rounded-full px-1.5 py-0.5 text-[11px] font-bold", active === t.id ? "bg-[var(--brand-soft)] text-[var(--brand)]" : "bg-white dark:bg-white/10 text-[var(--muted)]")}>{t.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal / Dialog
// ─────────────────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, description, children, size = "lg" }: { open: boolean; onClose: () => void; title?: string; description?: string; children: React.ReactNode; size?: "sm" | "md" | "lg" | "xl" }) {
  const sizes: Record<string, string> = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" };
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[1200] flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: "spring", damping: 24, stiffness: 320 }}
            className={cn("relative w-full rounded-[20px] bg-[var(--surface)] shadow-[var(--shadow-pop)] border border-[var(--line)] max-h-[90vh] overflow-hidden flex flex-col", sizes[size])}
          >
            {(title || description) && (
              <div className="border-b border-[var(--line-soft)] px-6 py-4 flex items-start justify-between gap-4">
                <div>
                  {title && <h2 className="text-[15px] font-bold tracking-tight text-[var(--text)]">{title}</h2>}
                  {description && <p className="mt-1 text-sm text-[var(--muted)]">{description}</p>}
                </div>
                <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full hover:bg-[var(--surface-2)] text-[var(--muted)] transition-colors">
                  <Icon name="plus" className="h-4 w-4 rotate-45" />
                </button>
              </div>
            )}
            <div className="overflow-auto p-6">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Toast
// ─────────────────────────────────────────────────────────────────────────────
type ToastItem = { id: string; kind: "success" | "error" | "info" | "warning"; title: string; description?: string };
const ToastCtx = React.createContext<{ push: (t: Omit<ToastItem, "id">) => void } | null>(null);
export function useToast() {
  const ctx = React.useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be inside ToastProvider");
  return ctx;
}
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);
  const push = React.useCallback((t: Omit<ToastItem, "id">) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((p) => [...p, { ...t, id }]);
    setTimeout(() => setToasts((p) => p.filter((x) => x.id !== id)), 3800);
  }, []);
  const icons: Record<string, string> = { success: "check", error: "alert", info: "activity", warning: "alert" };
  const tones: Record<string, string> = {
    success: "border-emerald-200 bg-white text-emerald-900 dark:bg-slate-900 dark:border-emerald-900/50 dark:text-emerald-100",
    error: "border-rose-200 bg-white text-rose-900 dark:bg-slate-900 dark:border-rose-900/50 dark:text-rose-100",
    warning: "border-amber-200 bg-white text-amber-900 dark:bg-slate-900 dark:border-amber-900/50 dark:text-amber-100",
    info: "border-blue-200 bg-white text-slate-900 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100",
  };
  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[1500] flex flex-col gap-2">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.98 }}
              className={cn("pointer-events-auto flex min-w-[320px] max-w-[420px] items-start gap-3 rounded-2xl border px-4 py-3 shadow-[var(--shadow-pop)]", tones[t.kind])}
            >
              <span className={cn("grid h-8 w-8 place-items-center rounded-full text-white shrink-0", t.kind === "success" ? "bg-emerald-500" : t.kind === "error" ? "bg-rose-500" : t.kind === "warning" ? "bg-amber-500" : "bg-blue-600")}>
                <Icon name={icons[t.kind]} className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold leading-tight">{t.title}</span>
                {t.description && <span className="block text-xs leading-relaxed opacity-75">{t.description}</span>}
              </span>
              <button onClick={() => setToasts((p) => p.filter((x) => x.id !== t.id))} className="grid h-6 w-6 place-items-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 shrink-0">
                <Icon name="plus" className="h-3.5 w-3.5 rotate-45" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tooltip (simple hover)
// ─────────────────────────────────────────────────────────────────────────────
export function Tooltip({ content, children }: { content: string; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  return (
    <span className="relative inline-flex" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}>
      {children}
      <AnimatePresence>
        {open && (
          <motion.span
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="pointer-events-none absolute bottom-full left-1/2 z-[1400] mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white shadow-lg"
          >
            {content}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Progress
// ─────────────────────────────────────────────────────────────────────────────
export function Progress({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-[var(--surface-2)] border border-[var(--line-soft)]", className)}>
      <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, Math.max(0, value))}%` }} transition={{ duration: 0.6, ease: "easeOut" }} className="h-full rounded-full bg-[var(--brand)]" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Avatar
// ─────────────────────────────────────────────────────────────────────────────
export function Avatar({ name, size = 36, src }: { name: string; size?: number; src?: string }) {
  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <span
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
      className="inline-grid place-items-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 font-bold text-white shadow-sm ring-2 ring-white dark:ring-slate-900 overflow-hidden shrink-0"
    >
      {src ? <img src={src} alt={name} className="h-full w-full object-cover" /> : initials}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PageHeader
// ─────────────────────────────────────────────────────────────────────────────
export function PageHeader({ title, subtitle, actions, breadcrumbs }: { title: string; subtitle?: string; actions?: React.ReactNode; breadcrumbs?: { label: string; href?: string }[] }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        {breadcrumbs && (
          <nav className="mb-2 flex items-center gap-1.5 text-xs text-[var(--muted)]">
            {breadcrumbs.map((b, i) => (
              <React.Fragment key={b.label}>
                {i > 0 && <span className="text-[var(--muted-2)]">/</span>}
                <span className={i === breadcrumbs.length - 1 ? "font-semibold text-[var(--text)]" : ""}>{b.label}</span>
              </React.Fragment>
            ))}
          </nav>
        )}
        <h1 className="text-[22px] font-extrabold tracking-tight text-[var(--text)]">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
