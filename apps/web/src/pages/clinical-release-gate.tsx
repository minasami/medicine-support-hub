import { AlertTriangle, BookOpen, LockKeyhole, ShieldCheck } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/lib/i18n";

export default function ClinicalReleaseGate() {
  const { t } = useLanguage();

  return (
    <main className="container mx-auto max-w-4xl px-4 py-10">
      <section className="rounded-3xl border bg-card p-6 shadow-sm md:p-10">
        <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-primary">
          <LockKeyhole className="h-4 w-4" />
          {t("Controlled clinical release gate", "بوابة إطلاق سريري منضبطة")}
        </p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight">
          {t(
            "The longitudinal clinical workspace is not enabled in this environment",
            "مساحة السجل السريري الطولي غير مفعّلة في هذه البيئة",
          )}
        </h1>
        <p className="mt-5 text-lg leading-8 text-muted-foreground">
          {t(
            "The patient, encounter, prescription, diagnostic, and insurance architecture is under controlled security and clinical-governance review. Production access remains closed until identity, consent, tenant isolation, audit, recovery, interoperability, and regulatory gates are approved.",
            "تخضع بنية المريض والزيارة والوصفة والفحوص والتأمين لمراجعة أمنية وحوكمة سريرية منضبطة. يظل الوصول الإنتاجي مغلقًا حتى اعتماد بوابات الهوية والموافقة وعزل المؤسسات والتدقيق والتعافي والتوافق والمتطلبات التنظيمية.",
          )}
        </p>

        <Alert className="mt-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {t(
              "Medicine Support Hub must not be presented as a certified or flawless EMR/EHR at this stage.",
              "لا يجوز تقديم منصة دعم الدواء في هذه المرحلة كنظام سجلات طبية إلكترونية معتمد أو خالٍ من العيوب.",
            )}
          </AlertDescription>
        </Alert>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <Card>
            <CardContent className="p-5">
              <ShieldCheck className="h-6 w-6 text-primary" />
              <h2 className="mt-3 font-semibold">{t("Why access is closed", "لماذا الوصول مغلق")}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {t(
                  "Clinical records require stronger controls than public medicine knowledge or ordinary operational workflows. A passing interface build is not sufficient evidence of safe clinical release.",
                  "تتطلب السجلات السريرية ضوابط أقوى من معرفة الأدوية العامة أو المسارات التشغيلية العادية. نجاح بناء الواجهة ليس دليلًا كافيًا على جاهزية الإطلاق السريري الآمن.",
                )}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <BookOpen className="h-6 w-6 text-primary" />
              <h2 className="mt-3 font-semibold">{t("What is available now", "المتاح حاليًا")}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {t(
                  "The public learning center explains the intended patient, physician, pharmacy, diagnostic, payer, institutional, and governance workflows.",
                  "يشرح مركز التعلم العام مسارات المرضى والأطباء والصيدليات ومقدمي الفحوص وجهات التأمين والمؤسسات والحوكمة المستهدفة.",
                )}
              </p>
              <Button asChild className="mt-4">
                <a href="/learn">{t("Open learning center", "فتح مركز التعلم")}</a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
