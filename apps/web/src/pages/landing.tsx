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
  Mail,
  MapPin,
  ChevronRight,
  HeartHandshake,
  Wallet,
  ShoppingCart,
  BarChart3,
} from "lucide-react";

const FEATURES = [
  { icon: ClipboardList, en: "Easy Online Requests", ar: "Easy Online Requests", descEn: "Submit chronic medicine requests from anywhere, anytime.", descAr: "Submit chronic medicine requests from anywhere, anytime.", color: "text-blue-600", bg: "bg-blue-50" },
  { icon: Stethoscope, en: "Clinical Review", ar: "Clinical Review", descEn: "Every request can be reviewed before dispensing.", descAr: "Every request can be reviewed before dispensing.", color: "text-violet-600", bg: "bg-violet-50" },
  { icon: FlaskConical, en: "Pharmacy Precision", ar: "Pharmacy Precision", descEn: "Pharmacists verify and dispense medicines with traceability.", descAr: "Pharmacists verify and dispense medicines with traceability.", color: "text-amber-600", bg: "bg-amber-50" },
  { icon: Truck, en: "Fulfillment Tracking", ar: "Fulfillment Tracking", descEn: "Track medicine preparation, pickup, pharmacy fulfillment, or delivery.", descAr: "Track medicine preparation, pickup, pharmacy fulfillment, or delivery.", color: "text-sky-600", bg: "bg-sky-50" },
  { icon: ShieldCheck, en: "Controlled Workflow", ar: "Controlled Workflow", descEn: "Structured records for requests, reviews, budgets, fulfillment, and reporting.", descAr: "Structured records for requests, reviews, budgets, fulfillment, and reporting.", color: "text-emerald-600", bg: "bg-emerald-50" },
  { icon: Clock, en: "Real-Time Tracking", ar: "Real-Time Tracking", descEn: "Know where each request is in the medicine support workflow.", descAr: "Know where each request is in the medicine support workflow.", color: "text-rose-600", bg: "bg-rose-50" },
];

const STEPS = [
  { num: "01", en: "Submit Request", ar: "Submit Request", descEn: "Fill in requester details and needed medicines.", descAr: "Fill in requester details and needed medicines." },
  { num: "02", en: "Clinical Review", ar: "Clinical Review", descEn: "A reviewer checks medical and support eligibility.", descAr: "A reviewer checks medical and support eligibility." },
  { num: "03", en: "Budget & Fulfillment", ar: "Budget & Fulfillment", descEn: "The platform supports cost control, alternatives, and pharmacy fulfillment.", descAr: "The platform supports cost control, alternatives, and pharmacy fulfillment." },
  { num: "04", en: "Impact Reporting", ar: "Impact Reporting", descEn: "Programs can track beneficiaries, treatment months, and public-health impact.", descAr: "Programs can track beneficiaries, treatment months, and public-health impact." },
];

const STATS = [
  { num: "AI-ready", en: "Digital Health Platform", ar: "Digital Health Platform" },
  { num: "NGO", en: "Program Management", ar: "Program Management" },
  { num: "RLS", en: "Secure Supabase Backend", ar: "Secure Supabase Backend" },
  { num: "Vercel", en: "Cloud Deployment", ar: "Cloud Deployment" },
];

