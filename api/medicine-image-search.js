const json=(response,status,body)=>{response.statusCode=status;response.setHeader("Content-Type","application/json; charset=utf-8");response.setHeader("Cache-Control","private, no-store");response.end(JSON.stringify(body));};
const domain=value=>{try{return new URL(value).hostname.toLowerCase();}catch{return"";}};
const tokens=value=>String(value||"").toLowerCase().replace(/[^a-z0-9]+/g," ").split(/\s+/).filter(part=>part.length>3);

export default async function handler(request,response){
 if(request.method!=="POST")return json(response,405,{message:"POST required."});
 const authorization=String(request.headers.authorization||"");
 const supabaseUrl=String(process.env.VITE_SUPABASE_URL||"").replace(/\/+$/,"");
 const publishableKey=String(process.env.VITE_SUPABASE_PUBLISHABLE_KEY||"");
 if(!authorization.startsWith("Bearer ")||!supabaseUrl||!publishableKey)return json(response,401,{message:"Authenticated platform-admin session required."});
 try{
  const userResponse=await fetch(`${supabaseUrl}/auth/v1/user`,{headers:{apikey:publishableKey,Authorization:authorization}});
  if(!userResponse.ok)return json(response,401,{message:"Session is invalid or expired."});
  const user=await userResponse.json();
  const profileResponse=await fetch(`${supabaseUrl}/rest/v1/profiles?select=role,is_active&id=eq.${encodeURIComponent(user.id)}&limit=1`,{headers:{apikey:publishableKey,Authorization:authorization}});
  const profiles=await profileResponse.json();
  const profile=Array.isArray(profiles)?profiles[0]:null;
  if(!profile?.is_active||!["admin","platform_admin","super_admin"].includes(profile.role))return json(response,403,{message:"Platform-admin access required."});
  const body=typeof request.body==="string"?JSON.parse(request.body||"{}"):request.body||{};
  const canonicalId=Number(body.canonical_id);
  const productName=String(body.name||"").trim();
  if(!Number.isSafeInteger(canonicalId)||!productName)return json(response,400,{message:"canonical_id and medicine name are required."});
  const phrase=[productName,body.name_ar,body.scientific_name,body.manufacturer,"medicine pack official"].filter(Boolean).join(" ");
  const searchUrls={bing:`https://www.bing.com/images/search?q=${encodeURIComponent(phrase)}`,google:`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(phrase)}`};
  const key=process.env.BING_IMAGE_SEARCH_KEY;
  if(!key)return json(response,503,{message:"BING_IMAGE_SEARCH_KEY is not configured. Use the guided searches and submit the official source for review.",search_urls:searchUrls});
  const endpoint=process.env.BING_IMAGE_SEARCH_ENDPOINT||"https://api.bing.microsoft.com/v7.0/images/search";
  const searchResponse=await fetch(`${endpoint}?q=${encodeURIComponent(phrase)}&count=12&safeSearch=Strict&imageType=Photo`,{headers:{"Ocp-Apim-Subscription-Key":key},signal:AbortSignal.timeout(15000)});
  if(!searchResponse.ok)return json(response,502,{message:`Image search provider returned HTTP ${searchResponse.status}.`,search_urls:searchUrls});
  const search=await searchResponse.json();
  const manufacturerTokens=tokens(body.manufacturer);
  const rows=(Array.isArray(search.value)?search.value:[]).filter(item=>item?.contentUrl&&item?.hostPageUrl).map(item=>{
    const sourceDomain=domain(item.hostPageUrl);
    const officialMatch=manufacturerTokens.some(token=>sourceDomain.includes(token));
    const titleText=String(item.name||"").toLowerCase();
    const nameMatch=tokens(productName).some(token=>titleText.includes(token));
    const matchScore=Math.min(90,35+(nameMatch?25:0)+(officialMatch?25:0)+(Number(item.width)>=500?5:0));
    const authenticityScore=Math.min(85,30+(officialMatch?40:0)+(sourceDomain.endsWith(".gov")?20:0)+(Number(item.width)>=500?5:0));
    return{canonical_id:canonicalId,image_url:item.contentUrl,thumbnail_url:item.thumbnailUrl||null,source_page_url:item.hostPageUrl,source_kind:officialMatch?"official_manufacturer":"search_engine_result",discovery_provider:"bing",query_text:phrase,result_title:item.name||null,width:Number(item.width)||null,height:Number(item.height)||null,match_score:matchScore,authenticity_score:authenticityScore,status:"pending",created_by:user.id};
  });
  if(!rows.length)return json(response,200,{inserted:0,candidates:[],search_urls:searchUrls});
  const insertResponse=await fetch(`${supabaseUrl}/rest/v1/medicine_image_candidates?on_conflict=canonical_id,image_url`,{method:"POST",headers:{apikey:publishableKey,Authorization:authorization,"Content-Type":"application/json",Prefer:"resolution=merge-duplicates,return=representation"},body:JSON.stringify(rows)});
  const result=await insertResponse.json();
  if(!insertResponse.ok)return json(response,insertResponse.status,{message:result?.message||"Could not store image candidates."});
  return json(response,200,{inserted:Array.isArray(result)?result.length:0,candidates:result,search_urls:searchUrls});
 }catch(error){console.error("medicine-image-search",error);return json(response,500,{message:"Medicine image discovery failed safely."});}
}
