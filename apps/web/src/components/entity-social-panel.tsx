import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bookmark, Building2, Heart, MessageCircle, Send, ShieldAlert, ThumbsUp } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/lib/i18n";
import { usePatientAuth } from "@/lib/patient-auth";

type EntityType = "medicine" | "company";
type EngagementSummary = { favorite_count: number; like_count: number; helpful_count: number; comment_count: number };
type CommentRow = { id: string; user_id: string; author_name: string; body: string; status: string; created_at: string };
type Observation = { id: string; author_name: string; observation_type: string; title: string; description: string; severity: string | null; status: string; created_at: string };

type Props = {
  entityType: EntityType;
  entityKey: string;
  title: string;
  canonicalId?: number;
  companySlug?: string;
};

const observationTypes = ["possible_benefit", "side_effect", "adverse_effect"];
const severities = ["unknown", "mild", "moderate", "severe", "life_threatening"];

function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function exact(value: string) {
  return encodeURIComponent(value);
}

export function EntitySocialPanel({ entityType, entityKey, title, canonicalId, companySlug }: Props) {
  const { t } = useLanguage();
  const { session, isAuthenticated, supabaseFetch } = usePatientAuth();
  const [summary, setSummary] = useState<EngagementSummary>({ favorite_count: 0, like_count: 0, helpful_count: 0, comment_count: 0 });
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [favorite, setFavorite] = useState(false);
  const [liked, setLiked] = useState(false);
  const [helpful, setHelpful] = useState(false);
  const [comment, setComment] = useState("");
  const [observation, setObservation] = useState({ type: "side_effect", title: "", description: "", severity: "unknown", onset: "", evidence: "" });
  const [companyMessage, setCompanyMessage] = useState({ subject: "", body: "" });
  const [reporting, setReporting] = useState<string | null>(null);
  const [reportDetails, setReportDetails] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const safeKey = useMemo(() => String(entityKey), [entityKey]);

  async function load() {
    setError(null);
    try {
      const requests: Array<Promise<unknown>> = [
        supabaseFetch<EngagementSummary[]>("/rest/v1/rpc/entity_engagement_summary", {
          method: "POST",
          body: JSON.stringify({ p_entity_type: entityType, p_entity_key: safeKey }),
        }),
        supabaseFetch<CommentRow[]>(`/rest/v1/public_entity_comments?select=id,user_id,author_name,body,status,created_at&entity_type=eq.${entityType}&entity_key=eq.${exact(safeKey)}&status=eq.published&order=created_at.desc&limit=100`),
      ];
      if (canonicalId) {
        requests.push(supabaseFetch<Observation[]>(`/rest/v1/medicine_community_observations?select=id,author_name,observation_type,title,description,severity,status,created_at&canonical_id=eq.${canonicalId}&status=eq.approved&order=created_at.desc&limit=50`));
      }
      const results = await Promise.all(requests);
      const summaryRows = results[0] as EngagementSummary[];
      setSummary(summaryRows[0] || { favorite_count: 0, like_count: 0, helpful_count: 0, comment_count: 0 });
      setComments(results[1] as CommentRow[]);
      if (canonicalId) setObservations((results[2] as Observation[]) || []);

      if (session?.user?.id) {
        const userId = session.user.id;
        const [favoriteRows, reactionRows] = await Promise.all([
          supabaseFetch<Array<{ entity_key: string }>>(`/rest/v1/public_entity_favorites?select=entity_key&user_id=eq.${userId}&entity_type=eq.${entityType}&entity_key=eq.${exact(safeKey)}&limit=1`),
          supabaseFetch<Array<{ reaction_type: string }>>(`/rest/v1/public_entity_reactions?select=reaction_type&user_id=eq.${userId}&entity_type=eq.${entityType}&entity_key=eq.${exact(safeKey)}`),
        ]);
        setFavorite(favoriteRows.length > 0);
        setLiked(reactionRows.some((row) => row.reaction_type === "like"));
        setHelpful(reactionRows.some((row) => row.reaction_type === "helpful"));
      } else {
        setFavorite(false);
        setLiked(false);
        setHelpful(false);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Could not load community activity.", "تعذر تحميل نشاط المجتمع."));
    }
  }

  useEffect(() => { void load(); }, [entityType, safeKey, session?.user?.id]);

  function requireAccount() {
    if (isAuthenticated && session?.user?.id) return true;
    setError(t("Sign in to interact with this page.", "سجل الدخول للتفاعل مع هذه الصفحة."));
    return false;
  }

  async function toggleFavorite() {
    if (!requireAccount() || !session?.user?.id) return;
    setBusy("favorite"); setError(null); setMessage(null);
    try {
      if (favorite) {
        await supabaseFetch(`/rest/v1/public_entity_favorites?user_id=eq.${session.user.id}&entity_type=eq.${entityType}&entity_key=eq.${exact(safeKey)}`, { method: "DELETE" });
      } else {
        await supabaseFetch("/rest/v1/public_entity_favorites", { method: "POST", body: JSON.stringify({ user_id: session.user.id, entity_type: entityType, entity_key: safeKey }) });
      }
      setFavorite(!favorite);
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : t("Could not update favorites.", "تعذر تحديث المفضلة.")); }
    finally { setBusy(null); }
  }

  async function toggleReaction(reactionType: "like" | "helpful") {
    if (!requireAccount() || !session?.user?.id) return;
    setBusy(reactionType); setError(null); setMessage(null);
    const active = reactionType === "like" ? liked : helpful;
    try {
      if (active) {
        await supabaseFetch(`/rest/v1/public_entity_reactions?user_id=eq.${session.user.id}&entity_type=eq.${entityType}&entity_key=eq.${exact(safeKey)}&reaction_type=eq.${reactionType}`, { method: "DELETE" });
      } else {
        await supabaseFetch("/rest/v1/public_entity_reactions", { method: "POST", body: JSON.stringify({ user_id: session.user.id, entity_type: entityType, entity_key: safeKey, reaction_type: reactionType }) });
      }
      if (reactionType === "like") setLiked(!active); else setHelpful(!active);
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : t("Could not update your reaction.", "تعذر تحديث تفاعلك.")); }
    finally { setBusy(null); }
  }

  async function submitComment(event: React.FormEvent) {
    event.preventDefault();
    if (!requireAccount() || !session?.user?.id || comment.trim().length < 2) return;
    setBusy("comment"); setError(null); setMessage(null);
    try {
      const rows = await supabaseFetch<CommentRow[]>("/rest/v1/public_entity_comments?select=id,user_id,author_name,body,status,created_at", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ user_id: session.user.id, entity_type: entityType, entity_key: safeKey, body: comment.trim() }),
      });
      setComment("");
      const held = rows[0]?.status === "pending";
      setMessage(held ? t("Your comment was held for medical-safety review.", "تم تعليق تعليقك لمراجعة السلامة الطبية.") : t("Comment published.", "تم نشر التعليق."));
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : t("Could not add your comment.", "تعذر إضافة تعليقك.")); }
    finally { setBusy(null); }
  }

  async function submitObservation(event: React.FormEvent) {
    event.preventDefault();
    if (!canonicalId || !requireAccount() || !session?.user?.id) return;
    setBusy("observation"); setError(null); setMessage(null);
    try {
      await supabaseFetch("/rest/v1/medicine_community_observations", {
        method: "POST",
        body: JSON.stringify({
          canonical_id: canonicalId,
          user_id: session.user.id,
          observation_type: observation.type,
          title: observation.title.trim(),
          description: observation.description.trim(),
          severity: observation.severity,
          onset_timing: observation.onset.trim() || null,
          evidence_urls: observation.evidence.split(/[\n,]/).map((value) => value.trim()).filter(Boolean),
        }),
      });
      setObservation({ type: "side_effect", title: "", description: "", severity: "unknown", onset: "", evidence: "" });
      setMessage(t("Your experience report was submitted for safety review. It is not treated as established medical evidence.", "تم إرسال تقرير تجربتك لمراجعة السلامة، ولا يُعامل كدليل طبي مثبت."));
    } catch (cause) { setError(cause instanceof Error ? cause.message : t("Could not submit the experience report.", "تعذر إرسال تقرير التجربة.")); }
    finally { setBusy(null); }
  }

  async function sendCompanyMessage(event: React.FormEvent) {
    event.preventDefault();
    if (!companySlug || !requireAccount() || !session?.user?.id) return;
    setBusy("company-message"); setError(null); setMessage(null);
    try {
      await supabaseFetch("/rest/v1/company_profile_messages", {
        method: "POST",
        body: JSON.stringify({ company_slug: companySlug, sender_user_id: session.user.id, subject: companyMessage.subject.trim(), body: companyMessage.body.trim() }),
      });
      setCompanyMessage({ subject: "", body: "" });
      setMessage(t("Your message was sent to the verified company workspace when one is available, and remains visible to platform administrators for accountability.", "تم إرسال رسالتك إلى مساحة الشركة الموثقة عند توفرها، وتظل مرئية لمسؤولي المنصة للمساءلة."));
    } catch (cause) { setError(cause instanceof Error ? cause.message : t("Could not send the company message.", "تعذر إرسال رسالة الشركة.")); }
    finally { setBusy(null); }
  }

  async function submitReport(targetKey: string) {
    if (!requireAccount() || !session?.user?.id) return;
    setBusy(`report-${targetKey}`); setError(null); setMessage(null);
    try {
      await supabaseFetch("/rest/v1/public_entity_reports", {
        method: "POST",
        body: JSON.stringify({ reporter_user_id: session.user.id, entity_type: targetKey === safeKey ? entityType : "comment", entity_key: targetKey, reason: "unsafe_medical_claim", details: reportDetails.trim() || null }),
      });
      setReporting(null); setReportDetails("");
      setMessage(t("Report submitted for moderator review.", "تم إرسال البلاغ لمراجعة المشرف."));
    } catch (cause) { setError(cause instanceof Error ? cause.message : t("Could not submit the report.", "تعذر إرسال البلاغ.")); }
    finally { setBusy(null); }
  }

  return <section className="mt-10" aria-labelledby={`${entityType}-community-title`}>
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="text-sm font-semibold uppercase tracking-wide text-primary">{t("Community and collaboration", "المجتمع والتعاون")}</p><h2 id={`${entityType}-community-title`} className="mt-2 text-3xl font-bold">{t(`Interact with ${title}`, `تفاعل مع ${title}`)}</h2></div>
      <Button variant="ghost" size="sm" onClick={() => setReporting(safeKey)}><ShieldAlert className="mr-2 h-4 w-4" />{t("Report page", "الإبلاغ عن الصفحة")}</Button>
    </div>

    <div className="mt-4 flex flex-wrap gap-2">
      <Button variant={liked ? "default" : "outline"} onClick={() => void toggleReaction("like")} disabled={busy === "like"}><Heart className={`mr-2 h-4 w-4 ${liked ? "fill-current" : ""}`} />{t("Like", "إعجاب")} · {Number(summary.like_count).toLocaleString()}</Button>
      <Button variant={helpful ? "default" : "outline"} onClick={() => void toggleReaction("helpful")} disabled={busy === "helpful"}><ThumbsUp className="mr-2 h-4 w-4" />{t("Helpful", "مفيد")} · {Number(summary.helpful_count).toLocaleString()}</Button>
      <Button variant={favorite ? "default" : "outline"} onClick={() => void toggleFavorite()} disabled={busy === "favorite"}><Bookmark className={`mr-2 h-4 w-4 ${favorite ? "fill-current" : ""}`} />{t("Favorite", "مفضلة")} · {Number(summary.favorite_count).toLocaleString()}</Button>
      <Badge variant="secondary" className="px-3"><MessageCircle className="mr-2 h-4 w-4" />{Number(summary.comment_count).toLocaleString()} {t("comments", "تعليق")}</Badge>
    </div>

    {error && <Alert variant="destructive" className="mt-4"><AlertTriangle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
    {message && <Alert className="mt-4"><AlertDescription>{message}</AlertDescription></Alert>}

    {reporting && <Card className="mt-4 border-destructive/30"><CardHeader><CardTitle className="text-lg">{t("Report unsafe or misleading content", "الإبلاغ عن محتوى غير آمن أو مضلل")}</CardTitle></CardHeader><CardContent><Textarea value={reportDetails} onChange={(event) => setReportDetails(event.target.value)} placeholder={t("Explain the concern for the moderation team.", "اشرح سبب القلق لفريق الإشراف.")} /><div className="mt-3 flex gap-2"><Button variant="destructive" onClick={() => void submitReport(reporting)} disabled={busy === `report-${reporting}`}>{t("Submit report", "إرسال البلاغ")}</Button><Button variant="outline" onClick={() => setReporting(null)}>{t("Cancel", "إلغاء")}</Button></div></CardContent></Card>}

    <div className="mt-6 grid gap-6 xl:grid-cols-[.9fr_1.1fr]">
      <Card><CardHeader><CardTitle>{t("Join the discussion", "شارك في النقاش")}</CardTitle></CardHeader><CardContent>
        {isAuthenticated ? <form onSubmit={submitComment} className="space-y-3"><Textarea value={comment} onChange={(event) => setComment(event.target.value)} maxLength={2000} placeholder={t("Add a respectful, useful comment. Do not post prescriptions or tell others to change treatment.", "أضف تعليقًا محترمًا ومفيدًا. لا تنشر وصفات أو تطلب من الآخرين تغيير العلاج.")} /><Button type="submit" disabled={busy === "comment" || comment.trim().length < 2}><Send className="mr-2 h-4 w-4" />{t("Post comment", "نشر التعليق")}</Button></form> : <div><p className="text-sm text-muted-foreground">{t("Sign in to comment, react, favorite, report, or message a company.", "سجل الدخول للتعليق أو التفاعل أو الإضافة للمفضلة أو الإبلاغ أو مراسلة شركة.")}</p><Button asChild className="mt-3"><a href="/account">{t("Sign in", "تسجيل الدخول")}</a></Button></div>}
        <div className="mt-5 space-y-3">{comments.map((row) => <div key={row.id} className="rounded-xl border p-4"><div className="flex items-start justify-between gap-3"><div><div className="font-semibold">{row.author_name}</div><div className="text-xs text-muted-foreground">{new Date(row.created_at).toLocaleString()}</div></div><Button variant="ghost" size="sm" onClick={() => setReporting(row.id)}>{t("Report", "إبلاغ")}</Button></div><p className="mt-3 whitespace-pre-wrap text-sm leading-6">{row.body}</p></div>)}{comments.length === 0 && <p className="text-sm text-muted-foreground">{t("No public comments yet.", "لا توجد تعليقات عامة حتى الآن.")}</p>}</div>
      </CardContent></Card>

      <div className="space-y-6">
        {entityType === "medicine" && canonicalId && <Card className="border-amber-300/50"><CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-600" />{t("Report an observed effect", "أبلغ عن تأثير مرصود")}</CardTitle></CardHeader><CardContent>
          <Alert className="mb-4"><AlertDescription>{t("Community reports are experiences, not proof of benefit, causation, safety, or suitability. Severe or life-threatening symptoms require urgent professional or emergency care, not a website report.", "تقارير المجتمع تجارب وليست دليلًا على الفائدة أو السببية أو الأمان أو الملاءمة. الأعراض الشديدة أو المهددة للحياة تحتاج رعاية مهنية أو طارئة فورًا، وليس مجرد بلاغ على الموقع.")}</AlertDescription></Alert>
          {isAuthenticated ? <form onSubmit={submitObservation} className="space-y-3"><div><Label>{t("Observation type", "نوع الملاحظة")}</Label><select className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={observation.type} onChange={(event) => setObservation({ ...observation, type: event.target.value })}>{observationTypes.map((value) => <option key={value} value={value}>{humanize(value)}</option>)}</select></div><Input value={observation.title} onChange={(event) => setObservation({ ...observation, title: event.target.value })} placeholder={t("Brief title", "عنوان مختصر")} required minLength={3} maxLength={180} /><Textarea value={observation.description} onChange={(event) => setObservation({ ...observation, description: event.target.value })} placeholder={t("Describe what happened, without presenting it as a confirmed medical fact.", "صف ما حدث دون تقديمه كحقيقة طبية مؤكدة.")} required minLength={10} maxLength={4000} /><div className="grid gap-3 sm:grid-cols-2"><div><Label>{t("Severity", "الشدة")}</Label><select className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={observation.severity} onChange={(event) => setObservation({ ...observation, severity: event.target.value })}>{severities.map((value) => <option key={value} value={value}>{humanize(value)}</option>)}</select></div><div><Label>{t("When it started", "متى بدأ")}</Label><Input value={observation.onset} onChange={(event) => setObservation({ ...observation, onset: event.target.value })} placeholder={t("Optional", "اختياري")} /></div></div><Textarea value={observation.evidence} onChange={(event) => setObservation({ ...observation, evidence: event.target.value })} placeholder={t("Evidence or reference URLs, one per line (optional)", "روابط الأدلة أو المراجع، رابط بكل سطر (اختياري)")} /><Button type="submit" disabled={busy === "observation" || observation.title.trim().length < 3 || observation.description.trim().length < 10}>{t("Submit for safety review", "إرسال لمراجعة السلامة")}</Button></form> : <p className="text-sm text-muted-foreground">{t("Sign in to submit an experience report.", "سجل الدخول لإرسال تقرير تجربة.")}</p>}
          {observations.length > 0 && <div className="mt-6"><h3 className="font-semibold">{t("Approved community observations", "ملاحظات المجتمع المعتمدة")}</h3><div className="mt-3 space-y-3">{observations.map((row) => <div key={row.id} className="rounded-xl border p-4"><div className="flex flex-wrap gap-2"><Badge>{humanize(row.observation_type)}</Badge>{row.severity && <Badge variant="outline">{humanize(row.severity)}</Badge>}</div><div className="mt-2 font-semibold">{row.title}</div><p className="mt-2 text-sm leading-6 text-muted-foreground">{row.description}</p><div className="mt-2 text-xs text-muted-foreground">{row.author_name} · {new Date(row.created_at).toLocaleDateString()}</div></div>)}</div></div>}
        </CardContent></Card>}

        {entityType === "company" && companySlug && <Card><CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" />{t("Message this company", "راسل هذه الشركة")}</CardTitle></CardHeader><CardContent>{isAuthenticated ? <form onSubmit={sendCompanyMessage} className="space-y-3"><Input value={companyMessage.subject} onChange={(event) => setCompanyMessage({ ...companyMessage, subject: event.target.value })} placeholder={t("Subject", "الموضوع")} required minLength={3} /><Textarea value={companyMessage.body} onChange={(event) => setCompanyMessage({ ...companyMessage, body: event.target.value })} placeholder={t("Partnership, product, support, correction, procurement, or general inquiry", "استفسار شراكة أو منتج أو دعم أو تصحيح أو مشتريات أو استفسار عام")} required minLength={5} /><Button type="submit" disabled={busy === "company-message" || companyMessage.subject.trim().length < 3 || companyMessage.body.trim().length < 5}><Send className="mr-2 h-4 w-4" />{t("Send message", "إرسال الرسالة")}</Button></form> : <p className="text-sm text-muted-foreground">{t("Sign in to send an accountable message to this company.", "سجل الدخول لإرسال رسالة موثقة إلى هذه الشركة.")}</p>}</CardContent></Card>}
      </div>
    </div>
  </section>;
}
