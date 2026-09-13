import { useEffect, useMemo, useState } from "react";
import { Query, ExecutionMethod } from "appwrite";
import { account, databases, functions } from "@/lib/appwrite";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DB, type AnnotationDoc } from "./rx-types";

function levelFor(trust: number) {
  if (trust >= 90) return { name: "Gold annotator", emoji: "🥇", next: null };
  if (trust >= 70) return { name: "Silver annotator", emoji: "🥈", next: 90 };
  if (trust >= 50) return { name: "Bronze annotator", emoji: "🥉", next: 70 };
  return { name: "Trainee", emoji: "🌱", next: 50 };
}

export default function AnnotationDashboard() {
  const [uid, setUid] = useState("");
  const [trust, setTrust] = useState(50);
  const [points, setPoints] = useState(0);
  const [streak, setStreak] = useState(0);
  const [roleOk, setRoleOk] = useState(false);
  const [queue, setQueue] = useState<AnnotationDoc[]>([]);
  const [active, setActive] = useState<AnnotationDoc | null>(null);
  const [draft, setDraft] = useState("[]");
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const level = useMemo(() => levelFor(trust), [trust]);

  useEffect(() => {
    (async () => {
      const user = await account.get();
      setUid(user.$id);
      const profiles = await databases.listDocuments(DB, "user_profiles", [
        Query.equal("user_id", user.$id),
        Query.limit(1),
      ]);
      const p = profiles.documents[0] as
        | {
            role?: string;
            trust_score?: number;
            is_verified_pharmacist?: boolean;
            annotation_points?: number;
            annotation_streak?: number;
          }
        | undefined;
      setTrust(Number(p?.trust_score || 50));
      setPoints(Number(p?.annotation_points || 0));
      setStreak(Number(p?.annotation_streak || 0));
      const ok = p?.role === "pharmacist" && Boolean(p?.is_verified_pharmacist);
      setRoleOk(ok);
      if (!ok) return;
      const list = await databases.listDocuments(DB, "annotations", [
        Query.equal("status", ["pending", "in_review"]),
        Query.limit(50),
      ]);
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
    setError(null);
    const exec = await functions.createExecution(
      "submit-annotation",
      JSON.stringify({
        annotation_id: active.$id,
        pharmacist_id: uid,
        corrected_json: JSON.parse(draft),
        ballot: "correct",
      }),
      false,
      "/",
      ExecutionMethod.POST,
    );
    const data = JSON.parse(exec.responseBody || "{}");
    if (!data.success) {
      setError(data.error || "Submit failed");
      return;
    }
    const mine = (data.rewards || []).find((r: { pharmacist_id: string }) => r.pharmacist_id === uid);
    if (mine?.trust_score != null) setTrust(Number(mine.trust_score));
    if (mine?.delta) {
      setPoints((p) => p + Math.max(0, Number(mine.delta)));
      setStreak((s) => s + 1);
      setFlash(
        data.settled
          ? `Majority reached! Trust ${mine.delta > 0 ? "+" : ""}${mine.delta}`
          : `Vote recorded (${data.votes}/${data.votes_needed}). Trust pending settlement.`,
      );
    } else {
      setFlash(`Vote recorded (${data.votes}/${data.votes_needed})`);
    }
    setQueue((q) => q.filter((a) => a.$id !== active.$id));
    setActive(null);
  }

  if (error && !roleOk) return <p className="p-6 text-red-600">{error}</p>;
  if (!roleOk) {
    return <p className="p-6 text-sm">Annotation dashboard is limited to verified pharmacists.</p>;
  }

  return (
    <section className="mx-auto max-w-3xl space-y-4 px-4 py-8">
      <h1 className="text-2xl font-bold">Annotation queue</h1>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border bg-teal-50/60 p-3">
          <div className="text-xs text-muted-foreground">Trust</div>
          <div className="text-xl font-bold">{trust}</div>
          <div className="text-xs">
            {level.emoji} {level.name}
            {level.next ? ` · next ${level.next}` : ""}
          </div>
        </div>
        <div className="rounded-2xl border p-3">
          <div className="text-xs text-muted-foreground">Points</div>
          <div className="text-xl font-bold">{points}</div>
          <div className="text-xs">+5 majority / −2 minority</div>
        </div>
        <div className="rounded-2xl border p-3">
          <div className="text-xs text-muted-foreground">Streak</div>
          <div className="text-xl font-bold">{streak}</div>
          <div className="text-xs">consecutive submissions</div>
        </div>
      </div>
      {flash ? <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{flash}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <ul className="space-y-2">
        {queue.map((a) => (
          <li key={a.$id}>
            <button
              type="button"
              className="w-full rounded-xl border p-3 text-left text-sm"
              onClick={() => {
                setActive(a);
                setDraft(a.ai_parsed_json || a.ground_truth_json || "[]");
              }}
            >
              {a.$id.slice(0, 8)} · {a.status} · conf {Math.round((a.confidence || 0) * 100)}%
            </button>
          </li>
        ))}
        {queue.length === 0 ? <li className="text-sm text-muted-foreground">Queue empty — nice work.</li> : null}
      </ul>
      {active ? (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Correct the AI JSON. 3 pharmacist votes → majority ground truth.
          </p>
          <Textarea rows={12} value={draft} onChange={(e) => setDraft(e.target.value)} className="font-mono text-xs" />
          <Button className="bg-teal-700" onClick={() => void submit()}>
            Submit correction
          </Button>
        </div>
      ) : null}
    </section>
  );
}
