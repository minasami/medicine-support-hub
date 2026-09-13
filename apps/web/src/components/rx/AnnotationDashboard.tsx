import { useEffect, useState } from "react";
import { Query, ExecutionMethod } from "appwrite";
import { account, databases, functions } from "@/lib/appwrite";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DB, type AnnotationDoc } from "./rx-types";

export default function AnnotationDashboard() {
  const [uid, setUid] = useState("");
  const [trust, setTrust] = useState(50);
  const [roleOk, setRoleOk] = useState(false);
  const [queue, setQueue] = useState<AnnotationDoc[]>([]);
  const [active, setActive] = useState<AnnotationDoc | null>(null);
  const [draft, setDraft] = useState("[]");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const user = await account.get();
      setUid(user.$id);
      const profiles = await databases.listDocuments(DB, "user_profiles", [
        Query.equal("user_id", user.$id),
        Query.limit(1),
      ]);
      const p = profiles.documents[0] as { role?: string; trust_score?: number; is_verified_pharmacist?: boolean } | undefined;
      setTrust(p?.trust_score || 50);
      const ok = p?.role === "pharmacist" && Boolean(p?.is_verified_pharmacist);
      setRoleOk(ok);
      if (!ok) return;
      const list = await databases.listDocuments(DB, "annotations", [Query.equal("status", "pending"), Query.limit(50)]);
      setQueue(list.documents as unknown as AnnotationDoc[]);
    })().catch((e) => setError(String(e.message || e)));
  }, []);

  async function submit() {
    if (!active) return;
    try {
      JSON.parse(draft);
    } catch {
      setError("corrected JSON is invalid");
      return;
    }
    const exec = await functions.createExecution(
      "submit-annotation",
      JSON.stringify({ annotation_id: active.$id, pharmacist_id: uid, corrected_json: JSON.parse(draft) }),
      false,
      "/",
      ExecutionMethod.POST,
    );
    const data = JSON.parse(exec.responseBody || "{}");
    if (!data.success) {
      setError(data.error || "Submit failed");
      return;
    }
    setQueue((q) => q.filter((a) => a.$id !== active.$id));
    setActive(null);
  }

  if (error) return <p className="p-6 text-red-600">{error}</p>;
  if (!roleOk) {
    return <p className="p-6 text-sm">Annotation dashboard is limited to verified pharmacists.</p>;
  }

  return (
    <section className="mx-auto max-w-3xl space-y-4 px-4 py-8">
      <h1 className="text-2xl font-bold">Annotation queue</h1>
      <p className="text-sm">Trust score <strong>{trust}</strong></p>
      <ul className="space-y-2">
        {queue.map((a) => (
          <li key={a.$id}>
            <button type="button" className="w-full rounded-xl border p-3 text-left text-sm" onClick={() => { setActive(a); setDraft(a.ai_parsed_json || "[]"); }}>
              {a.$id.slice(0, 8)} · conf {Math.round((a.confidence || 0) * 100)}%
            </button>
          </li>
        ))}
      </ul>
      {active ? (
        <div className="space-y-3">
          <Textarea rows={12} value={draft} onChange={(e) => setDraft(e.target.value)} className="font-mono text-xs" />
          <Button className="bg-teal-700" onClick={() => void submit()}>Submit correction</Button>
        </div>
      ) : null}
    </section>
  );
}
