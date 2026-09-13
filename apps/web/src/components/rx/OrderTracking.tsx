import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { databases, client } from "@/lib/appwrite";
import { Button } from "@/components/ui/button";
import { DB, type OrderDoc, type QuoteDoc } from "./rx-types";
import { OcrAiDisclaimer } from "@/components/ocr-ai-disclaimer";

const STEPS = ["sent", "quoted", "confirmed", "ready", "delivered"] as const;

export default function OrderTracking() {
  const { order_id } = useParams<{ order_id: string }>();
  const [order, setOrder] = useState<OrderDoc | null>(null);
  const [quote, setQuote] = useState<QuoteDoc | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function loadQuote(quoteId?: string) {
    if (!quoteId) {
      setQuote(null);
      return;
    }
    try {
      setQuote((await databases.getDocument(DB, "order_quotes", quoteId)) as unknown as QuoteDoc);
    } catch {
      setQuote(null);
    }
  }

  useEffect(() => {
    if (!order_id) return;
    let unsub: (() => void) | undefined;
    (async () => {
      const o = (await databases.getDocument(DB, "orders", order_id)) as unknown as OrderDoc;
      setOrder(o);
      await loadQuote(o.current_quote_id);
      unsub = client.subscribe(`databases.${DB}.collections.orders.documents.${order_id}`, (ev) => {
        const next = ev.payload as OrderDoc;
        setOrder(next);
        void loadQuote(next.current_quote_id);
      });
    })().catch((e) => setError(String(e.message || e)));
    return () => unsub?.();
  }, [order_id]);

  async function accept() {
    if (!order) return;
    setBusy(true);
    setError(null);
    try {
      await databases.updateDocument(DB, "orders", order.$id, { status: "confirmed" });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  async function reject() {
    if (!order) return;
    setBusy(true);
    setError(null);
    try {
      await databases.updateDocument(DB, "orders", order.$id, { status: "cancelled" });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (error && !order) return <p className="p-6 text-red-600">{error}</p>;
  if (!order) return <p className="p-6 text-sm">Loading…</p>;
  const idx = STEPS.indexOf(order.status as (typeof STEPS)[number]);

  return (
    <section className="mx-auto max-w-lg space-y-6 px-4 py-8">
      <h1 className="text-2xl font-bold">Order {order.$id.slice(0, 8)}</h1>
      <OcrAiDisclaimer />
      <ol className="flex justify-between text-[10px] uppercase tracking-wide">
        {STEPS.map((s, i) => (
          <li key={s} className={i <= idx || order.status === "cancelled" && s === "sent" ? "font-bold text-teal-700" : "text-muted-foreground"}>
            {s}
          </li>
        ))}
      </ol>
      {order.status === "cancelled" ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">Order cancelled</p>
      ) : null}
      {quote ? (
        <div className="rounded-2xl border p-4">
          <p className="font-semibold">
            {quote.total_price} EGP <span className="text-xs font-normal text-muted-foreground">v{quote.version}</span>
          </p>
          {quote.notes ? <p className="mt-1 text-sm text-muted-foreground">{quote.notes}</p> : null}
          {order.status === "quoted" ? (
            <div className="mt-3 flex gap-2">
              <Button className="bg-teal-700" disabled={busy} onClick={() => void accept()}>
                Accept
              </Button>
              <Button variant="outline" disabled={busy} onClick={() => void reject()}>
                Reject
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Waiting for pharmacy quote…</p>
      )}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="flex flex-wrap gap-3 text-sm">
        <a className="underline" href={`/order/chat/${order.$id}`}>
          Open chat
        </a>
        <a className="underline" href={`/pharmacy/quote/${order.$id}`}>
          Pharmacy quote desk
        </a>
      </div>
    </section>
  );
}
