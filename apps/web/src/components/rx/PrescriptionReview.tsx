import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { Query } from "appwrite";
import { databases } from "@/lib/appwrite";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PharmacyPicker from "./PharmacyPicker";
import {
  DB,
  type PrescriptionDoc,
  type PrescriptionItemDoc,
  confidenceBand,
} from "./rx-types";

const BAND = {
  red: "bg-red-100 text-red-800",
  yellow: "bg-amber-100 text-amber-800",
  green: "bg-emerald-100 text-emerald-800",
};

export default function PrescriptionReview() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [rx, setRx] = useState<PrescriptionDoc | null>(null);
  const [items, setItems] = useState<PrescriptionItemDoc[]>([]);
  const [picker, setPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const doc = await databases.getDocument(DB, "prescriptions", id);
        setRx(doc as unknown as PrescriptionDoc);
        const list = await databases.listDocuments(DB, "prescription_items", [
          Query.equal("prescription_id", id),
          Query.limit(50),
        ]);
        setItems(list.documents as unknown as PrescriptionItemDoc[]);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [id]);

  async function saveItem(item: PrescriptionItemDoc, patch: Partial<PrescriptionItemDoc>) {
    const next = { ...item, ...patch, user_edited: true };
    await databases.updateDocument(DB, "prescription_items", item.$id, {
      drug_name: next.drug_name,
      suggested_dose: next.suggested_dose || "",
      user_edited: true,
      status: next.status,
    });
    setItems((rows) => rows.map((r) => (r.$id === item.$id ? next : r)));
  }

  async function addManual() {
    if (!id) return;
    const created = await databases.createDocument(DB, "prescription_items", "unique()", {
      prescription_id: id,
      drug_name: "New medicine",
      suggested_dose: "",
      frequency: "",
      duration: "",
      confidence: 1,
      user_edited: true,
      status: "manual",
    });
    setItems((rows) => [...rows, created as unknown as PrescriptionItemDoc]);
  }

  async function remove(item: PrescriptionItemDoc) {
    await databases.deleteDocument(DB, "prescription_items", item.$id);
    setItems((rows) => rows.filter((r) => r.$id !== item.$id));
  }

  if (error) return <p className="p-6 text-red-600">{error}</p>;
  if (!rx) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;

  return (
    <section className="mx-auto max-w-3xl space-y-4 px-4 py-8">
      <h1 className="text-2xl font-bold">Review prescription</h1>
      <p className="text-xs text-muted-foreground">
        Avg confidence {((rx.confidence_score || 0) * 100).toFixed(0)}% · AI assistive only
      </p>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-teal-800 text-white">
            <tr>
              <th className="p-2 text-left">Drug</th>
              <th className="p-2 text-left">Dose</th>
              <th className="p-2">Confidence</th>
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const band = confidenceBand(item.confidence);
              return (
                <tr key={item.$id} className="border-t">
                  <td className="p-2">
                    <Input defaultValue={item.drug_name} onBlur={(e) => saveItem(item, { drug_name: e.target.value })} />
                  </td>
                  <td className="p-2">
                    <Input defaultValue={item.suggested_dose || ""} onBlur={(e) => saveItem(item, { suggested_dose: e.target.value })} />
                  </td>
                  <td className="p-2 text-center">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${BAND[band]}`}>
                      {Math.round((item.confidence || 0) * 100)}%
                    </span>
                  </td>
                  <td className="p-2">
                    <Button size="sm" variant="ghost" onClick={() => remove(item)}>Delete</Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => void addManual()}>+ Add medicine manually</Button>
        <Button className="bg-teal-700" onClick={() => setPicker(true)}>Choose pharmacy</Button>
      </div>
      {picker && id ? <PharmacyPicker prescriptionId={id} items={items} onClose={() => setPicker(false)} /> : null}
    </section>
  );
}
