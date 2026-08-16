import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Download, Receipt, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { downloadCsv } from "@/lib/csv-export";
import { usePatientAuth } from "@/lib/patient-auth";
import { useLanguage } from "@/lib/i18n";

type Branch = { id: string; branch_name: string; city: string | null };
type Item = { id: string; item_name: string; barcode: string | null };
type Batch = {
  id: string;
  item_id: string;
  batch_number: string | null;
  expiry_date: string | null;
  quantity_on_hand: string | number;
  unit_cost: string | number;
  selling_price: string | number;
};
type Sale = {
  id: string;
  sale_date: string;
  customer_name: string | null;
  total_amount: string | number;
  gross_profit: string | number;
  payment_method: string;
  created_at: string;
};

export default function PharmacySales() {
  const { t } = useLanguage();
  const { isAuthenticated, session, supabaseFetch } = usePatientAuth();
  const userId = session?.user?.id;
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [itemId, setItemId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [qty, setQty] = useState("1");
  const [price, setPrice] = useState("");
  const [payment, setPayment] = useState("cash");
  const [customer, setCustomer] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      if (!isAuthenticated || !userId)
        throw new Error(t("Sign in first.", "سجّل الدخول أولًا."));
      const branchRows = await supabaseFetch<Branch[]>(
        "/rest/v1/pharmacy_branches?select=id,branch_name,city&is_active=eq.true&order=created_at.asc",
      );
      setBranches(branchRows);
      const active = branchId || branchRows[0]?.id || "";
      setBranchId(active);
      if (!active) return;
      const [itemRows, batchRows, saleRows] = await Promise.all([
        supabaseFetch<Item[]>(
          `/rest/v1/pharmacy_inventory_items?select=id,item_name,barcode&branch_id=eq.${active}&is_active=eq.true&order=item_name.asc`,
        ),
        supabaseFetch<Batch[]>(
          `/rest/v1/pharmacy_inventory_batches?select=id,item_id,batch_number,expiry_date,quantity_on_hand,unit_cost,selling_price&branch_id=eq.${active}&quantity_on_hand=gt.0&order=expiry_date.asc.nullslast`,
        ),
        supabaseFetch<Sale[]>(
          `/rest/v1/pharmacy_sales?select=id,sale_date,customer_name,total_amount,gross_profit,payment_method,created_at&branch_id=eq.${active}&order=created_at.desc&limit=20`,
        ),
      ]);
      setItems(itemRows);
      setBatches(batchRows);
      setSales(saleRows);
      const firstItem = itemRows[0]?.id || "";
      setItemId((current) => current || firstItem);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t("Could not load sales workspace.", "تعذّر تحميل مساحة المبيعات."),
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [isAuthenticated, userId, branchId]);

  const itemBatches = useMemo(
    () => batches.filter((b) => b.item_id === itemId),
    [batches, itemId],
  );

  useEffect(() => {
    const first = itemBatches[0];
    setBatchId(first?.id || "");
    if (first && !price) setPrice(String(first.selling_price ?? ""));
  }, [itemId, itemBatches.length]);

  const selectedBatch = itemBatches.find((b) => b.id === batchId);
  const totals = useMemo(() => {
    const quantity = Number(qty) || 0;
    const unitPrice = Number(price) || 0;
    const unitCost = Number(selectedBatch?.unit_cost ?? 0);
    return {
      total: quantity * unitPrice,
      cost: quantity * unitCost,
      profit: quantity * (unitPrice - unitCost),
    };
  }, [qty, price, selectedBatch]);

  const today = new Date().toISOString().slice(0, 10);
  const todaySummary = useMemo(
    () =>
      sales
        .filter((s) => s.sale_date === today)
        .reduce(
          (acc, s) => {
            acc.count += 1;
            acc.total += Number(s.total_amount);
            acc.profit += Number(s.gross_profit);
            return acc;
          },
          { count: 0, total: 0, profit: 0 },
        ),
    [sales, today],
  );

  async function createSale() {
    if (!branchId || !itemId || !selectedBatch || !qty || !price) return;
    const quantity = Number(qty);
    if (quantity <= 0) return;
    if (quantity > Number(selectedBatch.quantity_on_hand)) {
      setError(
        t(
          "Quantity is higher than available batch stock.",
          "الكمية أعلى من المخزون المتاح في التشغيلة.",
        ),
      );
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const salesRes = await supabaseFetch<{ id: string }[]>(
        "/rest/v1/pharmacy_sales?select=id",
        {
          method: "POST",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({
            branch_id: branchId,
            customer_name: customer || null,
            payment_method: payment,
            subtotal: totals.total,
            total_amount: totals.total,
            cost_amount: totals.cost,
            gross_profit: totals.profit,
            created_by: userId,
          }),
        },
      );
      const saleId = salesRes[0].id;
      await supabaseFetch("/rest/v1/pharmacy_sale_lines", {
        method: "POST",
        body: JSON.stringify({
          sale_id: saleId,
          branch_id: branchId,
          item_id: itemId,
          batch_id: selectedBatch.id,
          quantity,
          unit_price: Number(price),
          unit_cost: Number(selectedBatch.unit_cost) || 0,
        }),
      });
      await supabaseFetch(
        `/rest/v1/pharmacy_inventory_batches?id=eq.${selectedBatch.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            quantity_on_hand: Number(selectedBatch.quantity_on_hand) - quantity,
          }),
        },
      );
      await supabaseFetch("/rest/v1/pharmacy_inventory_movements", {
        method: "POST",
        body: JSON.stringify({
          branch_id: branchId,
          item_id: itemId,
          batch_id: selectedBatch.id,
          movement_type: "sale",
          quantity: -quantity,
          unit_cost: Number(selectedBatch.unit_cost) || 0,
          reference_type: "sale",
          reference_id: saleId,
          note: t("Pharmacy sale", "بيع صيدلية"),
          created_by: userId,
        }),
      });
      await supabaseFetch("/rest/v1/pharmacy_finance_entries", {
        method: "POST",
        body: JSON.stringify({
          branch_id: branchId,
          entry_type: "sale",
          category: t("Pharmacy sale", "بيع صيدلية"),
          amount: totals.total,
          entry_date: new Date().toISOString().slice(0, 10),
          payment_method: payment,
          created_by: userId,
        }),
      });
      setQty("1");
      setCustomer("");
      setMessage(
        t(
          "Sale completed. Stock and finance revenue updated.",
          "اكتملت عملية البيع. تم تحديث المخزون وإيراد المالية.",
        ),
      );
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t("Could not complete sale.", "تعذّر إتمام البيع."),
      );
    } finally {
      setSaving(false);
    }
  }

  const activeBranch = branches.find((branch) => branch.id === branchId);

  function exportSales() {
    const generatedAt = new Date().toISOString();
    downloadCsv(
      `pharmacy-sales-${activeBranch?.branch_name ?? "branch"}.csv`,
      [
        { key: "branch", header: "Branch" },
        { key: "city", header: "City" },
        { key: "generated_at", header: "Generated at" },
        { key: "created_at", header: "System created at" },
        { key: "sale_date", header: "Sale date" },
        { key: "customer_name", header: "Customer" },
        { key: "payment_method", header: "Payment method" },
        { key: "total_amount", header: "Total amount" },
        { key: "gross_profit", header: "Gross profit" },
      ],
      sales.map((s) => ({
        branch: activeBranch?.branch_name ?? "",
        city: activeBranch?.city ?? "",
        generated_at: generatedAt,
        created_at: s.created_at,
        sale_date: s.sale_date,
        customer_name: s.customer_name ?? "Walk-in",
        payment_method: s.payment_method,
        total_amount: Number(s.total_amount),
        gross_profit: Number(s.gross_profit),
      })),
    );
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("Pharmacy sales", "مبيعات الصيدلية")}
          </div>
          <h1 className="mt-2 flex items-center gap-2 text-3xl font-bold">
            <Receipt className="h-7 w-7" />
            {t("Sell from stock", "البيع من المخزون")}
          </h1>
          <p className="text-muted-foreground">
            {t(
              "Create a sale, deduct stock from a batch, and send revenue to finance reporting.",
              "أنشئ عملية بيع، واخصم المخزون من تشغيلة، وأرسل الإيراد لتقارير المالية.",
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportSales} disabled={!sales.length}>
            <Download className="mr-2 h-4 w-4" />
            {t("Export CSV", "تصدير CSV")}
          </Button>
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {t("Refresh", "تحديث")}
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {message && (
        <Alert className="mb-4">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{t("Branch", "الفرع")}</CardTitle>
        </CardHeader>
        <CardContent>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.branch_name}
                {b.city ? ` - ${b.city}` : ""}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Metric label={t("Today sales", "مبيعات اليوم")} value={todaySummary.total} />
        <Metric
          label={t("Today gross profit", "مجمل ربح اليوم")}
          value={todaySummary.profit}
        />
        <Metric label={t("Today tickets", "فواتير اليوم")} value={todaySummary.count} />
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{t("New sale", "بيع جديد")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <Label>{t("Item", "الصنف")}</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={itemId}
              onChange={(e) => {
                setItemId(e.target.value);
                setPrice("");
              }}
            >
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.item_name}
                  {i.barcode ? ` - ${i.barcode}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>{t("Batch", "التشغيلة")}</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={batchId}
              onChange={(e) => {
                setBatchId(e.target.value);
                const b = itemBatches.find((x) => x.id === e.target.value);
                if (b) setPrice(String(b.selling_price ?? ""));
              }}
            >
              {itemBatches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.batch_number || t("No batch", "بدون تشغيلة")} ·{" "}
                  {Number(b.quantity_on_hand).toLocaleString()}{" "}
                  {t("left", "متبقي")} ·{" "}
                  {b.expiry_date || t("no expiry", "بدون انتهاء")}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>{t("Customer", "العميل")}</Label>
            <Input
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              placeholder={t("Walk-in or customer name", "زائر أو اسم العميل")}
            />
          </div>
          <div>
            <Label>{t("Qty", "الكمية")}</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
          </div>
          <div>
            <Label>{t("Unit price", "سعر الوحدة")}</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
          <div>
            <Label>{t("Payment", "الدفع")}</Label>
            <Input
              value={payment}
              onChange={(e) => setPayment(e.target.value)}
              placeholder={t("cash", "نقدي")}
            />
          </div>
          <div className="flex items-end text-sm font-semibold">
            {t("Total", "الإجمالي")}: {totals.total.toLocaleString()} ·{" "}
            {t("Profit", "الربح")}: {totals.profit.toLocaleString()}
          </div>
          <div className="sm:col-span-4">
            <Button
              onClick={() => void createSale()}
              disabled={
                saving || !branchId || !itemId || !selectedBatch || !qty || !price
              }
            >
              {t("Complete sale", "إتمام البيع")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("Latest sales", "أحدث المبيعات")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {sales.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between rounded-lg border p-3 text-sm"
            >
              <div>
                <div className="font-medium">
                  {s.customer_name || t("Walk-in", "زائر")} · {s.sale_date} ·{" "}
                  {s.payment_method}
                </div>
                <div className="text-xs text-muted-foreground">
                  {t("Gross profit", "مجمل الربح")}{" "}
                  {Number(s.gross_profit).toLocaleString()} · {t("Created", "أُنشئ")}{" "}
                  {new Date(s.created_at).toLocaleString()}
                </div>
              </div>
              <strong>{Number(s.total_amount).toLocaleString()}</strong>
            </div>
          ))}
          {!sales.length && (
            <p className="text-sm text-muted-foreground">
              {t("No sales yet.", "لا توجد مبيعات بعد.")}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-bold">{value.toLocaleString()}</div>
      </CardContent>
    </Card>
  );
}
