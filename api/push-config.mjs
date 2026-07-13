export default function handler(_request,response){
  response.statusCode=200;
  response.setHeader("Content-Type","application/json; charset=utf-8");
  response.setHeader("Cache-Control","public, max-age=300, s-maxage=300");
  const publicKey=String(process.env.WEB_PUSH_VAPID_PUBLIC_KEY||"").trim();
  response.end(JSON.stringify({enabled:Boolean(publicKey),public_key:publicKey||null,service_worker:"/sw.js"}));
}
