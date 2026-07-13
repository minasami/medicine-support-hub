import { useEffect, useMemo, useState } from "react";
import { Bell, BellRing, Check, Download, Settings2, Smartphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useLanguage } from "@/lib/i18n";
import { usePatientAuth } from "@/lib/patient-auth";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

type RecentNotification = {
  id: string;
  title: string;
  body: string;
  target_url: string;
  notification_topic: string;
  icon_url: string | null;
  image_url: string | null;
  completed_at: string;
};

const TOPICS = [
  ["platform_updates", "Platform news", "أخبار المنصة"],
  ["medicine_updates", "Medicine updates", "تحديثات الأدوية"],
  ["company_updates", "Company updates", "تحديثات الشركات"],
  ["marketplace_updates", "Marketplace updates", "تحديثات السوق"],
  ["learning_updates", "Learning updates", "تحديثات التعلم"],
  ["favorite_updates", "My favorites", "مفضلاتي"],
] as const;

const INSTALL_DISMISS_KEY = "msh_pwa_install_dismissed_at";
const NOTICE_DISMISS_KEY = "msh_push_prompt_dismissed_at";
const DEVICE_KEY = "msh_push_device_id";
const READ_KEY = "msh_read_notification_ids";
const TWO_WEEKS = 14 * 24 * 60 * 60 * 1000;

function dismissedRecently(key: string) {
  const value = Number(localStorage.getItem(key) || 0);
  return value > 0 && Date.now() - value < TWO_WEEKS;
}

