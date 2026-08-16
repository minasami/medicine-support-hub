import { CheckCircle2, GraduationCap, PlayCircle, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/lib/i18n";
import { useMemo } from "react";

export default function PharmacyTraining() {
  const { t } = useLanguage();

  const lessons = useMemo(
    () => [
      {
        title: t("1. Choose the right branch", "١. اختر الفرع الصحيح"),
        goal: t(
          "Confirm you are entering data for the correct pharmacy branch before doing any accounting work.",
          "تأكد أنك تُدخل البيانات للفرع الصحيح قبل أي عمل محاسبي.",
        ),
        steps: [
          t(
            "Open Pharmacy Finance, Inventory, or Purchases.",
            "افتح مالية الصيدلية أو المخزون أو المشتريات.",
          ),
          t(
            "Check the branch selector at the top of the page.",
            "تحقق من محدد الفرع أعلى الصفحة.",
          ),
          t(
            "Never enter invoices or expenses under the wrong branch.",
            "لا تُدخل فواتير أو مصروفات تحت فرع خاطئ.",
          ),
        ],
      },
      {
        title: t("2. Add suppliers", "٢. أضف الموردين"),
        goal: t(
          "Create supplier records before entering purchase invoices.",
          "أنشئ سجلات الموردين قبل إدخال فواتير الشراء.",
        ),
        steps: [
          t("Open /pharmacy/purchases.", "افتح /pharmacy/purchases."),
          t(
            "Type the supplier name exactly as it appears on invoices.",
            "اكتب اسم المورد كما يظهر على الفواتير.",
          ),
          t(
            "Use the same supplier record every time to keep balances accurate.",
            "استخدم نفس سجل المورد دائمًا للحفاظ على دقة الأرصدة.",
          ),
        ],
      },
      {
        title: t("3. Add medicines to inventory", "٣. أضف الأدوية للمخزون"),
        goal: t(
          "Use the Egyptian medicines catalog as the master source of medicine names.",
          "استخدم كتالوج الأدوية المصرية كمصدر رئيسي لأسماء الأدوية.",
        ),
        steps: [
          t("Open /pharmacy/inventory.", "افتح /pharmacy/inventory."),
          t(
            "Search by English name, Arabic name, or barcode.",
            "ابحث بالاسم الإنجليزي أو العربي أو الباركود.",
          ),
          t(
            "Select the matching catalog medicine.",
            "اختر الدواء المطابق من الكتالوج.",
          ),
          t(
            "Enter batch number, expiry date, quantity, cost, selling price, and reorder level.",
            "أدخل رقم التشغيلة وتاريخ الانتهاء والكمية والتكلفة وسعر البيع ومستوى إعادة الطلب.",
          ),
        ],
      },
      {
        title: t("4. Enter supplier purchase invoices", "٤. أدخل فواتير شراء الموردين"),
        goal: t(
          "Record stock received from suppliers and create batch-level inventory.",
          "سجّل المخزون المستلم من الموردين وأنشئ مخزونًا على مستوى التشغيلة.",
        ),
        steps: [
          t("Open /pharmacy/purchases.", "افتح /pharmacy/purchases."),
          t(
            "Choose supplier, invoice number, invoice date, and paid amount.",
            "اختر المورد ورقم الفاتورة وتاريخها والمبلغ المدفوع.",
          ),
          t("Select the inventory item.", "اختر صنف المخزون."),
          t(
            "Enter quantity, unit cost, selling price, batch number, and expiry.",
            "أدخل الكمية وتكلفة الوحدة وسعر البيع ورقم التشغيلة والانتهاء.",
          ),
          t(
            "Save the invoice. The system creates a stock batch and audit movement.",
            "احفظ الفاتورة. ينشئ النظام تشغيلة مخزون وحركة تدقيق.",
          ),
        ],
      },
      {
        title: t("5. Record sales and expenses", "٥. سجّل المبيعات والمصروفات"),
        goal: t(
          "Keep daily profit reports accurate.",
          "حافظ على دقة تقارير الربح اليومية.",
        ),
        steps: [
          t("Open /pharmacy/finance.", "افتح /pharmacy/finance."),
          t("Record sales as sale entries.", "سجّل المبيعات كقيود بيع."),
          t(
            "Record rent, salaries, utilities, delivery, and other costs as expense entries.",
            "سجّل الإيجار والرواتب والمرافق والتوصيل وغيرها كمصروفات.",
          ),
          t(
            "Use clear categories so reports remain useful.",
            "استخدم فئات واضحة لتبقى التقارير مفيدة.",
          ),
        ],
      },
      {
        title: t("6. Review reports before closing", "٦. راجع التقارير قبل الإغلاق"),
        goal: t(
          "Catch mistakes before the day ends.",
          "اكتشف الأخطاء قبل نهاية اليوم.",
        ),
        steps: [
          t(
            "Review sales, expenses, and profit for the selected period.",
            "راجع المبيعات والمصروفات والربح للفترة المحددة.",
          ),
          t("Check latest purchase invoices.", "تحقق من أحدث فواتير الشراء."),
          t(
            "Check low-stock and near-expiry alerts.",
            "تحقق من تنبيهات نفاد المخزون وقرب الانتهاء.",
          ),
          t(
            "Report unusual balances to the branch owner.",
            "أبلغ مالك الفرع عن الأرصدة غير المعتادة.",
          ),
        ],
      },
    ],
    [t],
  );

  const checklist = useMemo(
    () => [
      t("Confirm branch before entry", "تأكيد الفرع قبل الإدخال"),
      t("Enter supplier invoices immediately", "إدخال فواتير المورد فورًا"),
      t("Use catalog medicine search first", "البحث في الكتالوج أولًا"),
      t("Check batch number and expiry date", "التحقق من التشغيلة والانتهاء"),
      t("Record paid amount accurately", "تسجيل المبلغ المدفوع بدقة"),
      t("Record daily expenses by category", "تسجيل المصروفات اليومية حسب الفئة"),
      t(
        "Review low-stock and near-expiry alerts",
        "مراجعة تنبيهات نفاد المخزون وقرب الانتهاء",
      ),
      t(
        "Close the day after checking sales, expenses, and profit",
        "إغلاق اليوم بعد مراجعة المبيعات والمصروفات والربح",
      ),
    ],
    [t],
  );

  const voiceover = useMemo(
    () => [
      t(
        "Welcome to the pharmacy accountant training. Your job is to keep stock, supplier invoices, sales, expenses, and profit accurate every day.",
        "مرحبًا بك في تدريب محاسب الصيدلية. مهمتك الحفاظ على دقة المخزون وفواتير الموردين والمبيعات والمصروفات والربح يوميًا.",
      ),
      t(
        "Start by confirming the correct branch. A wrong branch selection means the reports will be wrong, even if the invoice data is correct.",
        "ابدأ بتأكيد الفرع الصحيح. اختيار فرع خاطئ يعني تقارير خاطئة حتى لو كانت بيانات الفاتورة صحيحة.",
      ),
      t(
        "When adding stock, always search the Egyptian medicines catalog first. This keeps medicine names consistent across branches and reports.",
        "عند إضافة المخزون، ابحث أولًا في كتالوج الأدوية المصرية. هذا يحافظ على اتساق أسماء الأدوية عبر الفروع والتقارير.",
      ),
      t(
        "For each purchase invoice, enter the supplier, invoice date, paid amount, quantity, unit cost, selling price, batch number, and expiry date.",
        "لكل فاتورة شراء، أدخل المورد وتاريخ الفاتورة والمبلغ المدفوع والكمية وتكلفة الوحدة وسعر البيع ورقم التشغيلة وتاريخ الانتهاء.",
      ),
      t(
        "The system then creates a stock batch and an audit movement, so the owner can trace where every stock increase came from.",
        "ثم ينشئ النظام تشغيلة مخزون وحركة تدقيق ليتمكن المالك من تتبع مصدر كل زيادة في المخزون.",
      ),
      t(
        "At the end of the day, review sales, expenses, profit, low-stock alerts, and near-expiry medicines before closing.",
        "في نهاية اليوم، راجع المبيعات والمصروفات والربح وتنبيهات نفاد المخزون والأدوية قاربة الانتهاء قبل الإغلاق.",
      ),
    ],
    [t],
  );

  const mistakes = useMemo(
    () => [
      t(
        "Entering a purchase invoice under the wrong branch.",
        "إدخال فاتورة شراء تحت فرع خاطئ.",
      ),
      t(
        "Typing medicine names manually when the catalog has the medicine.",
        "كتابة أسماء الأدوية يدويًا رغم وجودها في الكتالوج.",
      ),
      t("Skipping batch number or expiry date.", "تجاهل رقم التشغيلة أو تاريخ الانتهاء."),
      t(
        "Recording sales but forgetting related expenses.",
        "تسجيل المبيعات ونسيان المصروفات المرتبطة.",
      ),
      t(
        "Closing the day without reviewing profit and alerts.",
        "إغلاق اليوم دون مراجعة الربح والتنبيهات.",
      ),
    ],
    [t],
  );

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("Pharmacy learning center", "مركز تعلم الصيدلية")}
        </div>
        <h1 className="mt-2 flex items-center gap-2 text-3xl font-bold">
          <GraduationCap className="h-7 w-7" />
          {t("Accountant training", "تدريب المحاسب")}
        </h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          {t(
            "A role-specific onboarding guide for pharmacy accountants using the branch finance, inventory, supplier, and purchase invoice workflows.",
            "دليل تأهيل مخصص لمحاسبي الصيدليات لاستخدام مالية الفرع والمخزون والموردين وفواتير الشراء.",
          )}
        </p>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <PlayCircle className="mb-2 h-6 w-6" />
            <div className="font-semibold">{t("Video-ready", "جاهز للفيديو")}</div>
            <p className="text-sm text-muted-foreground">
              {t(
                "Scene-by-scene content for a short accountant training video.",
                "محتوى مشهدًا بمشهد لفيديو تدريبي قصير للمحاسب.",
              )}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <ShieldCheck className="mb-2 h-6 w-6" />
            <div className="font-semibold">
              {t("Operationally safe", "آمن تشغيليًا")}
            </div>
            <p className="text-sm text-muted-foreground">
              {t(
                "Focuses on correct branch, invoice, batch, expiry, and daily closing habits.",
                "يركز على الفرع الصحيح والفاتورة والتشغيلة والانتهاء وعادات الإغلاق اليومي.",
              )}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <CheckCircle2 className="mb-2 h-6 w-6" />
            <div className="font-semibold">{t("Daily checklist", "قائمة يومية")}</div>
            <p className="text-sm text-muted-foreground">
              {t(
                "Simple closing routine to reduce accounting and stock mistakes.",
                "روتين إغلاق بسيط لتقليل أخطاء المحاسبة والمخزون.",
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          {lessons.map((lesson) => (
            <Card key={lesson.title}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <CardTitle>{lesson.title}</CardTitle>
                  <Badge variant="outline">{t("Lesson", "درس")}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{lesson.goal}</p>
              </CardHeader>
              <CardContent>
                <ol className="list-decimal space-y-2 pl-5 text-sm">
                  {lesson.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          ))}
          <Card>
            <CardHeader>
              <CardTitle>{t("Voiceover script", "نص التعليق الصوتي")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              {voiceover.map((line, index) => (
                <p key={line}>
                  <strong className="text-foreground">
                    {t("Scene", "مشهد")} {index + 1}:
                  </strong>{" "}
                  {line}
                </p>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>
                {t("Daily accountant checklist", "قائمة المحاسب اليومية")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {checklist.map((item) => (
                  <li key={item} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>
                {t("Common mistakes to avoid", "أخطاء شائعة يجب تجنبها")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                {mistakes.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
