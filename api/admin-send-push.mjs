import { sendWebPush } from "./_lib/web-push.mjs";

const json=(response,status,body)=>{response.statusCode=status;response.setHeader("Content-Type","application/json; charset=utf-8");response.setHeader("Cache-Control","private, no-store");response.end(JSON.stringify(body));};
const privatePath=(value)=>/^\/(admin|workspace|dashboard|account|portal|login|track|pharmacy|reviewer|physician|employee|clinical-assistant)(\/|$)/i.test(String(value||""));

function config(){
  const url=String(process.env.VITE_SUPABASE_URL||"").replace(/\/+$/g,"");
  const publicKey=String(process.env.VITE_SUPABASE_PUBLISHABLE_KEY||"");
  const serviceKey=String(process.env.SUPABASE_SERVICE_ROLE_KEY||"");
  if(!url||!publicKey||!serviceKey)throw new Error("Supabase server configuration is incomplete.");
  return{url,publicKey,serviceKey};
}
async function rest(path,key,init={}){
  const {url}=config();
  const response=await fetch(`${url}${path}`,{...init,headers:{apikey:key,Authorization:`Bearer ${key}`,"Content-Type":"application/json",Accept:"application/json",...(init.headers||{})}});
  const text=await response.text();const data=text?JSON.parse(text):null;
  if(!response.ok)throw new Error(data?.message||data?.error||`Supabase HTTP ${response.status}`);
  return data;
}
async function authorize(request){
  const authorization=String(request.headers.authorization||"");const {url,publicKey}=config();
  if(!authorization.startsWith("Bearer "))throw new Error("Authenticated platform-admin session required.");
  const userResponse=await fetch(`${url}/auth/v1/user`,{headers:{apikey:publicKey,Authorization:authorization}});
  if(!userResponse.ok)throw new Error("Session is invalid or expired.");
  const user=await userResponse.json();
  const profileResponse=await fetch(`${url}/rest/v1/profiles?select=role,is_active&id=eq.${encodeURIComponent(user.id)}&limit=1`,{headers:{apikey:publicKey,Authorization:authorization}});
  const profiles=await profileResponse.json();const profile=Array.isArray(profiles)?profiles[0]:null;
  if(!profile?.is_active||!["admin","platform_admin","super_admin"].includes(profile.role))throw new Error("Platform-admin access required.");
  return user;
}
function preferenceAllows(preference,topic){return preference?.[topic]!==false;}