function getDeviceId() {
  const existing = localStorage.getItem(DEVICE_KEY);
  if (existing) return existing;
  const created = globalThis.crypto?.randomUUID?.() || `00000000-0000-4000-8000-${Math.random().toString(16).slice(2).padEnd(12, "0").slice(0, 12)}`;
  localStorage.setItem(DEVICE_KEY, created);
  return created;
}

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function PwaExperience() {
  const { t, language } = useLanguage();
  const { supabaseFetch } = usePatientAuth();
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showInstall, setShowInstall] = useState(false);
  const [showCenter, setShowCenter] = useState(false);
  const [showTopics, setShowTopics] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() => typeof Notification === "undefined" ? "denied" : Notification.permission);
  const [subscribed, setSubscribed] = useState(false);
  const [topics, setTopics] = useState<string[]>(["platform_updates", "medicine_updates", "company_updates"]);
  const [notifications, setNotifications] = useState<RecentNotification[]>([]);
  const [readIds, setReadIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(READ_KEY) || "[]"); } catch { return []; }
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const unread = useMemo(() => notifications.filter((notification) => !readIds.includes(notification.id)).length, [notifications, readIds]);

  useEffect(() => {
    setInstalled(isStandalone());
    const onInstall = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      if (!dismissedRecently(INSTALL_DISMISS_KEY)) setTimeout(() => setShowInstall(true), 1800);
    };
    const onInstalled = () => {
      setInstalled(true);
      setShowInstall(false);
      setInstallEvent(null);
    };
    window.addEventListener("beforeinstallprompt", onInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  useEffect(() => {
    async function hydrate() {
      try {
        const rows = await supabaseFetch<RecentNotification[]>("/rest/v1/rpc/recent_platform_notifications", {
          method: "POST",
          body: JSON.stringify({ p_limit: 30 }),
        });
        setNotifications(Array.isArray(rows) ? rows : []);
      } catch {
        setNotifications([]);
      }
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
      try {
        const registration = await navigator.serviceWorker.ready;
        const current = await registration.pushManager.getSubscription();
        setSubscribed(Boolean(current));
      } catch {
        setSubscribed(false);
      }
    }
    void hydrate();
  }, []);

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "accepted") {
      setShowInstall(false);
    } else {
      dismissInstall();
    }
  }

  function dismissInstall() {
    localStorage.setItem(INSTALL_DISMISS_KEY, String(Date.now()));
    setShowInstall(false);
  }

  async function enableNotifications(nextTopics = topics) {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || typeof Notification === "undefined") {
      setMessage(t("Push notifications are not supported by this browser.", "هذا المتصفح لا يدعم الإشعارات الفورية."));
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission !== "granted") {
        localStorage.setItem(NOTICE_DISMISS_KEY, String(Date.now()));
        throw new Error(t("Notification permission was not granted.", "لم يتم منح إذن الإشعارات."));
      }
      const settings = await supabaseFetch<Array<{ value: string }>>("/rest/v1/platform_public_settings?select=value&key=eq.web_push_vapid_public_key&limit=1");
      const publicKey = settings[0]?.value;
      if (!publicKey) throw new Error(t("Push configuration is unavailable.", "إعداد الإشعارات غير متاح."));
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
      }
      const serialized = subscription.toJSON();
      if (!serialized.endpoint || !serialized.keys?.p256dh || !serialized.keys?.auth) throw new Error(t("The browser returned an incomplete subscription.", "أعاد المتصفح اشتراكًا غير مكتمل."));
      await supabaseFetch("/rest/v1/rpc/register_push_subscription", {
        method: "POST",
        body: JSON.stringify({
          p_device_id: getDeviceId(),
          p_endpoint: serialized.endpoint,
          p_p256dh: serialized.keys.p256dh,
          p_auth_key: serialized.keys.auth,
          p_topics: nextTopics,
          p_locale: language,
          p_user_agent: navigator.userAgent,
          p_platform: (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform || navigator.platform || null,
        }),
      });
      setSubscribed(true);
      setTopics(nextTopics);
      setShowTopics(false);
      setMessage(t("Notifications are enabled for this device.", "تم تفعيل الإشعارات لهذا الجهاز."));
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : t("Could not enable notifications.", "تعذر تفعيل الإشعارات."));
    } finally {
      setBusy(false);
    }
  }

  async function disableNotifications() {
    setBusy(true);
    setMessage(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await supabaseFetch("/rest/v1/rpc/unregister_push_subscription", {
          method: "POST",
          body: JSON.stringify({ p_device_id: getDeviceId(), p_endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setSubscribed(false);
      setMessage(t("Notifications are disabled on this device.", "تم إيقاف الإشعارات على هذا الجهاز."));
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : t("Could not disable notifications.", "تعذر إيقاف الإشعارات."));
    } finally {
      setBusy(false);
    }
  }

  function openNotification(notification: RecentNotification) {
    const next = [...new Set([...readIds, notification.id])].slice(-200);
    setReadIds(next);
    localStorage.setItem(READ_KEY, JSON.stringify(next));
    window.location.assign(notification.target_url || "/");
  }

  function toggleTopic(topic: string) {
    setTopics((current) => current.includes(topic) ? current.filter((value) => value !== topic) : [...current, topic]);
  }

  return <>
    {showInstall && !installed && installEvent && <Card className="fixed bottom-5 left-5 z-[85] w-[calc(100vw-2.5rem)] max-w-sm border-primary/30 shadow-2xl">
      <CardHeader className="pb-3"><div className="flex items-start justify-between gap-4"><CardTitle className="flex items-center gap-2 text-lg"><Smartphone className="h-5 w-5 text-primary" />{t("Install Medicine Support Hub", "ثبّت منصة دعم الدواء")}</CardTitle><button onClick={dismissInstall} aria-label={t("Dismiss install prompt", "إغلاق طلب التثبيت")}><X className="h-4 w-4 text-muted-foreground" /></button></div></CardHeader>
      <CardContent><p className="text-sm leading-6 text-muted-foreground">{t("Use the platform like an app, open it from your home screen, and keep previously viewed resources available when the connection is unstable.", "استخدم المنصة كتطبيق وافتحها من الشاشة الرئيسية واحتفظ بالموارد التي فتحتها سابقًا عند ضعف الاتصال.")}</p><div className="mt-4 flex gap-2"><Button onClick={() => void install()}><Download className="mr-2 h-4 w-4" />{t("Install app", "تثبيت التطبيق")}</Button><Button variant="outline" onClick={dismissInstall}>{t("Later", "لاحقًا")}</Button></div></CardContent>
    </Card>}

    <div className="fixed bottom-5 left-5 z-[80] flex flex-col items-start gap-3">
      {showCenter && <Card className="w-[calc(100vw-2.5rem)] max-w-md overflow-hidden shadow-2xl">
        <CardHeader className="border-b bg-card"><div className="flex items-start justify-between gap-4"><div><CardTitle className="flex items-center gap-2"><BellRing className="h-5 w-5 text-primary" />{t("Notifications", "الإشعارات")}</CardTitle><p className="mt-1 text-xs text-muted-foreground">{subscribed ? t("Push enabled on this device", "الإشعارات مفعلة على هذا الجهاز") : t("Receive platform and medicine updates", "استقبل تحديثات المنصة والأدوية")}</p></div><button onClick={() => setShowCenter(false)} aria-label={t("Close notifications", "إغلاق الإشعارات")}><X className="h-4 w-4 text-muted-foreground" /></button></div></CardHeader>
        <CardContent className="max-h-[70vh] overflow-y-auto p-4">
          <div className="flex flex-wrap gap-2">
            {!subscribed ? <Button size="sm" onClick={() => void enableNotifications()} disabled={busy || notificationPermission === "denied"}><Bell className="mr-2 h-4 w-4" />{busy ? t("Enabling…", "جاري التفعيل…") : t("Enable notifications", "تفعيل الإشعارات")}</Button> : <Button size="sm" variant="outline" onClick={() => setShowTopics(!showTopics)}><Settings2 className="mr-2 h-4 w-4" />{t("Notification topics", "موضوعات الإشعارات")}</Button>}
            {subscribed && <Button size="sm" variant="ghost" onClick={() => void disableNotifications()} disabled={busy}>{t("Turn off", "إيقاف")}</Button>}
          </div>
          {notificationPermission === "denied" && <p className="mt-3 text-xs text-destructive">{t("Notifications are blocked in your browser settings.", "الإشعارات محظورة من إعدادات المتصفح.")}</p>}
          {showTopics && <div className="mt-4 rounded-xl border bg-muted/30 p-4"><div className="space-y-3">{TOPICS.map(([value,en,ar]) => <label key={value} className="flex cursor-pointer items-center gap-3 text-sm"><Checkbox checked={topics.includes(value)} onCheckedChange={() => toggleTopic(value)} /><span>{t(en,ar)}</span></label>)}</div><Button className="mt-4" size="sm" onClick={() => void enableNotifications(topics)} disabled={busy || topics.length === 0}><Check className="mr-2 h-4 w-4" />{t("Save topics", "حفظ الموضوعات")}</Button></div>}
          {message && <p className="mt-3 rounded-lg bg-muted p-3 text-xs text-muted-foreground">{message}</p>}
          <div className="mt-5 space-y-2">
            {notifications.map((notification) => <button key={notification.id} onClick={() => openNotification(notification)} className={`block w-full rounded-xl border p-3 text-left transition hover:bg-muted/50 ${readIds.includes(notification.id) ? "opacity-70" : "border-primary/30 bg-primary/5"}`}><div className="flex items-start justify-between gap-3"><div className="font-semibold">{notification.title}</div>{!readIds.includes(notification.id) && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />}</div><p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{notification.body}</p><div className="mt-2 text-xs text-muted-foreground">{new Date(notification.completed_at).toLocaleString()}</div></button>)}
            {notifications.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">{t("No platform notifications yet.", "لا توجد إشعارات للمنصة حتى الآن.")}</p>}
          </div>
        </CardContent>
      </Card>}
      {!showInstall && <button onClick={() => setShowCenter(!showCenter)} className="relative flex h-12 w-12 items-center justify-center rounded-full border bg-card text-foreground shadow-xl transition hover:-translate-y-0.5 hover:bg-muted" aria-label={t("Open notifications", "فتح الإشعارات")}><Bell className="h-5 w-5" />{unread > 0 && <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">{unread > 99 ? "99+" : unread}</span>}</button>}
    </div>
  </>;
}
