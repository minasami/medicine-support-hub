import { useEffect, useState } from "react";
import { Query, ExecutionMethod } from "appwrite";
import { databases, functions } from "@/lib/appwrite";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DB, type OrderDoc, type ParsedMedicine, type QuoteDoc } from "./rx-types";

type Props = { orderId: string; pharmacyId?: string };

export default function PharmacyQuoteEditor({ orderId, pharmacyId }: Props) {
  const [order, setOrder] = useState<OrderDoc | null>(null);
  const [items, setItems] = useState<ParsedMedicine[]>([]);
  const [notes, setNotes] = useState("");
  const [versions, setVersions] = useState<QuoteDoc[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const o = (await databases.getDocument(DB, "orders", orderId)) as unknown as OrderDoc;
      setOrder(o);
      const parsed = JSON.parse(o.items_json || "[]") as ParsedMedicine[];
      setItems(
        parsed.map((i) => ({
          ...i,
          quantity: Number(i.quantity || 1),
          price: Number(i.price || 0),
        })),
      );
      const qs = await databases.listDocuments(DB, "order_quotes", [
        Query.equal("order_id", orderId),
        Query.orderDesc("version"),
        Query.limit(20),
      ]);
      setVersions(qs.documents as unknown as QuoteDoc[]);
      if (qs.documents[0]?.notes) setNotes(String((qs.documents[0] as unknown as QuoteDoc).notes || ""));
    })().catch((e) => setError(String(e.message || e)));
  }, [orderId]);

  const total = items.reduce((s, i) => s + Number(i.price || 0) * Number(i.quantity || 1), 0);
  const locked = order && ["confirmed", "preparing", "ready", "delivered"].includes(order.status);

  function patchItem(idx: number, patch: Partial<ParsedMedicine>) {
    setItems((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  async function send() {
    if (!order || locked) return;
    setBusy(true);
    setError(null);
    try {
      const exec = await functions.createExecution(
        "pharmacy-update-quote",
        JSON.stringify({
          order_id: orderId,
          pharmacy_id: pharmacyId || order.pharmacy_id,
          quoted_items: items,
          total_price: total,
          notes,
        }),
        false,
        "/",
        ExecutionMethod.POST,
      );
      const data = JSON.parse(exec.responseBody || "{}");
      if (!data.success) throw new Error(data.error || "Quote failed");
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!order) return <p className="p-6 text-sm">Loading…</p>;

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Quote editor</h2>
      <p className="text-xs text-muted-foreground">
        Order {order.$id.slice(0, 8)} · status {order.status}
      </p>
      {locked ? <p className="text-sm text-amber-700">Quote locked after confirmation.</p> : null}
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-teal-800 text-white">
            <tr>
              <th className="p-2 text-left">Drug</th>
              <th className="p-2 text-left">Qty</th>
              <th className="p-2 text-left">Price</th>
              <th className="p-2 text-left">Line</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={`${item.drug_name}-${idx}`} className="border-t">
                <td className="p-2">
                  <Input
                    disabled={Boolean(locked)}
                    value={item.drug_name}
                    onChange={(e) => patchItem(idx, { drug_name: e.target.value })}
                  />
                  {item.dose ? <div className="text-[11px] text-muted-foreground">{item.dose}</div> : null}
                </td>
                <td className="p-2 w-20">
                  <Input
                    type="number"
                    min={1}
                    disabled={Boolean(locked)}
                    value={item.quantity ?? 1}
                    onChange={(e) => patchItem(idx, { quantity: Number(e.target.value) || 1 })}
                  />
                </td>
                <td className="p-2 w-28">
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    disabled={Boolean(locked)}
                    value={item.price ?? 0}
                    onChange={(e) => patchItem(idx, { price: Number(e.target.value) || 0 })}
                  />
                </td>
                <td className="p-2 text-right tabular-nums">
                  {(Number(item.price || 0) * Number(item.quantity || 1)).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="font-semibold">Total {total.toFixed(2)} EGP</p>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <Textarea
        placeholder="Notes to patient (alternatives, stock delays…)"
        value={notes}
        disabled={Boolean(locked)}
        onChange={(e) => setNotes(e.target.value)}
      />
      <Button disabled={busy || Boolean(locked) || items.length === 0} className="bg-teal-700" onClick={() => void send()}>
        Send quote to patient
      </Button>
      <div>
        <h3 className="mb-1 text-sm font-medium">Quote versions</h3>
        <ul className="space-y-1 text-xs text-muted-foreground">
          {versions.length === 0 ? <li>No quotes yet</li> : null}
          {versions.map((v) => (
            <li key={v.$id} className="rounded-lg border px-2 py-1">
              v{v.version} · {v.total_price} EGP · {v.status}
              {v.notes ? ` — ${v.notes}` : ""}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
