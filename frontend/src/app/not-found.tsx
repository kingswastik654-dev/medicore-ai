import Link from "next/link";
import Icon from "@/components/Icon";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[var(--bg)] px-6 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg">
        <Icon name="heart" className="h-7 w-7" />
      </span>
      <div>
        <p className="font-display text-7xl font-extrabold tracking-tight text-[var(--text)]">404</p>
        <h1 className="mt-3 text-xl font-bold text-[var(--text)]">This page flatlined</h1>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-[var(--muted)]">
          The page you are looking for does not exist or was moved. Your data is safe — nothing was lost.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Link href="/" className="btn-primary !rounded-full">Back to home</Link>
        <Link href="/login" className="btn-secondary !rounded-full">Open console</Link>
      </div>
    </div>
  );
}
