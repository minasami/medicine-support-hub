import { useEffect, useMemo, useState } from "react";
import { Bell, Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/lib/i18n";
import { usePatientAuth } from "@/lib/patient-auth";

type InstallPromptEvent=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:"accepted"|"dismissed";platform:string}>};
type PushConfig={enabled:boolean;public_key:string|null;service_worker:string};
const decodeKey=(value:string)=>{const padded=(value+"=".repeat((4-value.length%4)%4)).replace(/-/g,"+").replace(/_/g,"/");const raw=atob(padded);return Uint8Array.from([...raw].map((character)=>character.charCodeAt(0)));};
const standalone=()=>window.matchMedia("(display-mode: standalone)").matches||(navigator as Navigator&{standalone?:boolean}).standalone===true;

export function PwaInstallNotifications(){
  const {t,language}=useLanguage();
  const {session,isAuthenticated,supabaseFetch}=usePatientAuth();
  const [installEvent,setInstallEvent]=useState<InstallPromptEvent|null>(null);
  const [pushConfig,setPushConfig]=useState<PushConfig|null>(null);
  const [installDismissed,setInstallDismissed]=useState(()=>sessionStorage.getItem("msh_install_dismissed")==="1");
  const [notificationDismissed,setNotificationDismissed]=useState(()=>sessionStorage.getItem("msh_push_dismissed")==="1");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState<string|null>(null);
  const notificationPermission=typeof Notification!=="undefined"?Notification.permission:"unsupported";

  useEffect(()=>{
    if("serviceWorker" in navigator)navigator.serviceWorker.register("/sw.js",{scope:"/"}).catch((error)=>console.warn("Service worker registration failed",error));
    const handler=(event:Event)=>{event.preventDefault();setInstallEvent(event as InstallPromptEvent);};
    window.addEventListener("beforeinstallprompt",handler);
    fetch("/api/push-config").then((response)=>response.json()).then(setPushConfig).catch(()=>setPushConfig({enabled:false,public_key:null,service_worker:"/sw.js"}));
    return()=>window.removeEventListener("beforeinstallprompt",handler);
  },[]);

  const showInstall=Boolean(installEvent&&!standalone()&&!installDismissed);
  const showPush=Boolean(isAuthenticated&&pushConfig?.enabled&&notificationPermission==="default"&&!notificationDismissed);
  const show=showInstall||showPush||Boolean(message);
  const topics=useMemo(()=>["platform_updates","medicine_updates","company_updates","marketplace_updates","learning_updates","favorite_updates"],[]);

  async function install(){if(!installEvent)return;setBusy(true);try{await installEvent.prompt();const choice=await installEvent.userChoice;if(choice.outcome==="accepted")setMessage(t("Medicine Support Hub was added to your device.","تمت إضافة منصة دعم الدواء إلى جهازك."));setInstallEvent(null);}finally{setBusy(false);}}
  function dismissInstall(){sessionStorage.setItem("msh_install_dismissed","1");setInstallDismissed(true);}
  function dismissPush(){sessionStorage.setItem("msh_push_dismissed","1");setNotificationDismissed(true);}

  async function enablePush(){
    if(!session?.user?.id||!pushConfig?.public_key||!("serviceWorker" in navigator)||!("PushManager" in window))return;
    setBusy(true);setMessage(null);
    try{
      const permission=await Notification.requestPermission();
      if(permission!=="granted"){dismissPush();setMessage(t("Notifications remain off. You can enable them later in your browser settings.","تظل الإشعارات متوقفة ويمكنك تفعيلها لاحقًا من إعدادات المتصفح."));return;}
      const registration=await navigator.serviceWorker.ready;
      let subscription=await registration.pushManager.getSubscription();
      if(!subscription)subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decodeKey(pushConfig.public_key)});
      const serialized=subscription.toJSON();
      await supabaseFetch("/rest/v1/push_subscriptions?on_conflict=endpoint",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify({user_id:session.user.id,endpoint:subscription.endpoint,p256dh:serialized.keys?.p256dh,auth_key:serialized.keys?.auth,user_agent:navigator.userAgent,locale:language,topics,is_enabled:true,last_seen_at:new Date().toISOString()})});
      await supabaseFetch("/rest/v1/notification_preferences?on_conflict=user_id",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify({user_id:session.user.id,platform_updates:true,medicine_updates:true,company_updates:true,marketplace_updates:true,learning_updates:true,favorite_updates:true,locale:language})});
      setMessage(t("Notifications are enabled. You control topics from your account and browser settings.","تم تفعيل الإشعارات ويمكنك التحكم في الموضوعات من حسابك وإعدادات المتصفح."));setNotificationDismissed(true);
    }catch(error){console.error("push subscription",error);setMessage(t("Notifications could not be enabled on this browser.","تعذر تفعيل الإشعارات على هذا المتصفح."));}
    finally{setBusy(false);}
  }

  if(!show)return null;
  return <div className="fixed bottom-4 left-4 right-4 z-[80] mx-auto max-w-2xl"><Card className="border-primary/30 shadow-2xl"><CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0">{message?<p className="text-sm font-medium">{message}</p>:showInstall?<><div className="flex items-center gap-2 font-semibold"><Download className="h-4 w-4 text-primary"/>{t("Install Medicine Support Hub","ثبّت منصة دعم الدواء")}</div><p className="mt-1 text-sm text-muted-foreground">{t("Open the platform faster and keep selected public resources available when connectivity is limited.","افتح المنصة بسرعة واحتفظ ببعض الموارد العامة عند ضعف الاتصال.")}</p></>:<><div className="flex items-center gap-2 font-semibold"><Bell className="h-4 w-4 text-primary"/>{t("Receive useful platform updates","استلم تحديثات مفيدة من المنصة")}</div><p className="mt-1 text-sm text-muted-foreground">{t("Choose to receive medicine, company, marketplace, learning, and favorite updates. No protected health information is sent in push messages.","اختر استلام تحديثات الأدوية والشركات والسوق والتعلم والمفضلة. لا تُرسل معلومات صحية محمية في الإشعارات.")}</p></>}</div><div className="flex shrink-0 gap-2">{message?<Button size="sm" variant="outline" onClick={()=>setMessage(null)}>{t("Close","إغلاق")}</Button>:showInstall?<><Button size="sm" onClick={()=>void install()} disabled={busy}>{t("Install","تثبيت")}</Button><Button size="icon" variant="ghost" onClick={dismissInstall} aria-label={t("Dismiss install prompt","إخفاء طلب التثبيت")}><X className="h-4 w-4"/></Button></>:<><Button size="sm" onClick={()=>void enablePush()} disabled={busy}>{t("Enable notifications","تفعيل الإشعارات")}</Button><Button size="icon" variant="ghost" onClick={dismissPush} aria-label={t("Dismiss notification prompt","إخفاء طلب الإشعارات")}><X className="h-4 w-4"/></Button></>}</div></CardContent></Card></div>;
}