export default async function handler(request,response){
  if(request.method!=="POST")return json(response,405,{message:"POST required."});
  try{
    await authorize(request);
    const body=typeof request.body==="string"?JSON.parse(request.body||"{}"):request.body||{};
    const campaignId=String(body.campaign_id||"").trim();
    if(!campaignId)return json(response,400,{message:"campaign_id is required."});
    const {serviceKey}=config();
    const campaigns=await rest(`/rest/v1/notification_campaigns?select=*&id=eq.${encodeURIComponent(campaignId)}&limit=1`,serviceKey);
    const campaign=Array.isArray(campaigns)?campaigns[0]:null;
    if(!campaign)return json(response,404,{message:"Notification campaign not found."});
    if(!["draft","scheduled","failed"].includes(campaign.status))return json(response,409,{message:`Campaign cannot be sent from status ${campaign.status}.`});
    if(privatePath(campaign.target_url))return json(response,400,{message:"Push campaigns cannot link directly to protected workspaces or health-record routes."});
    if(campaign.data?.contains_protected_health_information===true)return json(response,400,{message:"Protected health information is not allowed in push notifications."});

    await rest(`/rest/v1/notification_campaigns?id=eq.${campaign.id}`,serviceKey,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({status:"sending",started_at:new Date().toISOString(),attempted_count:0,delivered_count:0,failed_count:0})});
    const subscriptions=await rest("/rest/v1/push_subscriptions?select=id,user_id,endpoint,p256dh,auth_key,topics,is_enabled&is_enabled=eq.true&limit=5000",serviceKey);
    const preferences=await rest("/rest/v1/notification_preferences?select=*&limit=5000",serviceKey);
    const preferenceByUser=new Map((Array.isArray(preferences)?preferences:[]).map((row)=>[row.user_id,row]));
    let allowedUsers=null;
    if(campaign.audience_type==="users")allowedUsers=new Set(campaign.audience_values||[]);
    if(campaign.audience_type==="role"){
      const roles=(campaign.audience_values||[]).map(String).filter(Boolean);
      const rows=roles.length?await rest(`/rest/v1/profiles?select=id&role=in.(${roles.map(encodeURIComponent).join(",")})&is_active=eq.true&limit=5000`,serviceKey):[];
      allowedUsers=new Set((Array.isArray(rows)?rows:[]).map((row)=>row.id));
    }
    const requiredTopic=campaign.audience_type==="medicine"?`medicine:${campaign.audience_values?.[0]||""}`:campaign.audience_type==="company"?`company:${campaign.audience_values?.[0]||""}`:campaign.audience_type==="topic"?String(campaign.audience_values?.[0]||campaign.notification_topic):null;
    const selected=(Array.isArray(subscriptions)?subscriptions:[]).filter((subscription)=>{
      if(allowedUsers&&!allowedUsers.has(subscription.user_id))return false;
      if(requiredTopic&&!Array.isArray(subscription.topics)||requiredTopic&&!subscription.topics.includes(requiredTopic))return false;
      return preferenceAllows(preferenceByUser.get(subscription.user_id),campaign.notification_topic);
    });
    const uniqueUsers=[...new Set(selected.map((row)=>row.user_id))];
    if(uniqueUsers.length){
      await rest("/rest/v1/user_notifications",serviceKey,{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify(uniqueUsers.map((userId)=>({user_id:userId,campaign_id:campaign.id,title:campaign.title,body:campaign.body,target_url:campaign.target_url,notification_topic:campaign.notification_topic,entity_type:campaign.audience_type==="medicine"?"medicine":campaign.audience_type==="company"?"company":null,entity_key:["medicine","company"].includes(campaign.audience_type)?String(campaign.audience_values?.[0]||""):null}))) });
    }

    let delivered=0,failed=0;
    for(const subscription of selected){
      try{
        const pushResponse=await sendWebPush(subscription,{title:campaign.title,body:campaign.body,url:campaign.target_url||"/",icon:campaign.icon_url||"/favicon.svg",image:campaign.image_url||undefined,tag:`campaign-${campaign.id}`,campaign_id:campaign.id});
        if(pushResponse.ok){delivered+=1;await rest("/rest/v1/notification_deliveries",serviceKey,{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify({campaign_id:campaign.id,user_id:subscription.user_id,subscription_id:subscription.id,status:"sent",provider_status:pushResponse.status,sent_at:new Date().toISOString()})});await rest(`/rest/v1/push_subscriptions?id=eq.${subscription.id}`,serviceKey,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({failure_count:0,last_success_at:new Date().toISOString()})});}
        else{failed+=1;const expired=[404,410].includes(pushResponse.status);await rest("/rest/v1/notification_deliveries",serviceKey,{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify({campaign_id:campaign.id,user_id:subscription.user_id,subscription_id:subscription.id,status:expired?"expired":"failed",provider_status:pushResponse.status,failure_reason:`Push provider HTTP ${pushResponse.status}`})});await rest(`/rest/v1/push_subscriptions?id=eq.${subscription.id}`,serviceKey,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({is_enabled:expired?false:true,failure_count:Number(subscription.failure_count||0)+1})});}
      }catch(error){failed+=1;await rest("/rest/v1/notification_deliveries",serviceKey,{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify({campaign_id:campaign.id,user_id:subscription.user_id,subscription_id:subscription.id,status:"failed",failure_reason:String(error?.message||"Push delivery failed").slice(0,500)})});}
    }
    const status=failed>0&&delivered===0?"failed":"sent";
    await rest(`/rest/v1/notification_campaigns?id=eq.${campaign.id}`,serviceKey,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({status,completed_at:new Date().toISOString(),attempted_count:selected.length,delivered_count:delivered,failed_count:failed})});
    return json(response,200,{campaign_id:campaign.id,status,attempted:selected.length,delivered,failed});
  }catch(error){console.error("admin-send-push",error);return json(response,/admin|session|authorized/i.test(String(error?.message))?403:500,{message:String(error?.message||"Push campaign failed safely.")});}
}
