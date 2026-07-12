import { useEffect, useMemo, useState } from "react";
import { BookOpen, CheckCircle2, Clock, GraduationCap, Languages, LockKeyhole, PlayCircle, ShieldCheck, Users } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { usePageSeo } from "@/components/route-seo";
import { useLanguage } from "@/lib/i18n";
import { usePatientAuth } from "@/lib/patient-auth";

type Course={id:string;slug:string;title_en:string;title_ar:string|null;summary_en:string;summary_ar:string|null;audience_roles:string[];audience_organization_types:string[];learning_outcomes:string[];level:string;version:string;sort_order:number;lesson_count:number;estimated_minutes:number};
type Lesson={id:string;course_id:string;lesson_slug:string;title_en:string;title_ar:string|null;summary_en:string;summary_ar:string|null;duration_minutes:number;lesson_order:number;content:{steps?:string[];warnings?:string[]};is_published:boolean};
type Enrollment={id:string;course_id:string;user_id:string;status:string;completed_lesson_slugs:string[];progress_percent:number;started_at:string|null;completed_at:string|null;last_activity_at:string|null};

const humanize=(value:string)=>value.replaceAll("_"," ").replace(/\b\w/g,letter=>letter.toUpperCase());

export default function LearningCenter(){
  const {t,language}=useLanguage();
  const {session,isAuthenticated,supabaseFetch}=usePatientAuth();
  const [courses,setCourses]=useState<Course[]>([]);
  const [lessons,setLessons]=useState<Lesson[]>([]);
  const [enrollments,setEnrollments]=useState<Enrollment[]>([]);
  const [selectedCourseId,setSelectedCourseId]=useState<string|null>(null);
  const [audience,setAudience]=useState("all");
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [message,setMessage]=useState<string|null>(null);

  const courseJsonLd=useMemo(()=>({
    "@context":"https://schema.org",
    "@type":"ItemList",
    name:"Medicine Support Hub Learning Center",
    itemListElement:courses.map((course,index)=>({
      "@type":"ListItem",position:index+1,item:{
        "@type":"Course",name:course.title_en,description:course.summary_en,
        provider:{"@type":"Organization",name:"Medicine Support Hub",url:"https://medicine-support-hub.vercel.app/"},
        educationalLevel:course.level,timeRequired:`PT${course.estimated_minutes}M`,inLanguage:["en","ar"],
        url:`https://medicine-support-hub.vercel.app/learn#${course.slug}`,
      }
    }))
  }),[courses]);

  usePageSeo({
    title:"Healthcare Learning Center | Medicine Support Hub",
    description:"Role-based onboarding for patients, physicians, pharmacies, laboratories, radiology centers, payers, institutions, and platform administrators using connected healthcare workflows.",
    canonicalPath:"/learn",
    keywords:"healthcare training, physician workflow training, pharmacy training, patient portal training, laboratory workflow, insurance authorization training",
    jsonLd:courseJsonLd,
  });

  async function load(){
    setLoading(true);setError(null);
    try{
      const nextCourses=await supabaseFetch<Course[]>("/rest/v1/learning_catalog_v1?select=*&order=sort_order.asc,title_en.asc");
      setCourses(nextCourses);
      const first=selectedCourseId&&nextCourses.some(row=>row.id===selectedCourseId)?selectedCourseId:nextCourses[0]?.id||null;
      setSelectedCourseId(first);
      const lessonRows=first?await supabaseFetch<Lesson[]>(`/rest/v1/learning_lessons?select=*&course_id=eq.${first}&is_published=eq.true&order=lesson_order.asc`):[];
      setLessons(lessonRows);
      if(isAuthenticated&&session?.user?.id){
        const rows=await supabaseFetch<Enrollment[]>("/rest/v1/learning_enrollments?select=*&order=last_activity_at.desc.nullslast,created_at.desc");
        setEnrollments(rows);
      }else setEnrollments([]);
    }catch(cause){setError(cause instanceof Error?cause.message:t("Could not load the learning center.","تعذر تحميل مركز التعلم."));}
    finally{setLoading(false);}
  }
  useEffect(()=>{void load();},[isAuthenticated,session?.user?.id]);

  async function selectCourse(courseId:string){
    setSelectedCourseId(courseId);setError(null);
    try{setLessons(await supabaseFetch<Lesson[]>(`/rest/v1/learning_lessons?select=*&course_id=eq.${courseId}&is_published=eq.true&order=lesson_order.asc`));}
    catch(cause){setError(cause instanceof Error?cause.message:t("Could not load lessons.","تعذر تحميل الدروس."));}
  }

  const selected=courses.find(course=>course.id===selectedCourseId)||null;
  const enrollment=selected?enrollments.find(row=>row.course_id===selected.id)||null:null;
  const audiences=useMemo(()=>["all",...Array.from(new Set(courses.flatMap(course=>course.audience_roles))).sort()],[courses]);
  const visibleCourses=courses.filter(course=>audience==="all"||course.audience_roles.includes(audience));

  async function enroll(){
    if(!selected||!session?.user?.id)return;
    setSaving(true);setError(null);setMessage(null);
    try{
      await supabaseFetch("/rest/v1/learning_enrollments",{method:"POST",headers:{Prefer:"return=representation,resolution=merge-duplicates"},body:JSON.stringify({course_id:selected.id,user_id:session.user.id,status:"in_progress",started_at:new Date().toISOString(),last_activity_at:new Date().toISOString()})});
      setMessage(t("Course added to your learning plan.","تمت إضافة الدورة إلى خطتك التعليمية."));await load();
    }catch(cause){setError(cause instanceof Error?cause.message:t("Could not enroll.","تعذر التسجيل."));}
    finally{setSaving(false);}
  }

  async function toggleLesson(lessonSlug:string){
    if(!selected||!session?.user?.id)return;
    setSaving(true);setError(null);setMessage(null);
    try{
      const current=enrollment?.completed_lesson_slugs||[];
      const completed=current.includes(lessonSlug)?current.filter(value=>value!==lessonSlug):[...current,lessonSlug];
      const percent=Math.round((completed.length/Math.max(1,lessons.length))*100);
      const payload={course_id:selected.id,user_id:session.user.id,status:percent===100?"completed":"in_progress",completed_lesson_slugs:completed,progress_percent:percent,started_at:enrollment?.started_at||new Date().toISOString(),completed_at:percent===100?new Date().toISOString():null,last_activity_at:new Date().toISOString()};
      if(enrollment)await supabaseFetch(`/rest/v1/learning_enrollments?id=eq.${enrollment.id}`,{method:"PATCH",headers:{Prefer:"return=representation"},body:JSON.stringify(payload)});
      else await supabaseFetch("/rest/v1/learning_enrollments",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify(payload)});
      await load();await selectCourse(selected.id);
    }catch(cause){setError(cause instanceof Error?cause.message:t("Could not save progress.","تعذر حفظ التقدم."));}
    finally{setSaving(false);}
  }

  return <main className="container mx-auto max-w-7xl px-4 py-8">
    <section className="overflow-hidden rounded-3xl border bg-card shadow-sm"><div className="grid gap-8 p-6 md:p-10 lg:grid-cols-[1.2fr_.8fr] lg:items-center"><div><p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[.14em] text-primary"><GraduationCap className="h-4 w-4"/>{t("Healthcare learning and adoption platform","منصة التعلم وتبني الرعاية الصحية")}</p><h1 className="mt-4 text-4xl font-bold tracking-tight md:text-5xl">{t("Learn the complete connected healthcare journey by role","تعلّم رحلة الرعاية الصحية المترابطة كاملة حسب دورك")}</h1><p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">{t("Short bilingual tracks help patients, clinicians, pharmacies, diagnostic providers, payers, institutions, and administrators use the platform safely and consistently.","تساعد المسارات القصيرة ثنائية اللغة المرضى والأطباء والصيدليات ومقدمي التشخيص وجهات التأمين والمؤسسات والمسؤولين على استخدام المنصة بأمان واتساق.")}</p></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1"><Value icon={Users} title={t("Role-specific","حسب الدور")} text={t("Each audience sees the workflow, controls, and mistakes that matter to them.","يرى كل جمهور المسار والضوابط والأخطاء المهمة له.")}/><Value icon={Languages} title={t("English and Arabic","العربية والإنجليزية")} text={t("Bilingual titles, summaries, and operational guidance.","عناوين وملخصات وإرشادات تشغيلية ثنائية اللغة.")}/><Value icon={ShieldCheck} title={t("Safety before access","السلامة قبل الوصول")} text={t("Institutions can require training before controlled production access.","يمكن للمؤسسات اشتراط التدريب قبل الوصول المنضبط للإنتاج.")}/></div></div></section>

    {error&&<Alert variant="destructive" className="mt-5"><AlertDescription>{error}</AlertDescription></Alert>}{message&&<Alert className="mt-5"><CheckCircle2 className="h-4 w-4"/><AlertDescription>{message}</AlertDescription></Alert>}

    <section className="mt-6 rounded-2xl border bg-card p-4"><div className="flex flex-wrap items-center gap-2"><span className="text-sm font-semibold">{t("Audience","الجمهور")}:</span>{audiences.map(value=><Button key={value} size="sm" variant={audience===value?"default":"outline"} onClick={()=>setAudience(value)}>{value==="all"?t("All tracks","كل المسارات"):humanize(value)}</Button>)}</div></section>

    <section className="mt-6 grid gap-6 lg:grid-cols-[.8fr_1.2fr]"><div className="space-y-3">{visibleCourses.map(course=><Card key={course.id} id={course.slug} className={selectedCourseId===course.id?"border-primary shadow-md":"hover:shadow-sm"}><CardContent className="p-5"><button className="w-full text-left" onClick={()=>void selectCourse(course.id)}><div className="flex items-start justify-between gap-3"><div><div className="font-bold">{language==="ar"?course.title_ar||course.title_en:course.title_en}</div><p className="mt-2 text-sm leading-6 text-muted-foreground">{language==="ar"?course.summary_ar||course.summary_en:course.summary_en}</p></div><Badge variant="outline">{humanize(course.level)}</Badge></div><div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground"><span className="flex items-center gap-1"><BookOpen className="h-3.5 w-3.5"/>{course.lesson_count} {t("lessons","دروس")}</span><span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5"/>{course.estimated_minutes} {t("minutes","دقيقة")}</span></div></button></CardContent></Card>)}{!loading&&visibleCourses.length===0&&<Card><CardContent className="p-6 text-sm text-muted-foreground">{t("No courses match this audience.","لا توجد دورات لهذا الجمهور.")}</CardContent></Card>}</div>

    <div>{selected&&<Card className="sticky top-20"><CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="text-2xl">{language==="ar"?selected.title_ar||selected.title_en:selected.title_en}</CardTitle><p className="mt-2 text-sm leading-6 text-muted-foreground">{language==="ar"?selected.summary_ar||selected.summary_en:selected.summary_en}</p></div><Badge>{t("Version","الإصدار")} {selected.version}</Badge></div></CardHeader><CardContent className="space-y-5"><div><div className="mb-2 flex items-center justify-between text-sm"><span>{t("Learning outcomes","نتائج التعلم")}</span><span>{enrollment?.progress_percent||0}%</span></div><Progress value={enrollment?.progress_percent||0}/><ul className="mt-3 space-y-2 text-sm text-muted-foreground">{selected.learning_outcomes.map(outcome=><li key={outcome} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary"/>{outcome}</li>)}</ul></div>{!isAuthenticated?<Alert><LockKeyhole className="h-4 w-4"/><AlertDescription>{t("Course content is public. Sign in to save progress and completion.","محتوى الدورة عام. سجّل الدخول لحفظ التقدم والإكمال.")}</AlertDescription></Alert>:!enrollment?<Button onClick={()=>void enroll()} disabled={saving}><PlayCircle className="mr-2 h-4 w-4"/>{t("Start course","ابدأ الدورة")}</Button>:null}<div className="space-y-3">{lessons.map(lesson=>{const done=enrollment?.completed_lesson_slugs.includes(lesson.lesson_slug)||false;return <div key={lesson.id} className="rounded-xl border p-4"><div className="flex items-start justify-between gap-3"><div><div className="font-semibold">{language==="ar"?lesson.title_ar||lesson.title_en:lesson.title_en}</div><p className="mt-1 text-sm leading-6 text-muted-foreground">{language==="ar"?lesson.summary_ar||lesson.summary_en:lesson.summary_en}</p></div><Badge variant={done?"default":"secondary"}>{lesson.duration_minutes} {t("min","د")}</Badge></div>{lesson.content.steps&&<ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">{lesson.content.steps.map(step=><li key={step}>{step}</li>)}</ol>}{isAuthenticated&&<Button className="mt-4" size="sm" variant={done?"outline":"default"} onClick={()=>void toggleLesson(lesson.lesson_slug)} disabled={saving}>{done?t("Mark incomplete","إلغاء الإكمال"):t("Mark complete","تم الإكمال")}</Button>}</div>})}</div></CardContent></Card>}</div></section>

    <Alert className="mt-8"><AlertDescription>{t("Training completion confirms platform onboarding only. It is not a medical license, regulatory credential, or substitute for institutional competency assessment.","إكمال التدريب يؤكد التهيئة على المنصة فقط، وليس ترخيصًا طبيًا أو اعتمادًا تنظيميًا أو بديلًا لتقييم كفاءة المؤسسة.")}</AlertDescription></Alert>
  </main>;
}

function Value({icon:Icon,title,text}:{icon:typeof Users;title:string;text:string}){return <Card><CardContent className="flex gap-3 p-4"><div className="rounded-xl bg-primary/10 p-2 text-primary"><Icon className="h-5 w-5"/></div><div><div className="font-semibold">{title}</div><p className="mt-1 text-sm leading-6 text-muted-foreground">{text}</p></div></CardContent></Card>;}
