export type ConfidenceBand = "red" | "yellow" | "green";

export type ParsedMedicine = {
  drug_name: string;
  dose?: string;
  frequency?: string;
  duration?: string;
  quantity?: number;
  price?: number;
  confidence?: number;
  alternative_of?: string;
  reason?: string;
};

export type PrescriptionDoc = {
  $id: string;
  user_id: string;
  image_id?: string;
  image_url?: string;
  status: string;
  pharmacy_id?: string;
  ai_parsed_json?: string;
  confidence_score?: number;
  final_order_json?: string;
};

export type PrescriptionItemDoc = {
  $id: string;
  prescription_id: string;
  drug_name: string;
  suggested_dose?: string;
  frequency?: string;
  duration?: string;
  confidence?: number;
  user_edited?: boolean;
  status: string;
};

export type OrderStatus =
  | "sent"
  | "pharmacy_reviewing"
  | "quoted"
  | "confirmed"
  | "preparing"
  | "ready"
  | "delivered"
  | "cancelled";

export type OrderDoc = {
  $id: string;
  prescription_id: string;
  user_id: string;
  pharmacy_id: string;
  items_json?: string;
  status: OrderStatus;
  current_quote_id?: string;
  quote_price?: number;
  currency?: string;
};

export type QuoteDoc = {
  $id: string;
  order_id: string;
  pharmacy_id: string;
  quoted_items_json: string;
  total_price: number;
  notes?: string;
  status: string;
  version: number;
};

export type OrderMessageDoc = {
  $id: string;
  order_id: string;
  sender_id: string;
  sender_role: "user" | "pharmacy" | "system";
  message?: string;
  attachments?: string;
  timestamp: string;
};

export type PharmacyDoc = {
  $id: string;
  name: string;
  lat?: number;
  lng?: number;
  address?: string;
  is_active?: boolean;
};

export type AnnotationDoc = {
  $id: string;
  image_id?: string;
  prescription_id?: string;
  ai_parsed_json?: string;
  ground_truth_json?: string;
  votes?: string;
  status: "pending" | "in_review" | "approved" | "used_for_training";
  assigned_pharmacists?: string;
  confidence?: number;
};

export const DB = "medicine_support_hub";

export function confidenceBand(c?: number): ConfidenceBand {
  const n = Number(c) || 0;
  if (n < 0.6) return "red";
  if (n < 0.8) return "yellow";
  return "green";
}

export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
