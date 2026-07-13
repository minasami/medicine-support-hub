const CACHE_VERSION="msh-public-v1";
const CORE=["/","/offline.html","/manifest.webmanifest","/favicon.svg","/icon-maskable.svg"];
const PRIVATE_PREFIXES=["/admin","/workspace","/dashboard","/account","/portal","/login","/track","/pharmacy","/reviewer","/physician","/employee","/delivery","/branch-manager","/data-entry","/clinical-assistant"];
const isPrivate=(pathname)=>PRIVATE_PREFIXES.some((prefix)=>pathname===prefix||pathname.startsWith(`${prefix}/`));

self.addEventListener("install",(event)=>{event.waitUntil(caches.open(CACHE_VERSION).then((cache)=>cache.addAll(CORE)).then(()=>self.skipWaiting()));});
self.addEventListener("activate",(event)=>{event.waitUntil(caches.keys().then((keys)=>Promise.all(keys.filter((key)=>key!==CACHE_VERSION).map((key)=>caches.delete(key)))).then(()=>self.clients.claim()));});

self.addEventListener("fetch",(event)=>{
  const request=event.request;
  if(request.method!=="GET")return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin||url.pathname.startsWith("/api/")||isPrivate(url.pathname))return;
  if(request.mode==="navigate"){
    event.respondWith(fetch(request).then((response)=>{if(response.ok){const copy=response.clone();caches.open(CACHE_VERSION).then((cache)=>cache.put(request,copy));}return response;}).catch(async()=>await caches.match(request)||await caches.match("/offline.html")));
    return;
  }
  if(url.pathname.startsWith("/assets/")||["style","script","image","font"].includes(request.destination)){
    event.respondWith(caches.match(request).then((cached)=>cached||fetch(request).then((response)=>{if(response.ok){const copy=response.clone();caches.open(CACHE_VERSION).then((cache)=>cache.put(request,copy));}return response;})));
  }
});

self.addEventListener("push",(event)=>{
  let payload={title:"Medicine Support Hub",body:"A new platform update is available.",url:"/",icon:"/favicon.svg"};
  try{if(event.data)payload={...payload,...event.data.json()};}catch{if(event.data)payload.body=event.data.text();}
  const options={body:payload.body,icon:payload.icon||"/favicon.svg",badge:"/favicon.svg",image:payload.image||undefined,tag:payload.tag||`msh-${Date.now()}`,renotify:Boolean(payload.renotify),requireInteraction:Boolean(payload.requireInteraction),data:{url:payload.url||"/",campaign_id:payload.campaign_id||null,notification_id:payload.notification_id||null},actions:Array.isArray(payload.actions)?payload.actions.slice(0,2):[]};
  event.waitUntil(self.registration.showNotification(payload.title||"Medicine Support Hub",options));
});

self.addEventListener("notificationclick",(event)=>{
  event.notification.close();
  const target=new URL(event.notification.data?.url||"/",self.location.origin).href;
  event.waitUntil(self.clients.matchAll({type:"window",includeUncontrolled:true}).then((clients)=>{for(const client of clients){if(client.url===target&&"focus" in client)return client.focus();}return self.clients.openWindow?self.clients.openWindow(target):undefined;}));
});
