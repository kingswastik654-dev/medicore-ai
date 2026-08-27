import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(num: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat("en-IN", options).format(num);
}

export function formatCurrency(amount: number, currency = "INR"): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...options,
  });
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length).trim() + "…";
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  ms: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), ms);
  };
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export const MEDICAL_ROLES = [
  "SUPER_ADMIN",
  "FACILITY_ADMIN",
  "DOCTOR",
  "NURSE",
  "RECEPTIONIST",
  "CASHIER",
  "LAB_TECH",
  "RAD_TECH",
  "RADIOLOGIST",
  "PHARMACIST",
  "AUDITOR",
] as const;

export type MedicalRole = (typeof MEDICAL_ROLES)[number];

export const ROLE_LABELS: Record<MedicalRole, string> = {
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

export const ROLE_COLORS: Record<MedicalRole, string> = {
  SUPER_ADMIN: "purple",
  FACILITY_ADMIN: "indigo",
  DOCTOR: "blue",
  NURSE: "teal",
  RECEPTIONIST: "amber",
  CASHIER: "green",
  LAB_TECH: "orange",
  RAD_TECH: "cyan",
  RADIOLOGIST: "violet",
  PHARMACIST: "emerald",
  AUDITOR: "slate",
};

export const PRIORITY_LEVELS = ["ROUTINE", "URGENT", "STAT"] as const;
export const PRIORITY_COLORS: Record<(typeof PRIORITY_LEVELS)[number], string> = {
  ROUTINE: "slate",
  URGENT: "amber",
  STAT: "rose",
};