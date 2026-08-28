"use client";

import { useEffect, useState } from "react";

import AppShell from "@/components/AppShell";
import { Alert, EmptyRow } from "@/components/ui";
import { api } from "@/lib/api";

type PatientBrief = { id: number; mrn: string; full_name: string; phone: string | null };
type ServiceItem = { id: number; code: string; name: string; category: string; price: number };
type Line = { description: string; quantity: number; unit_price: number; discount: number };
type Invoice = {
  id: number;
  invoice_no: string | null;
  status: string;
  grand_total: number;
  amount_paid: number;
  currency: string;
};

const METHODS = ["CASH", "CARD", "UPI", "INSURANCE", "CHEQUE"];

export default function BillingPage() {
  const [patient, setPatient] = useState<PatientBrief | null>(null);
  const [patientQuery, setPatientQuery] = useState("");
  const [matches, setMatches] = useState<PatientBrief[]>([]);

  const [services, setServices] = useState<ServiceItem[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [invoiceDiscount, setInvoiceDiscount] = useState(0);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("CASH");
  const [preauth, setPreauth] = useState<Record<string, unknown> | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<ServiceItem[]>("/api/services")
      .then(setServices)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load services"));
  }, []);

  async function searchPatients() {
    if (patientQuery.trim().length < 2) return;
    try {
      const data = await api<{ items: PatientBrief[] }>(
        `/api/patients?page_size=8&q=${encodeURIComponent(patientQuery.trim())}`
      );
      setMatches(data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    }
  }

  async function loadInvoices(pid: number) {
    try {
      const data = await api<Invoice[]>(`/api/invoices?patient_id=${pid}`);
      setInvoices(data);
    } catch {
      setInvoices([]);
    }
  }

  function addService(s: ServiceItem) {
    setLines((ls) => [
      ...ls,
      { description: s.name, quantity: 1, unit_price: s.price, discount: 0 },
    ]);
  }

  function updateLine(idx: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  const subtotal = lines.reduce((s, l) => s + l.quantity * l.unit_price, 0);
  const balance = invoice ? invoice.grand_total - invoice.amount_paid : 0;

  async function createAndIssue() {
    if (!patient || !lines.length) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const created = await api<Invoice>("/api/invoices", {
        method: "POST",
        body: JSON.stringify({ patient_id: patient.id, lines, invoice_discount: invoiceDiscount }),
      });
      const issued = await api<Invoice>(`/api/invoices/${created.id}/issue`, { method: "POST" });
      setInvoice(issued);
      setPayAmount(String(issued.grand_total));
      setMessage(`Invoice ${issued.invoice_no} issued for ₹${issued.grand_total}`);
      setLines([]);
      setInvoiceDiscount(0);
      await loadInvoices(patient.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create invoice");
    } finally {
      setBusy(false);
    }
  }

  async function pay() {
    if (!invoice || !payAmount) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/invoices/${invoice.id}/payments`, {
        method: "POST",
        body: JSON.stringify({ amount: Number(payAmount), method: payMethod }),
      });
      const fresh = await api<Invoice>(`/api/invoices/${invoice.id}`);
      setInvoice(fresh);
      setPayAmount(String(fresh.grand_total - fresh.amount_paid));
      setMessage(`Payment recorded ₹ ${fresh.status.replaceAll("_", " ")}`);
      if (patient) await loadInvoices(patient.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setBusy(false);
    }
  }

  const categories = [...new Set(services.map((s) => s.category))];

  return (
    <AppShell title="Billing">
      {error && <Alert kind="error">{error}</Alert>}
      {message && <Alert kind="success">{message}</Alert>}

      <div className="card mb-6">
        <label className="label">Patient</label>
        {patient ? (
          <div className="flex items-center gap-3 text-sm">
            <span className="font-medium">{patient.full_name}</span>
            <span className="font-mono text-xs text-slate-500">{patient.mrn}</span>
            <button
              className="btn-secondary !py-1 text-xs"
              onClick={() => {
                setPatient(null);
                setInvoices([]);
                setInvoice(null);
              }}
            >
              Change
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              className="input max-w-sm"
              placeholder="Name / MRN / phone₹"
              value={patientQuery}
              onChange={(e) => setPatientQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchPatients()}
            />
            <button className="btn-secondary" onClick={searchPatients}>
              Search
            </button>
          </div>
        )}
        {!patient && matches.length > 0 && (
          <div className="mt-2 rounded-md border divide-y max-w-md">
            {matches.map((m) => (
              <button
                key={m.id}
                className="block w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
                onClick={() => {
                  setPatient(m);
                  setMatches([]);
                  setPatientQuery("");
                  loadInvoices(m.id);
                }}
              >
                <span className="font-mono text-xs">{m.mrn}</span> ?? {m.full_name}
              </button>
            ))}
          </div>
        )}
      </div>

      {patient && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-4">
            <div className="card">
              <div className="text-sm font-semibold mb-2">Add services</div>
              {categories.map((cat) => (
                <div key={cat} className="mb-3">
                  <div className="label">{cat}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {services
                      .filter((s) => s.category === cat)
                      .map((s) => (
                        <button
                          key={s.id}
                          className="btn-secondary !px-2 !py-1 text-xs"
                          onClick={() => addService(s)}
                          title={`₹${s.price}`}
                        >
                          + {s.name}
                        </button>
                      ))}
                  </div>
                </div>
              ))}
            </div>

            {invoices.length > 0 && (
              <div className="card overflow-x-auto">
                <div className="text-sm font-semibold mb-2">Patient invoices</div>
                <table className="min-w-full">
                  <tbody className="divide-y divide-slate-100">
                    {invoices.map((i) => (
                      <tr key={i.id}>
                        <td className="td font-mono text-xs">{i.invoice_no ?? "(draft)"}</td>
                        <td className="td">₹{i.grand_total.toLocaleString()}</td>
                        <td className="td">
                          <span
                            className={`chip ${
                              i.status === "PAID"
                                ? "bg-green-100 text-green-700"
                                : i.status === "CANCELLED"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {i.status.replaceAll("_", " ")}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="lg:col-span-2 space-y-4">
            <div className="card overflow-x-auto">
              <div className="text-sm font-semibold mb-2">Current bill</div>
              <table className="min-w-full divide-y divide-slate-200">
                <thead>
                  <tr>
                    <th className="th">Description</th>
                    <th className="th w-24">Qty</th>
                    <th className="th w-28">Price ₹</th>
                    <th className="th w-28">Disc ₹</th>
                    <th className="th text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lines.map((l, idx) => (
                    <tr key={idx}>
                      <td className="td">{l.description}</td>
                      <td className="td">
                        <input
                          type="number"
                          min={1}
                          className="input !px-2 !py-1"
                          value={l.quantity}
                          onChange={(e) => updateLine(idx, { quantity: Number(e.target.value) })}
                        />
                      </td>
                      <td className="td">
                        <input
                          type="number"
                          min={0}
                          className="input !px-2 !py-1"
                          value={l.unit_price}
                          onChange={(e) => updateLine(idx, { unit_price: Number(e.target.value) })}
                        />
                      </td>
                      <td className="td">
                        <input
                          type="number"
                          min={0}
                          className="input !px-2 !py-1"
                          value={l.discount}
                          onChange={(e) => updateLine(idx, { discount: Number(e.target.value) })}
                        />
                      </td>
                      <td className="td text-right font-medium">
                        ₹{(l.quantity * l.unit_price - l.discount).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                  {!lines.length && (
                    <tr>
                      <td className="td text-slate-400" colSpan={5}>
                        Add services from the left panel.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {lines.length > 0 && (
                <div className="mt-3 flex items-center justify-end gap-6 text-sm">
                  <div>
                    Invoice discount ₹{" "}
                    <input
                      type="number"
                      min={0}
                      className="input !w-24 inline-block !px-2 !py-1"
                      value={invoiceDiscount}
                      onChange={(e) => setInvoiceDiscount(Number(e.target.value))}
                    />
                  </div>
                  <div className="text-lg font-semibold">
                    Total: ₹{Math.max(0, subtotal - lines.reduce((s, l) => s + l.discount, 0) - invoiceDiscount).toFixed(2)}
                  </div>
                </div>
              )}

              <button
                className="btn-primary mt-4"
                disabled={busy || !lines.length}
                onClick={createAndIssue}
              >
                Create &amp; issue invoice
              </button>
            </div>

            {invoice && (
              <div className="card">
                <div className="text-sm font-semibold mb-2">
                  Payment ₹ {invoice.invoice_no}
                  <span className="ml-2 chip bg-blue-100 text-blue-700">
                    {invoice.status.replaceAll("_", " ")}
                  </span>
                </div>
                {balance > 0 ? (
                  <div className="flex items-end gap-3">
                    <div>
                      <label className="label">Amount (balance ₹{balance.toFixed(2)})</label>
                      <input
                        type="number"
                        className="input !w-36"
                        value={payAmount}
                        onChange={(e) => setPayAmount(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="label">Method</label>
                      <select className="input !w-32" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                        {METHODS.map((m) => (
                          <option key={m}>{m}</option>
                        ))}
                      </select>
                    </div>
                    <button className="btn-primary" disabled={busy} onClick={pay}>
                      Record payment
                    </button>
                  </div>
                ) : (
                  <div className="text-sm text-emerald-600 font-medium">Fully paid</div>
                )}

                <div className="mt-4 border-t border-slate-100 pt-3">
                  <button
                    className="btn-secondary"
                    disabled={busy || !invoice || invoice.status === "DRAFT"}
                    onClick={async () => {
                      if (!invoice) return;
                      setBusy(true);
                      setError(null);
                      try {
                        const res = await api<Record<string, unknown>>(
                          `/api/ai/ops/preauth/draft?invoice_id=${invoice.id}`,
                          { method: "POST" }
                        );
                        setPreauth(res);
                        setMessage("Pre-auth packet drafted - copy for payer submission");
                      } catch (e) {
                        setError(e instanceof Error ? e.message : "Pre-auth failed");
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Draft insurance pre-auth (AI)
                  </button>
                  {preauth && (
                    <pre className="mt-2 max-h-60 overflow-auto rounded-lg bg-slate-950 p-3 font-mono text-[11px] leading-relaxed text-emerald-300">
{JSON.stringify(preauth, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}

