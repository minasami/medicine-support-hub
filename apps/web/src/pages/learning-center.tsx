import { useEffect, useMemo, useState } from "react";
import {
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  ExternalLink,
  GraduationCap,
  Languages,
  LockKeyhole,
  Medal,
  PlayCircle,
  Route,
  ShieldCheck,
  Sparkles,
  Star,
  Trophy,
  Users,
  Video,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { usePageSeo } from "@/components/route-seo";
import { useLanguage } from "@/lib/i18n";
import { usePatientAuth } from "@/lib/patient-auth";

type Course = {
  id: string;
  slug: string;
  title_en: string;
  title_ar: string | null;
  summary_en: string;
  summary_ar: string | null;
  audience_roles: string[];
  audience_organization_types: string[];
  learning_outcomes: string[];
  level: string;
  version: string;
  sort_order: number;
  lesson_count: number;
  estimated_minutes: number;
  completion_points?: number;
};

type Lesson = {
  id: string;
  course_id: string;
  lesson_slug: string;
  title_en: string;
  title_ar: string | null;
  summary_en: string;
  summary_ar: string | null;
  duration_minutes: number;
  lesson_order: number;
  content: { steps?: string[]; warnings?: string[] };
  video_url: string | null;
  video_provider: string | null;
  experience_points: number;
};

type Enrollment = {
  id: string;
  course_id: string;
  user_id: string;
  status: string;
  completed_lesson_slugs: string[];
  progress_percent: number;
  started_at: string | null;
  completed_at: string | null;
  last_activity_at: string | null;
};

type CareerPath = {
  id: string;
  slug: string;
  role_key: string;
  title_en: string;
  title_ar: string | null;
  summary_en: string;
  summary_ar: string | null;
  experience_outcomes: string[];
  certificate_title: string | null;
  minimum_points: number;
  sort_order: number;
};

type CareerPathCourse = {
  career_path_id: string;
  course_id: string;
  course_order: number;
  is_required: boolean;
};

type LearnerSummary = {
  user_id: string;
  total_points: number;
  completed_courses: number;
  active_courses: number;
  certificate_count: number;
  experience_level: string;
};

type Certificate = {
  id: string;
  course_id: string;
  certificate_code: string;
  title: string;
  issued_at: string;
  revoked_at: string | null;
  metadata: Record<string, unknown>;
};

const humanize = (value: string) =>
  value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

function localized(language: string, english: string, arabic: string | null) {
  return language === "ar" ? arabic || english : english;
}

function staffRole() {
  try {
    const stored = JSON.parse(localStorage.getItem("medicine_support_staff_session") || "null");
    return String(stored?.user?.role || stored?.role || "").toLowerCase();
  } catch {
    return "";
  }
}

function embedVideoUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.hostname === "youtu.be") return `https://www.youtube-nocookie.com/embed/${url.pathname.slice(1)}`;
    if (url.hostname.endsWith("youtube.com")) {
      const id = url.searchParams.get("v");
      if (id) return `https://www.youtube-nocookie.com/embed/${id}`;
      if (url.pathname.startsWith("/embed/")) return value;
    }
    if (url.hostname.endsWith("vimeo.com")) {
      const id = url.pathname.split("/").filter(Boolean).pop();
      if (id) return `https://player.vimeo.com/video/${id}`;
    }
  } catch {
    return null;
  }
  return null;
}

function levelProgress(points: number) {
  const levels = [
    { name: "Newcomer", minimum: 0, next: 100 },
    { name: "Starter", minimum: 100, next: 200 },
    { name: "Practitioner", minimum: 200, next: 500 },
    { name: "Advanced", minimum: 500, next: 1000 },
    { name: "Expert", minimum: 1000, next: 1000 },
  ];
  const current = [...levels].reverse().find((level) => points >= level.minimum) || levels[0];
  const percent = current.next === current.minimum ? 100 : Math.min(100, Math.round(((points - current.minimum) / (current.next - current.minimum)) * 100));
  return { ...current, percent };
}

