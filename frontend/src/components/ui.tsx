import Icon from "@/components/Icon";

type Tone = "blue" | "green" | "amber" | "rose" | "slate" | "purple";

const TONES: Record<Tone, string> = {
  blue: "bg-blue-50 text-blue-700 border-blue-200",
  green: "bg-emerald-50 text-emerald-700 border-emerald-200",
  amber: "bg-amber-50 text-amber-800 border-amber-200",
  rose: "bg-rose-50 text-rose-700 border-rose-200",
  slate: "bg-slate-100 text-slate-600 border-slate-200",
  purple: "bg-purple-50 text-purple-700 border-purple-200",
};

export function Badge({
  tone = "slate",
  children,
}: {
  tone?: Tone;
  children: React.ReactNode;
}) {
  return <span className={`chip border ${TONES[tone]}`}>{children}</span>;
}

export function Alert({
  kind = "info",
  children,
}: {
  kind?: "info" | "success" | "error" | "warn";
  children: React.ReactNode;
}) {
  const map = {
    info: { cls: "border-blue-200 bg-blue-50 text-blue-800", icon: "activity" },
    success: { cls: "border-emerald-200 bg-emerald-50 text-emerald-800", icon: "check" },
    error: { cls: "border-rose-200 bg-rose-50 text-rose-700", icon: "alert" },
    warn: { cls: "border-amber-300 bg-amber-50 text-amber-800", icon: "alert" },
  } as const;
  const s = map[kind];
  return (
    <div className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm ${s.cls}`} role="status">
      <Icon name={s.icon} className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function StatCard({
  label,
  value,
  sub,
  icon,
  tone = "blue",
}: {
  label: string;
  value: string;
  sub?: string;
  icon: string;
  tone?: Tone;
}) {
  return (
    <div className="card flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</div>
        <div className="mt-1 truncate text-2xl font-bold tracking-tight text-slate-900">{value}</div>
        {sub && <div className="mt-0.5 text-xs text-slate-400">{sub}</div>}
      </div>
      <div className={`rounded-xl border p-2.5 ${TONES[tone]}`}>
        <Icon name={icon} className="h-5 w-5" />
      </div>
    </div>
  );
}

export function EmptyRow({ colSpan, text = "Nothing here yet." }: { colSpan: number; text?: string }) {
  return (
    <tr>
      <td className="td py-8 text-center text-sm text-slate-400" colSpan={colSpan}>
        {text}
      </td>
    </tr>
  );
}

const STATUS_TONES: Record<string, Tone> = {
  PAID: "green",
  COMPLETED: "green",
  VERIFIED: "green",
  ACTIVE: "green",
  OPEN: "blue",
  BOOKED: "slate",
  ISSUED: "blue",
  IN_PROGRESS: "blue",
  SCHEDULED: "blue",
  ACQUIRED: "amber",
  PRELIMINARY: "purple",
  FINAL: "green",
  DISPENSED: "purple",
  RESULTED: "purple",
  PARTIALLY_PAID: "amber",
  DRAFT: "amber",
  SAMPLE_COLLECTED: "amber",
  CANCELLED: "rose",
  NO_SHOW: "rose",
  MERGED: "rose",
  CLOSED: "slate",
};

export function StatusBadge({ status }: { status: string }) {
  const tone = STATUS_TONES[status] ?? "slate";
  return <Badge tone={tone}>{status.replaceAll("_", " ")}</Badge>;
}
