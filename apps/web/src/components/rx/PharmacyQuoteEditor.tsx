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
      setItems(JSON.parse(o.items_json || "[]"));
      const qs = await databases.listDocuments(DB, "order_quotes", [
        Query.equal("order_id", orderId),
        Query.orderDesc("version"),
        Query.limit(20),
      ]);
      setVersions(qs.documents as unknown as QuoteDoc[]);
    })().catch((e) => setError(String(e.message || e)));
  }, [orderId]);

  const total = items.reduce((s, i) => s + Number(i.price || 0) * Number(i.quantity || 1), 0);
  const locked = order && ["confirmed", "preparing", "ready", "delivered"].includes(order.status);

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
      {locked ? <p className="text-sm text-amber-700">Quote locked after confirmation.</p> : null}
      <p className="font-semibold">Total {total.toFixed(2)} EGP</p>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <Textarea placeholder="Notes to patient" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <Button disabled={busy || Boolean(locked)} className="bg-teal-700" onClick={() => void send()}>
        Send quote to patient
      </Button>
      <ul className="text-xs text-muted-foreground">
        {versions.map((v) => (
          <li key={v.$id}>v{v.version} · {v.total_price} EGP · {v.status}</li>
        ))}
      </ul>
    </section>
  );
}
