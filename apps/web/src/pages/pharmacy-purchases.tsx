import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Download, FilePlus2, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { downloadCsv } from "@/lib/csv-export";
import { usePatientAuth } from "@/lib/patient-auth";
import { useLanguage } from "@/lib/i18n";

type Branch = { id: string; branch_name: string; city: string | null };
type Supplier = { id: string; supplier_name: string };
type Item = { id: string; item_name: string; barcode: string | null };
type Invoice = {
  id: string;
  invoice_number: string | null;
  invoice_date: string;
  total_amount: string | number;
  payment_status: string;
  created_at: string;
};
type SupplierBalance = {
  supplier_id: string;
  supplier_name: string;
  opening_balance: string | number;
  purchases_total: string | number;
  paid_total: string | number;
  balance_due: string | number;
};

const PAY_AR: Record<string, string> = {
  unpaid: "غير مدفوع",
  partial: "جزئي",
  paid: "مدفوع",
};

export default function PharmacyPurchases() {
  const { t } = useLanguage();
  const { isAuthenticated, session, supabaseFetch } = usePatientAuth();
  const userId = session?.user?.id;
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [supplierBalances, setSupplierBalances] = useState<SupplierBalance[]>([]);
  const [supplierName, setSupplierName] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [paidAmount, setPaidAmount] = useState("");
  const [itemId, setItemId] = useState("");
  const [qty, setQty] = useState("");
  const [cost, setCost] = useState("");
  const [price, setPrice] = useState("");
  const [batch, setBatch] = useState("");
  const [expiry, setExpiry] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const payLabel = (s: string) => t(s, PAY_AR[s] || s);

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
      if (!active) {
        setSupplierBalances([]);
        return;
      }
      const [supplierRows, itemRows, invoiceRows, balanceRows] = await Promise.all([
        supabaseFetch<Supplier[]>(
          `/rest/v1/pharmacy_suppliers?select=id,supplier_name&branch_id=eq.${active}&is_active=eq.true&order=supplier_name.asc`,
        ),
        supabaseFetch<Item[]>(
          `/rest/v1/pharmacy_inventory_items?select=id,item_name,barcode&branch_id=eq.${active}&is_active=eq.true&order=item_name.asc`,
        ),
        supabaseFetch<Invoice[]>(
          `/rest/v1/pharmacy_purchase_invoices?select=id,invoice_number,invoice_date,total_amount,payment_status,created_at&branch_id=eq.${active}&order=invoice_date.desc,created_at.desc&limit=20`,
        ),
        supabaseFetch<SupplierBalance[]>(
          `/rest/v1/pharmacy_supplier_balance_summary?select=supplier_id,supplier_name,opening_balance,purchases_total,paid_total,balance_due&branch_id=eq.${active}&order=supplier_name.asc`,
        ),
      ]);
      setSuppliers(supplierRows);
      setItems(itemRows);
      setInvoices(invoiceRows);
      setSupplierBalances(balanceRows);
      setSupplierId(supplierRows[0]?.id || "");
      setItemId(itemRows[0]?.id || "");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t("Could not load purchase workspace.", "تعذّر تحميل مساحة المشتريات."),
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [isAuthenticated, userId, branchId]);

  async function addSupplier() {
    if (!branchId || !supplierName.trim()) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const created = await supabaseFetch<Supplier[]>(
        "/rest/v1/pharmacy_suppliers?select=id,supplier_name",
        {
          method: "POST",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({
            branch_id: branchId,
            supplier_name: supplierName.trim(),
          }),
        },
      );
      setSupplierName("");
      setSupplierId(created[0].id);
      setMessage(t("Supplier added.", "تمت إضافة المورد."));
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t("Could not add supplier.", "تعذّر إضافة المورد."),
      );
    } finally {
      setSaving(false);
    }
  }

  async function createInvoice() {
    if (!branchId || !itemId || !qty || !cost) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const quantity = Number(qty);
      const unitCost = Number(cost) || 0;
      const total = quantity * unitCost;
      const paid = Number(paidAmount) || 0;
      const status = paid <= 0 ? "unpaid" : paid >= total ? "paid" : "partial";
      const invs = await supabaseFetch<{ id: string }[]>(
        "/rest/v1/pharmacy_purchase_invoices?select=id",
        {
          method: "POST",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({
            branch_id: branchId,
            supplier_id: supplierId || null,
            invoice_number: invoiceNumber || null,
            invoice_date: invoiceDate,
            total_amount: total,
            subtotal: total,
            paid_amount: paid,
            payment_status: status,
            created_by: userId,
          }),
        },
      );
      const invoiceId = invs[0].id;
      const batches = await supabaseFetch<{ id: string }[]>(
        "/rest/v1/pharmacy_inventory_batches?select=id",
        {
          method: "POST",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({
            branch_id: branchId,
            item_id: itemId,
            batch_number: batch || null,
            expiry_date: expiry || null,
            quantity_on_hand: quantity,
            unit_cost: unitCost,
            selling_price: Number(price) || 0,
          }),
        },
      );
      const batchId = batches[0].id;
      await supabaseFetch("/rest/v1/pharmacy_purchase_invoice_lines", {
        method: "POST",
        body: JSON.stringify({
          invoice_id: invoiceId,
          branch_id: branchId,
          item_id: itemId,
          batch_id: batchId,
          quantity,
          unit_cost: unitCost,
          selling_price: Number(price) || 0,
          batch_number: batch || null,
          expiry_date: expiry || null,
        }),
      });
      await supabaseFetch("/rest/v1/pharmacy_inventory_movements", {
        method: "POST",
        body: JSON.stringify({
          branch_id: branchId,
          item_id: itemId,
          batch_id: batchId,
          movement_type: "purchase",
          quantity,
          unit_cost: unitCost,
          reference_type: "purchase_invoice",
          reference_id: invoiceId,
          note: invoiceNumber
            ? t(`Purchase invoice ${invoiceNumber}`, `فاتورة شراء ${invoiceNumber}`)
            : t("Purchase invoice", "فاتورة شراء"),
          created_by: userId,
        }),
      });
      setInvoiceNumber("");
      setPaidAmount("");
      setQty("");
      setCost("");
      setPrice("");
      setBatch("");
      setExpiry("");
      setMessage(
        t(
          "Purchase invoice created and stock batch added.",
          "تم إنشاء فاتورة الشراء وإضافة تشغيلة المخزون.",
        ),
      );
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t("Could not create purchase invoice.", "تعذّر إنشاء فاتورة الشراء."),
      );
    } finally {
      setSaving(false);
    }
  }

  const previewTotal = useMemo(
    () => (Number(qty) || 0) * (Number(cost) || 0),
    [qty, cost],
  );
  const activeBranch = branches.find((branch) => branch.id === branchId);

  function exportInvoices() {
    const generatedAt = new Date().toISOString();
    downloadCsv(
      `pharmacy-purchases-${activeBranch?.branch_name ?? "branch"}.csv`,
      [
        { key: "branch", header: "Branch" },
        { key: "city", header: "City" },
        { key: "generated_at", header: "Generated at" },
        { key: "created_at", header: "System created at" },
        { key: "invoice_number", header: "Invoice number" },
        { key: "invoice_date", header: "Invoice date" },
        { key: "payment_status", header: "Payment status" },
        { key: "total_amount", header: "Total amount" },
      ],
      invoices.map((i) => ({
        branch: activeBranch?.branch_name ?? "",
        city: activeBranch?.city ?? "",
        generated_at: generatedAt,
        created_at: i.created_at,
        invoice_number: i.invoice_number ?? "",
        invoice_date: i.invoice_date,
        payment_status: i.payment_status,
        total_amount: Number(i.total_amount),
      })),
    );
  }

  function exportSupplierBalances() {
    const generatedAt = new Date().toISOString();
    downloadCsv(
      `pharmacy-supplier-balances-${activeBranch?.branch_name ?? "branch"}.csv`,
      [
        { key: "branch", header: "Branch" },
        { key: "city", header: "City" },
        { key: "generated_at", header: "Generated at" },
        { key: "supplier_name", header: "Supplier" },
        { key: "opening_balance", header: "Opening balance" },
        { key: "purchases_total", header: "Purchases total" },
        { key: "paid_total", header: "Paid total" },
        { key: "balance_due", header: "Balance due" },
      ],
      supplierBalances.map((s) => ({
        branch: activeBranch?.branch_name ?? "",
        city: activeBranch?.city ?? "",
        generated_at: generatedAt,
        supplier_name: s.supplier_name,
        opening_balance: Number(s.opening_balance),
        purchases_total: Number(s.purchases_total),
        paid_total: Number(s.paid_total),
        balance_due: Number(s.balance_due),
      })),
    );
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("Pharmacy purchases", "مشتريات الصيدلية")}
          </div>
          <h1 className="mt-2 flex items-center gap-2 text-3xl font-bold">
            <FilePlus2 className="h-7 w-7" />
            {t("Supplier purchase invoices", "فواتير شراء الموردين")}
          </h1>
          <p className="text-muted-foreground">
            {t(
              "Record supplier purchases, create stock batches and keep an audit movement for every invoice.",
              "سجّل مشتريات الموردين، وأنشئ تشغيلات المخزون، واحتفظ بحركة تدقيق لكل فاتورة.",
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={exportSupplierBalances}
            disabled={!supplierBalances.length}
          >
            <Download className="mr-2 h-4 w-4" />
            {t("Export balances", "تصدير الأرصدة")}
          </Button>
          <Button variant="outline" onClick={exportInvoices} disabled={!invoices.length}>
            <Download className="mr-2 h-4 w-4" />
            {t("Export invoices", "تصدير الفواتير")}
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

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{t("Supplier balances", "أرصدة الموردين")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {supplierBalances.map((s) => (
            <div
              key={s.supplier_id}
              className="flex items-center justify-between rounded-lg border p-3 text-sm"
            >
              <div>
                <div className="font-medium">{s.supplier_name}</div>
                <div className="text-xs text-muted-foreground">
                  {t("Purchased", "مشتريات")} {Number(s.purchases_total).toLocaleString()} ·{" "}
                  {t("Paid", "مدفوع")} {Number(s.paid_total).toLocaleString()}
                </div>
              </div>
              <strong>{Number(s.balance_due).toLocaleString()}</strong>
            </div>
          ))}
          {!supplierBalances.length && (
            <p className="text-sm text-muted-foreground">
              {t("No supplier balances yet.", "لا توجد أرصدة موردين بعد.")}
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{t("Add supplier", "إضافة مورد")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <Input
            value={supplierName}
            onChange={(e) => setSupplierName(e.target.value)}
            placeholder={t("Supplier name", "اسم المورد")}
          />
          <Button
            onClick={() => void addSupplier()}
            disabled={saving || !branchId || !supplierName.trim()}
          >
            {t("Add supplier", "إضافة مورد")}
          </Button>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{t("Create purchase invoice", "إنشاء فاتورة شراء")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-4">
          <div>
            <Label>{t("Supplier", "المورد")}</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
            >
              <option value="">{t("No supplier", "بدون مورد")}</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.supplier_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>{t("Invoice no.", "رقم الفاتورة")}</Label>
            <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
          </div>
          <div>
            <Label>{t("Date", "التاريخ")}</Label>
            <Input
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
            />
          </div>
          <div>
            <Label>{t("Paid", "المدفوع")}</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={paidAmount}
              onChange={(e) => setPaidAmount(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>{t("Item", "الصنف")}</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={itemId}
              onChange={(e) => setItemId(e.target.value)}
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
            <Input value={batch} onChange={(e) => setBatch(e.target.value)} />
          </div>
          <div>
            <Label>{t("Expiry", "الانتهاء")}</Label>
            <Input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
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
            <Label>{t("Unit cost", "تكلفة الوحدة")}</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
            />
          </div>
          <div>
            <Label>{t("Selling price", "سعر البيع")}</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
          <div className="flex items-end text-sm font-semibold">
            {t("Total", "الإجمالي")}: {previewTotal.toLocaleString()}
          </div>
          <div className="sm:col-span-4">
            <Button
              onClick={() => void createInvoice()}
              disabled={saving || !branchId || !itemId || !qty || !cost}
            >
              {t("Create invoice and add stock", "إنشاء الفاتورة وإضافة المخزون")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("Latest purchase invoices", "أحدث فواتير الشراء")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {invoices.map((i) => (
            <div
              key={i.id}
              className="flex items-center justify-between rounded-lg border p-3 text-sm"
            >
              <div>
                <div className="font-medium">
                  {i.invoice_number || t("No invoice number", "بدون رقم فاتورة")}
                </div>
                <div className="text-xs text-muted-foreground">
                  {i.invoice_date} · {payLabel(i.payment_status)}
                </div>
              </div>
              <strong>{Number(i.total_amount).toLocaleString()}</strong>
            </div>
          ))}
          {!invoices.length && (
            <p className="text-sm text-muted-foreground">
              {t("No purchase invoices yet.", "لا توجد فواتير شراء بعد.")}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
