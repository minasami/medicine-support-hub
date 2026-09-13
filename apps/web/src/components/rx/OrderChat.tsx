import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { ID, Query } from "appwrite";
import { account, client, databases, storage } from "@/lib/appwrite";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DB, type OrderDoc, type OrderMessageDoc } from "./rx-types";

const BUCKET = import.meta.env.VITE_APPWRITE_RX_BUCKET || "prescription-images";

export default function OrderChat() {
  const { order_id } = useParams<{ order_id: string }>();
  const [me, setMe] = useState("");
  const [role, setRole] = useState<"user" | "pharmacy">("user");
  const [rows, setRows] = useState<OrderMessageDoc[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!order_id) return;
    let unsub: (() => void) | undefined;
    (async () => {
      const user = await account.get();
      setMe(user.$id);
      try {
        const order = (await databases.getDocument(DB, "orders", order_id)) as unknown as OrderDoc;
        setRole(order.pharmacy_id === user.$id ? "pharmacy" : "user");
        // also treat pharmacy owner match via pharmacies.owner_user_id
        try {
          const ph = await databases.getDocument(DB, "pharmacies", order.pharmacy_id);
          const owner = (ph as { owner_user_id?: string; user_id?: string }).owner_user_id
            || (ph as { user_id?: string }).user_id;
          if (owner && owner === user.$id) setRole("pharmacy");
        } catch {
          /* pharmacy doc optional */
        }
      } catch {
        setRole("user");
      }
      const list = await databases.listDocuments(DB, "order_messages", [
        Query.equal("order_id", order_id),
        Query.orderAsc("timestamp"),
        Query.limit(100),
      ]);
      setRows(list.documents as unknown as OrderMessageDoc[]);
      unsub = client.subscribe(`databases.${DB}.collections.order_messages.documents`, (ev) => {
        const doc = ev.payload as OrderMessageDoc;
        if (doc.order_id === order_id) {
          setRows((cur) => (cur.some((r) => r.$id === doc.$id) ? cur : [...cur, doc]));
        }
      });
    })().catch((e) => setError(String(e.message || e)));
    return () => unsub?.();
  }, [order_id]);

  async function send(file?: File) {
    if (!order_id || (!text.trim() && !file)) return;
    setError(null);
    try {
      let attachments = "[]";
      if (file) {
        const up = await storage.createFile(BUCKET, ID.unique(), file);
        attachments = JSON.stringify([up.$id]);
      }
      await databases.createDocument(DB, "order_messages", ID.unique(), {
        order_id,
        sender_id: me,
        sender_role: role,
        message: text.trim(),
        attachments,
        timestamp: new Date().toISOString(),
      });
      setText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <section className="mx-auto flex h-[80vh] max-w-lg flex-col px-4 py-4">
      <h1 className="mb-2 text-lg font-semibold">Order chat</h1>
      <p className="mb-2 text-xs text-muted-foreground">Signed in as {role}</p>
      {error ? <p className="mb-2 text-sm text-red-600">{error}</p> : null}
      <div className="flex-1 space-y-2 overflow-y-auto">
        {rows.map((m) => (
          <div
            key={m.$id}
            className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
              m.sender_id === me ? "ml-auto bg-teal-700 text-white" : "bg-slate-100"
            }`}
          >
            <div className="text-[10px] opacity-70">{m.sender_role}</div>
            {m.message}
          </div>
        ))}
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Message" />
        <label className="inline-flex cursor-pointer items-center rounded-md border px-2 text-xs">
          📎
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void send(f);
            }}
          />
        </label>
        <Button type="submit">Send</Button>
      </form>
    </section>
  );
}
