import { useParams } from "wouter";
import PharmacyQuoteEditor from "@/components/rx/PharmacyQuoteEditor";

export default function PharmacyQuotePage() {
  const { order_id } = useParams<{ order_id: string }>();
  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <PharmacyQuoteEditor orderId={order_id || ""} />
    </main>
  );
}
