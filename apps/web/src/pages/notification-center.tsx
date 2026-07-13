import { useEffect, useState } from "react";
import { Bell, BellRing, Check, ExternalLink } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/lib/i18n";
import { usePatientAuth } from "@/lib/patient-auth";

type Broadcast = { id:string; title:string; body:string; target_url:string|null; notification_topic:string; icon_url:string|null; image_url:string|null; completed_at:string };
type PersonalNotification = { id:string; title:string; body:string; target_url:string|null; notification_topic:string; read_at:string|null; created_at:string };
type Preferences = { platform_updates:boolean; medicine_updates:boolean; company_updates:boolean; marketplace_updates:boolean; learning_updates:boolean; favorite_updates:boolean };
const preferenceLabels: Array<[keyof Preferences,string,string]> = [
  ["platform_updates","Platform announcements","إعلانات المنصة"], ["medicine_updates","Medicines and safety updates","تحديثات الأدوية والسلامة"],
  ["company_updates","Company and portfolio updates","تحديثات الشركات والمحافظ"], ["marketplace_updates","Marketplace updates","تحديثات السوق"],
  ["learning_updates","Learning updates","تحديثات التعلم"], ["favorite_updates","Updates about favorites","تحديثات المفضلة"],
];
const defaults: Preferences = { platform_updates:true, medicine_updates:true, company_updates:true, marketplace_updates:true, learning_updates:true, favorite_updates:true };
const humanize = (value:string) => value.replaceAll("_"," ").replace(/\b\w/g, letter => letter.toUpperCase());

