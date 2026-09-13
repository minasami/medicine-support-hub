import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { ID, Query } from "appwrite";
import { account, client, databases, storage } from "@/lib/appwrite";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DB, type OrderMessageDoc } from "./rx-types";

const BUCKET = import.meta.env.VITE_APPWRITE_RX_BUCKET || "prescription-images";

export default function OrderChat() {
  const { order_id } = useParams<{ order_id: string }>();
  const [me, setMe] = useState("");
  const [role, setRole] = useState<"user" | "pharmacy">("user");
  const [rows, setRows] = useState<OrderMessageDoc[]>([]);
  const [text, setText] = useState("");

  useEffect(() => {
    if (!order_id) return;
    let unsub: (() => void) | undefined;
    (async () => {
      const user = await account.get();
      setMe(user.$id);
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
    })();
    return () => unsub?.();
  }, [order_id]);

  async function send(file?: File) {
    if (!order_id || (!text.trim() && !file)) return;
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
  }

  return (
    <section className="mx-auto flex h-[80vh] max-w-lg flex-col px-4 py-4">
      <h1 className="mb-2 text-lg font-semibold">Order chat</h1>
      <div className="flex-1 space-y-2 overflow-y-auto">
        {rows.map((m) => (
          <div key={m.$id} className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${m.sender_id === me ? "ml-auto bg-teal-700 text-white" : "bg-slate-100"}`}>
            {m.message}
          </div>
        ))}
      </div>
      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); void send(); }}>
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Message" />
        <Button type="submit">Send</Button>
      </form>
    </section>
  );
}
