import { useLocation } from "wouter";
import { useLanguage } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  ClipboardList,
  Clock,
  ShieldCheck,
  Truck,
  FlaskConical,
  Stethoscope,
  Star,
  Phone,
  MapPin,
  ChevronRight,
} from "lucide-react";

const FEATURES = [
  {
    icon: ClipboardList,
    en: "Easy Online Requests",
    ar: "طلبات إلكترونية سهلة",
    descEn: "Submit your chronic medicine requests from anywhere, anytime — in Arabic or English.",
    descAr: "قدّم طلبات أدوية الأمراض المزمنة من أي مكان وفي أي وقت — بالعربية أو الإنجليزية.",
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  {
    icon: Stethoscope,
    en: "Clinical Review",
    ar: "مراجعة سريرية",
    descEn: "Every request reviewed by certified clinical professionals before dispensing.",
    descAr: "كل طلب تتم مراجعته من قبل متخصصين سريريين معتمدين قبل الصرف.",
    color: "text-violet-600",
    bg: "bg-violet-50",
  },
  {
    icon: FlaskConical,
    en: "Pharmacy Precision",
    ar: "دقة صيدلانية",
    descEn: "Licensed pharmacists verify and dispense every medication with batch-level traceability.",
    descAr: "يتحقق الصيادلة المرخصون من كل دواء ويصرفونه مع تتبع على مستوى الدُّفعة.",
    color: "text-amber-600",
    bg: "bg-amber-50",
  },
  {
    icon: Truck,
    en: "Home Delivery",
    ar: "توصيل منزلي",
    descEn: "Safe, trackable delivery of your medications directly to your location.",
    descAr: "توصيل آمن وقابل للتتبع لأدويتك مباشرة إلى موقعك.",
    color: "text-sky-600",
    bg: "bg-sky-50",
  },
  {
    icon: ShieldCheck,
    en: "Fully Compliant",
    ar: "متوافق تماماً",
    descEn: "Meets all regulatory standards for clinical medication dispensing and records.",
    descAr: "يستوفي جميع المعايير التنظيمية لصرف الأدوية والسجلات السريرية.",
    color: "text-emerald-600",
    bg: "bg-emerald-50",
  },
  {
    icon: Clock,
    en: "Real-Time Tracking",
    ar: "تتبع فوري",
    descEn: "Know exactly where your request is at every stage of the clinical workflow.",
    descAr: "اعرف أين يقع طلبك في كل مرحلة من مراحل سير العمل السريري.",
    color: "text-rose-600",
    bg: "bg-rose-50",
  },
];

const STEPS = [
  { num: "01", en: "Submit Request", ar: "تقديم الطلب", descEn: "Fill in your details and the medicines you need online.", descAr: "أدخل بياناتك والأدوية التي تحتاجها عبر الإنترنت." },
  { num: "02", en: "Clinical Review", ar: "المراجعة السريرية", descEn: "A licensed physician or reviewer approves your prescription.", descAr: "يوافق طبيب مرخص أو مراجع على وصفتك الطبية." },
  { num: "03", en: "Pharmacy Dispensing", ar: "صرف الصيدلية", descEn: "Your pharmacist prepares and packages your medicines with QR traceability.", descAr: "يجهز صيدلانيك أدويتك ويعبئها مع تتبع QR." },
  { num: "04", en: "Delivery to You", ar: "التوصيل إليك", descEn: "Receive your medicines safely at your door.", descAr: "استلم أدويتك بأمان على بابك." },
];

const STATS = [
  { num: "10,000+", en: "Requests Fulfilled", ar: "طلب مُنجز" },
  { num: "98%", en: "On-Time Delivery", ar: "توصيل في الموعد" },
  { num: "50+", en: "Chronic Medicines", ar: "دواء مزمن" },
  { num: "24/7", en: "Support Available", ar: "دعم متاح" },
];

export default function Landing() {
  const { t, language } = useLanguage();
  const [, navigate] = useLocation();

  return (
    <div className="flex flex-col min-h-[calc(100dvh-3.5rem)]">
      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center px-4 py-24 text-center bg-gradient-to-br from-blue-50 via-white to-sky-50 overflow-hidden">
        <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "radial-gradient(circle at 20% 80%, #3b82f620 0%, transparent 50%), radial-gradient(circle at 80% 20%, #0ea5e920 0%, transparent 50%)" }} />
        <div className="relative max-w-4xl space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-1.5 text-sm font-semibold text-blue-700">
            <ShieldCheck className="w-3.5 h-3.5" />
            {t("Licensed Clinical Pharmacy Platform", "منصة الصيدلة السريرية المرخصة")}
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-slate-900 leading-tight">
            {language === "en" ? (
              <>Your Chronic Medicines,<br /><span className="text-blue-600">Delivered with Care</span></>
            ) : (
              <>أدويتك المزمنة،<br /><span className="text-blue-600">تُوصَّل بعناية</span></>
            )}
          </h1>
          <p className="text-lg md:text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed">
            {t(
              "Submit, track, and receive your chronic disease medications through a fully managed clinical workflow — reviewed by doctors and dispensed by certified pharmacists.",
              "قدّم أدوية أمراضك المزمنة وتتبعها واستلمها من خلال سير عمل سريري مُدار بالكامل — تتم مراجعتها من الأطباء وصرفها من الصيادلة المعتمدين."
            )}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <Button size="lg" className="gap-2 h-13 px-10 text-base bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200" onClick={() => navigate("/request")}>
              {t("Request My Medicines", "طلب أدويتي")}
              <ArrowRight className="w-4 h-4" />
            </Button>
            <Button size="lg" variant="outline" className="h-13 px-10 text-base border-slate-300" onClick={() => navigate("/track")}>
              {t("Track My Order", "تتبع طلبي")}
            </Button>
          </div>
          <div className="flex items-center justify-center gap-2 text-sm text-slate-400">
            <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
            <span>{t("Trusted by thousands of patients across the region", "موثوق به من آلاف المرضى في المنطقة")}</span>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="py-10 px-4 bg-blue-600 text-white">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {STATS.map(s => (
            <div key={s.num}>
              <div className="text-3xl font-bold">{s.num}</div>
              <div className="text-blue-200 text-sm mt-1">{language === "en" ? s.en : s.ar}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <div className="text-xs font-semibold uppercase tracking-widest text-blue-600 mb-3">
              {t("Why Choose ChronicMed", "لماذا تختار ChronicMed")}
            </div>
            <h2 className="text-3xl font-bold text-slate-900">
              {t("A Complete Clinical Pharmacy Experience", "تجربة صيدلانية سريرية متكاملة")}
            </h2>
            <p className="text-slate-500 mt-3 max-w-xl mx-auto">
              {t(
                "From prescription to doorstep — every step managed by licensed professionals.",
                "من الوصفة إلى بابك — كل خطوة تُدار من قبل متخصصين مرخصين."
              )}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map(f => (
              <div key={f.en} className="group rounded-2xl border border-slate-100 bg-white p-6 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
                <div className={`w-11 h-11 ${f.bg} rounded-xl flex items-center justify-center mb-4`}>
                  <f.icon className={`w-5 h-5 ${f.color}`} />
                </div>
                <h3 className="font-bold text-slate-900 mb-2">{language === "en" ? f.en : f.ar}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{language === "en" ? f.descEn : f.descAr}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-4 bg-slate-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <div className="text-xs font-semibold uppercase tracking-widest text-blue-600 mb-3">
              {t("Simple Process", "عملية بسيطة")}
            </div>
            <h2 className="text-3xl font-bold text-slate-900">
              {t("How It Works", "كيف يعمل")}
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative">
            {STEPS.map((step, i) => (
              <div key={step.num} className="relative flex flex-col items-center text-center">
                <div className="w-14 h-14 bg-blue-600 text-white rounded-2xl flex items-center justify-center text-xl font-bold mb-4 shadow-lg shadow-blue-100">
                  {step.num}
                </div>
                {i < STEPS.length - 1 && (
                  <ChevronRight className="absolute top-4 -right-3 w-6 h-6 text-blue-300 hidden md:block" />
                )}
                <h3 className="font-bold text-slate-900 mb-2">{language === "en" ? step.en : step.ar}</h3>
                <p className="text-slate-500 text-sm">{language === "en" ? step.descEn : step.descAr}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 bg-gradient-to-br from-blue-600 to-sky-600 text-white">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">
            {t("Ready to Get Started?", "هل أنت مستعد للبدء؟")}
          </h2>
          <p className="text-blue-100 mb-8 text-lg">
            {t(
              "Submit your first request in minutes. Our clinical team will review and process it promptly.",
              "قدّم طلبك الأول في دقائق. سيقوم فريقنا السريري بمراجعته ومعالجته على الفور."
            )}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" variant="secondary" className="gap-2 h-12 px-8 text-blue-700 font-semibold" onClick={() => navigate("/request")}>
              {t("Submit a Request", "تقديم طلب")}
              <ArrowRight className="w-4 h-4" />
            </Button>
            <Button size="lg" variant="outline" className="h-12 px-8 border-white/40 text-white hover:bg-white/10" onClick={() => navigate("/clinical-assistant")}>
              {t("Ask Clinical Assistant", "اسأل المساعد السريري")}
            </Button>
          </div>
        </div>
      </section>

      {/* Footer extras */}
      <section className="py-10 px-4 bg-white border-t">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-blue-500" />
            <span>{t("24/7 Support Line: +966 11 000 0000", "خط الدعم: +966 11 000 0000")}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-blue-500" />
            <span>{t("Serving all major cities in the region", "نخدم جميع المدن الرئيسية في المنطقة")}</span>
          </div>
          <Button variant="ghost" size="sm" className="text-blue-600 font-semibold gap-1" onClick={() => navigate("/portal")}>
            {t("Staff Portal", "بوابة الموظفين")}
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </section>
    </div>
  );
}
