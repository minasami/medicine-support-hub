import { useEffect, useMemo, useState } from "react";
import { Query, ExecutionMethod } from "appwrite";
import { account, databases, functions } from "@/lib/appwrite";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DB, haversineKm, type PharmacyDoc, type PrescriptionItemDoc } from "./rx-types";

type Props = {
  prescriptionId: string;
  items: PrescriptionItemDoc[];
  onClose: () => void;
};

export default function PharmacyPicker({ prescriptionId, items, onClose }: Props) {
  const [tab, setTab] = useState<"nearest" | "search">("nearest");
  const [q, setQ] = useState("");
  const [here, setHere] = useState<{ lat: number; lng: number } | null>(null);
  const [rows, setRows] = useState<PharmacyDoc[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (p) => setHere({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => setHere(null),
        { timeout: 4000 },
      );
    }
    databases
      .listDocuments(DB, "pharmacies", [Query.equal("is_active", true), Query.limit(100)])
      .then((r) => setRows(r.documents as unknown as PharmacyDoc[]))
      .catch((e) => setError(String(e.message || e)));
  }, []);

  const visible = useMemo(() => {
    let list = rows;
    if (tab === "search" && q.trim()) {
      const s = q.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(s) || (p.address || "").toLowerCase().includes(s));
    }
    if (here) {
      list = [...list].sort((a, b) => {
        const da = a.lat != null && a.lng != null ? haversineKm(here.lat, here.lng, a.lat, a.lng) : 9999;
        const db = b.lat != null && b.lng != null ? haversineKm(here.lat, here.lng, b.lat, b.lng) : 9999;
        return da - db;
      });
    }
    return list;
  }, [rows, tab, q, here]);

  async function select(pharmacy: PharmacyDoc) {
    setBusy(true);
    setError(null);
    try {
      const user = await account.get();
      await databases.updateDocument(DB, "prescriptions", prescriptionId, {
        pharmacy_id: pharmacy.$id,
        status: "sent",
      });
      const order = await databases.createDocument(DB, "orders", "unique()", {
        prescription_id: prescriptionId,
        user_id: user.$id,
        pharmacy_id: pharmacy.$id,
        items_json: JSON.stringify(
          items.map((i) => ({ drug_name: i.drug_name, dose: i.suggested_dose, confidence: i.confidence })),
        ),
        status: "sent",
        current_quote_id: "",
        quote_price: 0,
        currency: "EGP",
      });
      try {
        await functions.createExecution(
          "sendPush",
          JSON.stringify({ user_id: pharmacy.$id, title: "New prescription request", body: "A patient sent a prescription for review" }),
          true,
          "/",
          ExecutionMethod.POST,
        );
      } catch {
        /* optional */
      }
      window.location.href = `/order/${order.$id}`;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40 sm:items-center">
      <div className="max-h-[85vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 sm:mx-auto sm:max-w-lg sm:rounded-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Choose pharmacy</h2>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </div>
        <div className="mb-3 flex gap-2">
          <Button variant={tab === "nearest" ? "default" : "outline"} onClick={() => setTab("nearest")}>Nearest</Button>
          <Button variant={tab === "search" ? "default" : "outline"} onClick={() => setTab("search")}>Search</Button>
        </div>
        {tab === "search" ? (
          <Input className="mb-3" placeholder="Pharmacy name or area" value={q} onChange={(e) => setQ(e.target.value)} />
        ) : null}
        {error ? <p className="mb-2 text-sm text-red-600">{error}</p> : null}
        <ul className="space-y-2">
          {visible.map((p) => {
            const km = here && p.lat != null && p.lng != null ? haversineKm(here.lat, here.lng, p.lat, p.lng) : null;
            return (
              <li key={p.$id} className="flex items-center justify-between rounded-xl border p-3">
                <div>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{p.address || "—"}{km != null ? ` \u00b7 ${km.toFixed(1)} km` : ""}</div>
                </div>
                <Button size="sm" disabled={busy} onClick={() => void select(p)}>Select</Button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