export default function LearningCenter() {
  const { t, language } = useLanguage();
  const { session, isAuthenticated, supabaseFetch } = usePatientAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [paths, setPaths] = useState<CareerPath[]>([]);
  const [pathCourses, setPathCourses] = useState<CareerPathCourse[]>([]);
  const [summary, setSummary] = useState<LearnerSummary | null>(null);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [audience, setAudience] = useState(() => staffRole() || "all");
  const [view, setView] = useState<"paths" | "courses" | "awards">("paths");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const courseJsonLd = useMemo(
    () => ({
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "Medicine Support Hub Learning Center",
      itemListElement: courses.map((course, index) => ({
        "@type": "ListItem",
        position: index + 1,
        item: {
          "@type": "Course",
          name: course.title_en,
          description: course.summary_en,
          provider: { "@type": "Organization", name: "Medicine Support Hub" },
          educationalLevel: course.level,
          timeRequired: `PT${course.estimated_minutes}M`,
          inLanguage: ["en", "ar"],
          url: `https://medicinesupport.app/learn#${course.slug}`,
        },
      })),
    }),
    [courses],
  );

  usePageSeo({
    title: "Healthcare Learning Center | Medicine Support Hub",
    description:
      "Role-based bilingual healthcare learning videos, career paths, platform experience points, progress, and onboarding certificates.",
    canonicalPath: "/learn",
    keywords:
      "healthcare training videos, physician career path, pharmacy learning path, healthcare certificates, gamified medical education",
    jsonLd: courseJsonLd,
  });

  async function loadCourseLessons(courseId: string) {
    const rows = await supabaseFetch<Lesson[]>(
      `/rest/v1/learning_lessons?select=id,course_id,lesson_slug,title_en,title_ar,summary_en,summary_ar,duration_minutes,lesson_order,content,video_url,video_provider,experience_points&course_id=eq.${courseId}&is_published=eq.true&order=lesson_order.asc`,
    );
    setLessons(rows);
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [nextCourses, nextPaths, nextPathCourses] = await Promise.all([
        supabaseFetch<Course[]>("/rest/v1/learning_catalog_v1?select=*&order=sort_order.asc,title_en.asc"),
        supabaseFetch<CareerPath[]>("/rest/v1/learning_career_paths?select=id,slug,role_key,title_en,title_ar,summary_en,summary_ar,experience_outcomes,certificate_title,minimum_points,sort_order&is_published=eq.true&order=sort_order.asc"),
        supabaseFetch<CareerPathCourse[]>("/rest/v1/learning_career_path_courses?select=career_path_id,course_id,course_order,is_required&order=course_order.asc"),
      ]);
      setCourses(nextCourses);
      setPaths(nextPaths);
      setPathCourses(nextPathCourses);
      const nextSelected =
        selectedCourseId && nextCourses.some((course) => course.id === selectedCourseId)
          ? selectedCourseId
          : nextCourses[0]?.id ?? null;
      setSelectedCourseId(nextSelected);
      if (nextSelected) await loadCourseLessons(nextSelected);
      else setLessons([]);

      if (isAuthenticated && session?.user?.id) {
        const [enrollmentRows, summaryRows, certificateRows] = await Promise.all([
          supabaseFetch<Enrollment[]>("/rest/v1/learning_enrollments?select=*&order=last_activity_at.desc.nullslast,created_at.desc"),
          supabaseFetch<LearnerSummary[]>(`/rest/v1/learning_profile_summary_v1?select=*&user_id=eq.${session.user.id}&limit=1`),
          supabaseFetch<Certificate[]>("/rest/v1/learning_certificates?select=id,course_id,certificate_code,title,issued_at,revoked_at,metadata&order=issued_at.desc"),
        ]);
        setEnrollments(enrollmentRows);
        setSummary(summaryRows[0] || null);
        setCertificates(certificateRows);
      } else {
        setEnrollments([]);
        setSummary(null);
        setCertificates([]);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Could not load the learning center.", "تعذر تحميل مركز التعلم."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [isAuthenticated, session?.user?.id]);

  async function selectCourse(courseId: string) {
    setSelectedCourseId(courseId);
    setView("courses");
    setError(null);
    try {
      await loadCourseLessons(courseId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Could not load lessons.", "تعذر تحميل الدروس."));
    }
  }

  const selected = courses.find((course) => course.id === selectedCourseId) ?? null;
  const enrollment = selected ? enrollments.find((row) => row.course_id === selected.id) ?? null : null;
  const audiences = useMemo(
    () => ["all", ...Array.from(new Set([...courses.flatMap((course) => course.audience_roles), ...paths.map((path) => path.role_key)])).sort()],
    [courses, paths],
  );
  const visibleCourses = courses.filter((course) => audience === "all" || course.audience_roles.includes(audience));
  const visiblePaths = paths.filter((path) => audience === "all" || path.role_key === audience);
  const learnerLevel = levelProgress(summary?.total_points || 0);

  async function enroll() {
    if (!selected || !session?.user?.id) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await supabaseFetch("/rest/v1/learning_enrollments", {
        method: "POST",
        headers: { Prefer: "return=representation,resolution=merge-duplicates" },
        body: JSON.stringify({
          course_id: selected.id,
          user_id: session.user.id,
          status: "in_progress",
          started_at: new Date().toISOString(),
          last_activity_at: new Date().toISOString(),
        }),
      });
      setMessage(t("Course added to your learning path.", "تمت إضافة الدورة إلى مسارك التعليمي."));
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Could not enroll.", "تعذر التسجيل."));
    } finally {
      setSaving(false);
    }
  }

  async function toggleLesson(lessonSlug: string) {
    if (!selected || !session?.user?.id) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const current = enrollment?.completed_lesson_slugs ?? [];
      const completed = current.includes(lessonSlug)
        ? current.filter((value) => value !== lessonSlug)
        : [...current, lessonSlug];
      const progressPercent = Math.round((completed.length / Math.max(1, lessons.length)) * 100);
      const payload = {
        course_id: selected.id,
        user_id: session.user.id,
        status: progressPercent === 100 ? "completed" : "in_progress",
        completed_lesson_slugs: completed,
        progress_percent: progressPercent,
        started_at: enrollment?.started_at ?? new Date().toISOString(),
        completed_at: progressPercent === 100 ? new Date().toISOString() : null,
        last_activity_at: new Date().toISOString(),
      };

      if (enrollment) {
        await supabaseFetch(`/rest/v1/learning_enrollments?id=eq.${enrollment.id}`, {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify(payload),
        });
      } else {
        await supabaseFetch("/rest/v1/learning_enrollments", {
          method: "POST",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify(payload),
        });
      }
      if (progressPercent === 100) {
        setMessage(t("Course completed. Your points and certificate are being issued.", "اكتملت الدورة. جارٍ إصدار النقاط والشهادة."));
      }
      await load();
      await loadCourseLessons(selected.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Could not save progress.", "تعذر حفظ التقدم."));
    } finally {
      setSaving(false);
    }
  }

  function courseTitle(courseId: string) {
    return courses.find((course) => course.id === courseId)?.title_en || "Learning course";
  }

  return (
    <main className="container mx-auto max-w-7xl px-4 py-8">
      <section className="overflow-hidden rounded-3xl border bg-card shadow-sm">
        <div className="grid gap-8 p-6 md:p-10 lg:grid-cols-[1.2fr_.8fr] lg:items-center">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[.14em] text-primary">
              <GraduationCap className="h-4 w-4" />
              {t("Healthcare learning, careers and experience", "التعلم والمسارات المهنية والخبرة الصحية")}
            </p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight md:text-5xl">
              {t("Learn the connected healthcare journey and grow by role", "تعلّم رحلة الرعاية المترابطة وتطوّر حسب دورك")}
            </h1>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">
              {t(
                "Follow role-specific paths, watch approved learning videos, practice complete workflows, earn experience points, and receive platform-onboarding certificates.",
                "اتبع مسارات حسب الدور وشاهد فيديوهات تعليمية معتمدة وتدرّب على المسارات الكاملة واكسب نقاط خبرة وشهادات تهيئة على المنصة.",
              )}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <Value icon={Route} title={t("Career paths", "مسارات مهنية")} text={t("A sequenced route from foundation to confident role practice.", "مسار متدرج من الأساسيات إلى ممارسة الدور بثقة.")} />
            <Value icon={Video} title={t("Videos and practice", "فيديوهات وتطبيق")} text={t("Approved video resources sit beside operational steps and safety warnings.", "موارد فيديو معتمدة بجوار خطوات التشغيل وتحذيرات السلامة.")} />
            <Value icon={Trophy} title={t("Points and certificates", "نقاط وشهادات")} text={t("Completion creates non-regulatory platform experience evidence.", "ينشئ الإكمال دليل خبرة على المنصة غير تنظيمي.")} />
          </div>
        </div>
      </section>

      {isAuthenticated && summary && (
        <section className="mt-6 grid gap-4 md:grid-cols-[1.2fr_repeat(3,.6fr)]">
          <Card className="border-primary/25 bg-primary/5">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3"><div><div className="text-sm font-semibold text-primary">{humanize(summary.experience_level)}</div><div className="mt-1 text-3xl font-bold">{summary.total_points.toLocaleString()} XP</div></div><Sparkles className="h-7 w-7 text-primary" /></div>
              <div className="mt-4 flex justify-between text-xs text-muted-foreground"><span>{learnerLevel.name}</span><span>{learnerLevel.next === learnerLevel.minimum ? t("Top level", "أعلى مستوى") : `${learnerLevel.next} XP`}</span></div>
              <Progress className="mt-2" value={learnerLevel.percent} />
            </CardContent>
          </Card>
          <Stat icon={BookOpen} label={t("Active courses", "دورات نشطة")} value={summary.active_courses} />
          <Stat icon={CheckCircle2} label={t("Completed", "مكتملة")} value={summary.completed_courses} />
          <Stat icon={Award} label={t("Certificates", "شهادات")} value={summary.certificate_count} />
        </section>
      )}

      {error && <Alert variant="destructive" className="mt-5"><AlertDescription>{error}</AlertDescription></Alert>}
      {message && <Alert className="mt-5"><CheckCircle2 className="h-4 w-4" /><AlertDescription>{message}</AlertDescription></Alert>}

      <section className="mt-6 rounded-2xl border bg-card p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="mobile-scrollbar-hidden flex gap-2 overflow-x-auto">
            <Button variant={view === "paths" ? "default" : "outline"} onClick={() => setView("paths")}><Route className="mr-2 h-4 w-4" />{t("Career paths", "المسارات المهنية")}</Button>
            <Button variant={view === "courses" ? "default" : "outline"} onClick={() => setView("courses")}><BookOpen className="mr-2 h-4 w-4" />{t("Courses", "الدورات")}</Button>
            <Button variant={view === "awards" ? "default" : "outline"} onClick={() => setView("awards")}><Medal className="mr-2 h-4 w-4" />{t("Awards", "الإنجازات")}</Button>
          </div>
          <div className="mobile-scrollbar-hidden flex items-center gap-2 overflow-x-auto">
            <span className="shrink-0 text-sm font-semibold">{t("Role", "الدور")}:</span>
            {audiences.map((value) => <Button key={value} size="sm" variant={audience === value ? "secondary" : "ghost"} className="shrink-0" onClick={() => setAudience(value)}>{value === "all" ? t("All", "الكل") : humanize(value)}</Button>)}
          </div>
        </div>
      </section>

      {loading ? (
        <div className="py-16 text-center text-muted-foreground">{t("Loading learning experience…", "جارٍ تحميل تجربة التعلم…")}</div>
      ) : view === "paths" ? (
        <section className="mt-6 grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
          {visiblePaths.map((path) => {
            const linked = pathCourses.filter((row) => row.career_path_id === path.id).sort((a, b) => a.course_order - b.course_order);
            const completed = linked.filter((row) => enrollments.some((enrollmentRow) => enrollmentRow.course_id === row.course_id && enrollmentRow.status === "completed")).length;
            const progress = linked.length ? Math.round((completed / linked.length) * 100) : 0;
            return <Card key={path.id} id={path.slug} className="overflow-hidden"><CardHeader className="bg-gradient-to-br from-primary/10 to-background"><div className="flex items-start justify-between gap-3"><Badge>{humanize(path.role_key)}</Badge><span className="text-xs font-semibold text-muted-foreground">{path.minimum_points} XP</span></div><CardTitle className="mt-3 text-2xl">{localized(language, path.title_en, path.title_ar)}</CardTitle><p className="text-sm leading-6 text-muted-foreground">{localized(language, path.summary_en, path.summary_ar)}</p></CardHeader><CardContent className="space-y-5 p-5"><div><div className="mb-2 flex justify-between text-xs"><span>{t("Path progress", "تقدم المسار")}</span><span>{progress}%</span></div><Progress value={progress} /></div><div className="space-y-2">{linked.map((link, index) => { const course = courses.find((row) => row.id === link.course_id); const completedCourse = enrollments.some((row) => row.course_id === link.course_id && row.status === "completed"); return course ? <button key={link.course_id} onClick={() => void selectCourse(link.course_id)} className="flex w-full items-center gap-3 rounded-xl border p-3 text-left transition hover:border-primary/40 hover:bg-primary/5"><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${completedCourse ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{completedCourse ? <CheckCircle2 className="h-4 w-4" /> : index + 1}</span><span className="min-w-0"><span className="block truncate font-semibold">{localized(language, course.title_en, course.title_ar)}</span><span className="text-xs text-muted-foreground">{link.is_required ? t("Required", "مطلوب") : t("Optional", "اختياري")}</span></span></button> : null; })}</div><div><div className="text-sm font-semibold">{t("Experience outcomes", "نتائج الخبرة")}</div><ul className="mt-2 space-y-2 text-sm text-muted-foreground">{path.experience_outcomes.map((outcome) => <li key={outcome} className="flex gap-2"><Star className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{outcome}</li>)}</ul></div></CardContent></Card>;
          })}
          {!visiblePaths.length && <Card><CardContent className="p-6 text-sm text-muted-foreground">{t("No career path matches this role yet.", "لا يوجد مسار مهني لهذا الدور حتى الآن.")}</CardContent></Card>}
        </section>
      ) : view === "awards" ? (
        <section className="mt-6 grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
          <Card><CardHeader><CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5 text-primary" />{t("Experience levels", "مستويات الخبرة")}</CardTitle></CardHeader><CardContent className="space-y-3">{[["Newcomer",0],["Starter",100],["Practitioner",200],["Advanced",500],["Expert",1000]].map(([name, points]) => <div key={String(name)} className={`flex items-center justify-between rounded-xl border p-3 ${summary && summary.total_points >= Number(points) ? "border-primary/30 bg-primary/5" : "opacity-65"}`}><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"><Medal className="h-4 w-4" /></span><span className="font-semibold">{String(name)}</span></div><span className="text-sm text-muted-foreground">{Number(points).toLocaleString()} XP</span></div>)}</CardContent></Card>
          <Card><CardHeader><CardTitle className="flex items-center gap-2"><Award className="h-5 w-5 text-primary" />{t("Your certificates", "شهاداتك")}</CardTitle></CardHeader><CardContent>{!isAuthenticated ? <Alert><LockKeyhole className="h-4 w-4" /><AlertDescription>{t("Sign in to earn and view certificates.", "سجّل الدخول لكسب الشهادات وعرضها.")}</AlertDescription></Alert> : certificates.length ? <div className="grid gap-3 sm:grid-cols-2">{certificates.map((certificate) => <div key={certificate.id} className="rounded-2xl border bg-gradient-to-br from-amber-50 to-background p-5 dark:from-amber-950/20"><div className="flex items-start justify-between gap-3"><Award className="h-8 w-8 text-amber-600" /><Badge variant={certificate.revoked_at ? "destructive" : "outline"}>{certificate.revoked_at ? t("Revoked", "ملغاة") : t("Issued", "صادرة")}</Badge></div><div className="mt-4 font-bold">{certificate.title}</div><div className="mt-2 text-sm text-muted-foreground">{courseTitle(certificate.course_id)}</div><div className="mt-4 font-mono text-xs">{certificate.certificate_code}</div><div className="mt-1 text-xs text-muted-foreground">{new Date(certificate.issued_at).toLocaleDateString()}</div></div>)}</div> : <p className="text-sm text-muted-foreground">{t("Complete a course to receive your first platform-learning certificate.", "أكمل دورة لتحصل على أول شهادة تعلم من المنصة.")}</p>}</CardContent></Card>
        </section>
      ) : (
        <section className="mt-6 grid gap-6 lg:grid-cols-[.8fr_1.2fr]">
          <div className="space-y-3">
            {visibleCourses.map((course) => <Card key={course.id} id={course.slug} className={selectedCourseId === course.id ? "border-primary shadow-md" : "hover:shadow-sm"}><CardContent className="p-5"><button className="w-full text-left" onClick={() => void selectCourse(course.id)}><div className="flex items-start justify-between gap-3"><div><div className="font-bold">{localized(language, course.title_en, course.title_ar)}</div><p className="mt-2 text-sm leading-6 text-muted-foreground">{localized(language, course.summary_en, course.summary_ar)}</p></div><Badge variant="outline">{humanize(course.level)}</Badge></div><div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground"><span className="flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" />{course.lesson_count} {t("lessons", "دروس")}</span><span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{course.estimated_minutes} {t("minutes", "دقيقة")}</span><span className="flex items-center gap-1"><Sparkles className="h-3.5 w-3.5" />{course.completion_points || 100} XP</span></div></button></CardContent></Card>)}
          </div>
          <div>{selected && <Card className="sticky top-20"><CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="text-2xl">{localized(language, selected.title_en, selected.title_ar)}</CardTitle><p className="mt-2 text-sm leading-6 text-muted-foreground">{localized(language, selected.summary_en, selected.summary_ar)}</p></div><Badge>{t("Version", "الإصدار")} {selected.version}</Badge></div></CardHeader><CardContent className="space-y-5"><div><div className="mb-2 flex items-center justify-between text-sm"><span>{t("Course progress", "تقدم الدورة")}</span><span>{enrollment?.progress_percent ?? 0}%</span></div><Progress value={enrollment?.progress_percent ?? 0} /><ul className="mt-3 space-y-2 text-sm text-muted-foreground">{selected.learning_outcomes.map((outcome) => <li key={outcome} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{outcome}</li>)}</ul></div>{!isAuthenticated ? <Alert><LockKeyhole className="h-4 w-4" /><AlertDescription>{t("Course content is public. Sign in to save progress, points and certificates.", "محتوى الدورة عام. سجّل الدخول لحفظ التقدم والنقاط والشهادات.")}</AlertDescription></Alert> : !enrollment ? <Button onClick={() => void enroll()} disabled={saving}><PlayCircle className="mr-2 h-4 w-4" />{t("Start course", "ابدأ الدورة")}</Button> : null}<div className="space-y-4">{lessons.map((lesson) => { const completed = enrollment?.completed_lesson_slugs.includes(lesson.lesson_slug) ?? false; const embed = embedVideoUrl(lesson.video_url); return <article key={lesson.id} className="overflow-hidden rounded-xl border"><div className="p-4"><div className="flex items-start justify-between gap-3"><div><div className="font-semibold">{localized(language, lesson.title_en, lesson.title_ar)}</div><p className="mt-1 text-sm leading-6 text-muted-foreground">{localized(language, lesson.summary_en, lesson.summary_ar)}</p></div><div className="flex flex-col items-end gap-1"><Badge variant={completed ? "default" : "secondary"}>{lesson.duration_minutes} {t("min", "د")}</Badge><span className="text-[11px] font-semibold text-primary">+{lesson.experience_points || 10} XP</span></div></div></div>{embed ? <div className="aspect-video bg-black"><iframe src={embed} title={`${lesson.title_en} video`} className="h-full w-full" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /></div> : lesson.video_url ? <a href={lesson.video_url} target="_blank" rel="noreferrer" className="mx-4 mb-4 flex items-center justify-between rounded-xl border bg-muted/30 p-3 text-sm font-semibold text-primary"><span className="flex items-center gap-2"><Video className="h-4 w-4" />{t("Open learning video", "فتح فيديو التعلم")}</span><ExternalLink className="h-4 w-4" /></a> : null}<div className="p-4">{lesson.content.steps && <ol className="list-decimal space-y-2 pl-5 text-sm">{lesson.content.steps.map((step) => <li key={step}>{step}</li>)}</ol>}{lesson.content.warnings?.length ? <Alert className="mt-4"><ShieldCheck className="h-4 w-4" /><AlertDescription><ul className="space-y-1">{lesson.content.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></AlertDescription></Alert> : null}{isAuthenticated && <Button className="mt-4" size="sm" variant={completed ? "outline" : "default"} onClick={() => void toggleLesson(lesson.lesson_slug)} disabled={saving}>{completed ? t("Mark incomplete", "إلغاء الإكمال") : t("Mark complete", "تم الإكمال")}</Button>}</div></article>; })}</div></CardContent></Card>}</div>
        </section>
      )}

      <Alert className="mt-8"><ShieldCheck className="h-4 w-4" /><AlertDescription>{t("Points, levels and certificates show Medicine Support Hub learning and platform experience only. They are not medical licenses, regulatory credentials, academic degrees, or substitutes for employer competency assessment.", "توضح النقاط والمستويات والشهادات التعلم والخبرة داخل منصة دعم الدواء فقط، وليست تراخيص طبية أو اعتمادات تنظيمية أو درجات أكاديمية أو بديلًا لتقييم جهة العمل للكفاءة.")}</AlertDescription></Alert>
    </main>
  );
}

function Value({ icon: Icon, title, text }: { icon: typeof Users; title: string; text: string }) {
  return <Card><CardContent className="flex gap-3 p-4"><div className="rounded-xl bg-primary/10 p-2 text-primary"><Icon className="h-5 w-5" /></div><div><div className="font-semibold">{title}</div><p className="mt-1 text-sm leading-6 text-muted-foreground">{text}</p></div></CardContent></Card>;
}

function Stat({ icon: Icon, label, value }: { icon: typeof BookOpen; label: string; value: number }) {
  return <Card><CardContent className="p-5"><Icon className="h-5 w-5 text-primary" /><div className="mt-3 text-3xl font-bold">{Number(value || 0).toLocaleString()}</div><div className="text-sm text-muted-foreground">{label}</div></CardContent></Card>;
}