export default function Landing() {
  const { language } = useLanguage();
  const [, navigate] = useLocation();

  return (
    <div className="flex flex-col min-h-[calc(100dvh-3.5rem)]">
      <section className="relative flex flex-col items-center justify-center px-4 py-24 text-center bg-gradient-to-br from-blue-50 via-white to-sky-50 overflow-hidden">
        <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "radial-gradient(circle at 20% 80%, #3b82f620 0%, transparent 50%), radial-gradient(circle at 80% 20%, #0ea5e920 0%, transparent 50%)" }} />
        <div className="relative max-w-4xl space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-1.5 text-sm font-semibold text-blue-700"><ShieldCheck className="w-3.5 h-3.5" />AI-ready Chronic Medicines Support Platform</div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-slate-900 leading-tight">Medicine Support Hub<br /><span className="text-blue-600">Chronic Medicine Access, Managed with Care</span></h1>
          <p className="text-lg md:text-xl text-slate-500 max-w-3xl mx-auto leading-relaxed">A unified digital health platform for medicine assistance programs, connecting patients, NGOs, pharmacies, pharmaceutical companies, donors, suppliers, and clinical reviewers.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <Button size="lg" className="gap-2 h-13 px-10 text-base bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200" onClick={() => navigate("/request")}>Request My Medicines<ArrowRight className="w-4 h-4" /></Button>
            <Button size="lg" variant="outline" className="h-13 px-10 text-base border-slate-300" onClick={() => navigate("/ngo")}>For NGOs & Partners</Button>
          </div>
          <div className="flex items-center justify-center gap-2 text-sm text-slate-400"><Star className="w-4 h-4 text-amber-400 fill-amber-400" /><span>Created by Mina Samy Tawfik Saad for digital health, public health, and medicine support innovation</span></div>
        </div>
      </section>

      <section className="py-10 px-4 bg-blue-600 text-white"><div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">{STATS.map(s => <div key={s.num}><div className="text-3xl font-bold">{s.num}</div><div className="text-blue-200 text-sm mt-1">{language === "en" ? s.en : s.ar}</div></div>)}</div></section>

      <section className="py-16 px-4 bg-white border-b">
        <div className="max-w-5xl mx-auto grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border bg-slate-50 p-6">
            <div className="text-xs font-semibold uppercase tracking-widest text-blue-600 mb-3">Vision</div>
            <h2 className="text-2xl font-bold text-slate-900">Better medicine access for every chronic patient.</h2>
            <p className="mt-3 text-slate-600 leading-relaxed">Medicine Support Hub aims to make chronic medicine access more intelligent, transparent, sustainable, and measurable across patient assistance programs.</p>
          </div>
          <div className="rounded-2xl border bg-slate-50 p-6">
            <div className="text-xs font-semibold uppercase tracking-widest text-blue-600 mb-3">Mission</div>
            <h2 className="text-2xl font-bold text-slate-900">One platform from request to impact.</h2>
            <p className="mt-3 text-slate-600 leading-relaxed">The platform helps organizations manage beneficiary intake, clinical review, budget control, procurement, pharmacy fulfillment, and public-health impact reporting.</p>
          </div>
        </div>
      </section>

      <section className="py-20 px-4 bg-white"><div className="max-w-6xl mx-auto"><div className="text-center mb-14"><div className="text-xs font-semibold uppercase tracking-widest text-blue-600 mb-3">Platform Capabilities</div><h2 className="text-3xl font-bold text-slate-900">A Complete Medicine Support Operating System</h2><p className="text-slate-500 mt-3 max-w-xl mx-auto">From request to review, budget, procurement, fulfillment, and impact.</p></div><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{FEATURES.map(f => <div key={f.en} className="group rounded-2xl border border-slate-100 bg-white p-6 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5"><div className={`w-11 h-11 ${f.bg} rounded-xl flex items-center justify-center mb-4`}><f.icon className={`w-5 h-5 ${f.color}`} /></div><h3 className="font-bold text-slate-900 mb-2">{language === "en" ? f.en : f.ar}</h3><p className="text-slate-500 text-sm leading-relaxed">{language === "en" ? f.descEn : f.descAr}</p></div>)}</div></div></section>

      <section className="py-20 px-4 bg-emerald-50 border-y border-emerald-100">
        <div className="max-w-6xl mx-auto grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div><div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-4 py-1.5 text-sm font-semibold text-emerald-700 mb-4"><HeartHandshake className="w-4 h-4" />For NGOs, Donors, PSPs & Partners</div><h2 className="text-3xl font-bold text-slate-900">Run chronic medicine support programs with better control.</h2><p className="mt-4 text-slate-600 leading-relaxed">Manage beneficiaries, medicine requests, reviews, budgets, procurement, partnerships, and impact reporting from one workspace.</p><Button className="mt-6 bg-emerald-600 hover:bg-emerald-700" size="lg" onClick={() => navigate("/ngo")}>Open NGO Portal<ArrowRight className="ml-2 w-4 h-4" /></Button></div>
          <div className="grid gap-4 sm:grid-cols-3"><div className="rounded-2xl bg-white p-5 shadow-sm border"><Wallet className="mb-3 h-6 w-6 text-emerald-600" /><h3 className="font-bold text-slate-900">Budgets</h3><p className="mt-2 text-sm text-slate-500">Track project budget, committed costs, and remaining balance.</p></div><div className="rounded-2xl bg-white p-5 shadow-sm border"><ShoppingCart className="mb-3 h-6 w-6 text-emerald-600" /><h3 className="font-bold text-slate-900">Procurement</h3><p className="mt-2 text-sm text-slate-500">Handle suppliers, tenders, discounts, and pharmacy partners.</p></div><div className="rounded-2xl bg-white p-5 shadow-sm border"><BarChart3 className="mb-3 h-6 w-6 text-emerald-600" /><h3 className="font-bold text-slate-900">Impact</h3><p className="mt-2 text-sm text-slate-500">Report beneficiaries, treatment months, and health impact assumptions.</p></div></div>
        </div>
      </section>

      <section className="py-20 px-4 bg-slate-50"><div className="max-w-5xl mx-auto"><div className="text-center mb-14"><div className="text-xs font-semibold uppercase tracking-widest text-blue-600 mb-3">Workflow</div><h2 className="text-3xl font-bold text-slate-900">How It Works</h2></div><div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative">{STEPS.map((step, i) => <div key={step.num} className="relative flex flex-col items-center text-center"><div className="w-14 h-14 bg-blue-600 text-white rounded-2xl flex items-center justify-center text-xl font-bold mb-4 shadow-lg shadow-blue-100">{step.num}</div>{i < STEPS.length - 1 && <ChevronRight className="absolute top-4 -right-3 w-6 h-6 text-blue-300 hidden md:block" />}<h3 className="font-bold text-slate-900 mb-2">{language === "en" ? step.en : step.ar}</h3><p className="text-slate-500 text-sm">{language === "en" ? step.descEn : step.descAr}</p></div>)}</div></div></section>

      <section className="py-20 px-4 bg-gradient-to-br from-blue-600 to-sky-600 text-white"><div className="max-w-3xl mx-auto text-center"><h2 className="text-3xl font-bold mb-4">Build smarter medicine assistance programs.</h2><p className="text-blue-100 mb-8 text-lg">Medicine Support Hub is designed for chronic medicine access, patient assistance, NGO operations, pharmacy partnerships, procurement, and public-health impact measurement.</p><div className="flex flex-col sm:flex-row gap-4 justify-center"><Button size="lg" variant="secondary" className="gap-2 h-12 px-8 text-blue-700 font-semibold" onClick={() => navigate("/request")}>Submit a Request<ArrowRight className="w-4 h-4" /></Button><Button size="lg" variant="outline" className="h-12 px-8 border-white/40 text-white hover:bg-white/10" onClick={() => navigate("/clinical-assistant")}>Ask Clinical Assistant</Button></div></div></section>

      <section className="py-10 px-4 bg-white border-t">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-blue-500" /><a className="hover:text-blue-600" href="mailto:jesussavedmina@gmail.com">jesussavedmina@gmail.com</a></div>
          <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-blue-500" /><a className="hover:text-blue-600" href="tel:+201284590503">+20 128 459 0503</a></div>
          <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-blue-500" /><a className="hover:text-blue-600" href="https://minasami.github.io/" target="_blank" rel="noreferrer">minasami.github.io</a></div>
          <Button variant="ghost" size="sm" className="text-blue-600 font-semibold gap-1" onClick={() => navigate("/portal")}>Staff Portal<ChevronRight className="w-3.5 h-3.5" /></Button>
        </div>
      </section>
    </div>
  );
}