export default function NotificationCenter() {
  const { t } = useLanguage();
  const { session, isAuthenticated, supabaseFetch } = usePatientAuth();
  const [broadcasts,setBroadcasts]=useState<Broadcast[]>([]);
  const [personal,setPersonal]=useState<PersonalNotification[]>([]);
  const [preferences,setPreferences]=useState<Preferences>(defaults);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState<string|null>(null);
  const [error,setError]=useState<string|null>(null);

  async function load() {
    setLoading(true); setError(null);
    try {
      const broadcastRows = await supabaseFetch<Broadcast[]>("/rest/v1/rpc/recent_platform_notifications",{method:"POST",body:JSON.stringify({p_limit:50})});
      setBroadcasts(Array.isArray(broadcastRows)?broadcastRows:[]);
      if (session?.user?.id) {
        const [personalRows,preferenceRows]=await Promise.all([
          supabaseFetch<PersonalNotification[]>("/rest/v1/user_notifications?select=id,title,body,target_url,notification_topic,read_at,created_at&order=created_at.desc&limit=100"),
          supabaseFetch<Preferences[]>(`/rest/v1/notification_preferences?select=platform_updates,medicine_updates,company_updates,marketplace_updates,learning_updates,favorite_updates&user_id=eq.${session.user.id}&limit=1`),
        ]);
        setPersonal(Array.isArray(personalRows)?personalRows:[]); setPreferences(preferenceRows[0]||defaults);
      }
    } catch(cause) { setError(cause instanceof Error?cause.message:t("Could not load notifications.","تعذر تحميل الإشعارات.")); }
    finally { setLoading(false); }
  }
  useEffect(()=>{void load();},[session?.user?.id]);

  async function savePreferences(next:Preferences) {
    if(!session?.user?.id)return; setPreferences(next); setSaving(true); setMessage(null); setError(null);
    try {
      await supabaseFetch("/rest/v1/notification_preferences",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify({user_id:session.user.id,...next,locale:navigator.language})});
      const topics = preferenceLabels.filter(([key]) => next[key]).map(([key]) => key);
      await supabaseFetch(`/rest/v1/push_subscriptions?user_id=eq.${session.user.id}`,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({topics,is_enabled:topics.length>0,updated_at:new Date().toISOString()})});
      setMessage(t("Notification preferences saved.","تم حفظ تفضيلات الإشعارات."));
    }
    catch(cause){setError(cause instanceof Error?cause.message:t("Could not save preferences.","تعذر حفظ التفضيلات."));}
    finally{setSaving(false);}
  }
  async function markRead(id:string){await supabaseFetch(`/rest/v1/user_notifications?id=eq.${id}`,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({read_at:new Date().toISOString()})});setPersonal(rows=>rows.map(row=>row.id===id?{...row,read_at:new Date().toISOString()}:row));}

  return <main className="container mx-auto max-w-6xl px-4 py-8">
    <section className="rounded-3xl border bg-card p-6 shadow-sm md:p-8"><p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-primary"><BellRing className="h-4 w-4" />{t("Platform notification center","مركز إشعارات المنصة")}</p><h1 className="mt-3 text-3xl font-bold tracking-tight">{t("Updates you control","تحديثات تحت تحكمك")}</h1><p className="mt-3 max-w-3xl text-muted-foreground">{t("Review admin announcements, medicine and company updates, and choose which subjects can reach your installed app.","راجع إعلانات الإدارة وتحديثات الأدوية والشركات واختر الموضوعات التي تصل إلى التطبيق المثبت.")}</p></section>
    {error&&<Alert variant="destructive" className="mt-5"><AlertDescription>{error}</AlertDescription></Alert>}{message&&<Alert className="mt-5"><Check className="h-4 w-4"/><AlertDescription>{message}</AlertDescription></Alert>}
    {isAuthenticated&&<section className="mt-6 rounded-2xl border bg-card p-5"><h2 className="text-xl font-semibold">{t("Notification preferences","تفضيلات الإشعارات")}</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">{preferenceLabels.map(([key,en,ar])=><label key={key} className="flex items-center justify-between gap-3 rounded-xl border p-3 text-sm font-medium"><span>{t(en,ar)}</span><input type="checkbox" checked={preferences[key]} disabled={saving} onChange={event=>void savePreferences({...preferences,[key]:event.target.checked})}/></label>)}</div></section>}
    {!isAuthenticated&&<Alert className="mt-6"><Bell className="h-4 w-4"/><AlertDescription>{t("Sign in to manage personal notification topics and read status. Public admin announcements remain available below.","سجل الدخول لإدارة موضوعات الإشعارات الشخصية وحالة القراءة. تظل إعلانات الإدارة العامة متاحة أدناه.")}</AlertDescription></Alert>}
    {personal.length>0&&<section className="mt-8"><h2 className="text-2xl font-bold">{t("For you","لك")}</h2><div className="mt-4 space-y-3">{personal.map(item=><NotificationCard key={item.id} item={item} t={t} onRead={()=>void markRead(item.id)}/>)}</div></section>}
    <section className="mt-8"><h2 className="text-2xl font-bold">{t("Recent platform announcements","أحدث إعلانات المنصة")}</h2>{loading?<p className="mt-4 text-sm text-muted-foreground">{t("Loading updates...","جاري تحميل التحديثات...")}</p>:<div className="mt-4 grid gap-4 md:grid-cols-2">{broadcasts.map(item=><Card key={item.id}><CardHeader><div className="flex items-start justify-between gap-3"><CardTitle className="text-lg">{item.title}</CardTitle><Badge variant="outline">{humanize(item.notification_topic)}</Badge></div></CardHeader><CardContent><p className="text-sm leading-6 text-muted-foreground">{item.body}</p><div className="mt-4 flex items-center justify-between gap-3 text-xs text-muted-foreground"><span>{new Date(item.completed_at).toLocaleString()}</span>{item.target_url&&<a href={item.target_url} className="inline-flex items-center font-semibold text-primary">{t("Open update","فتح التحديث")}<ExternalLink className="ml-1 h-3.5 w-3.5"/></a>}</div></CardContent></Card>)}{broadcasts.length===0&&<Card><CardContent className="p-6 text-sm text-muted-foreground">{t("No public announcements have been sent yet.","لم يتم إرسال إعلانات عامة بعد.")}</CardContent></Card>}</div>}</section>
  </main>;
}

function NotificationCard({item,t,onRead}:{item:PersonalNotification;t:(en:string,ar:string)=>string;onRead:()=>void}){return <Card className={item.read_at?"":"border-primary/40"}><CardContent className="p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h3 className="font-semibold">{item.title}</h3>{!item.read_at&&<Badge>{t("New","جديد")}</Badge>}</div><p className="mt-2 text-sm leading-6 text-muted-foreground">{item.body}</p><p className="mt-2 text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString()}</p></div><div className="flex gap-2">{!item.read_at&&<Button size="sm" variant="outline" onClick={onRead}>{t("Mark read","تحديد كمقروء")}</Button>}{item.target_url&&<Button asChild size="sm"><a href={item.target_url}>{t("Open","فتح")}</a></Button>}</div></div></CardContent></Card>}
