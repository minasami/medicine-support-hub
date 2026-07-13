import crypto from "node:crypto";

const b64url=(value)=>Buffer.from(value).toString("base64url");
const decode=(value)=>Buffer.from(String(value||"").replace(/-/g,"+").replace(/_/g,"/"),"base64");
const hmac=(key,data)=>crypto.createHmac("sha256",key).update(data).digest();
function hkdfExpand(prk,info,length){let result=Buffer.alloc(0);let previous=Buffer.alloc(0);let counter=1;while(result.length<length){previous=hmac(prk,Buffer.concat([previous,Buffer.from(info),Buffer.from([counter++])]));result=Buffer.concat([result,previous]);}return result.subarray(0,length);}

function vapidKey(publicKey,privateKey){
  const pub=decode(publicKey);const priv=decode(privateKey);
  if(pub.length!==65||pub[0]!==4||priv.length!==32)throw new Error("Invalid VAPID P-256 key material.");
  return crypto.createPrivateKey({key:{kty:"EC",crv:"P-256",x:b64url(pub.subarray(1,33)),y:b64url(pub.subarray(33,65)),d:b64url(priv)},format:"jwk"});
}

function vapidToken(endpoint,publicKey,privateKey,subject){
  const audience=new URL(endpoint).origin;
  const header=b64url(JSON.stringify({typ:"JWT",alg:"ES256"}));
  const payload=b64url(JSON.stringify({aud:audience,exp:Math.floor(Date.now()/1000)+43200,sub:subject}));
  const unsigned=`${header}.${payload}`;
  const signature=crypto.sign("sha256",Buffer.from(unsigned),{key:vapidKey(publicKey,privateKey),dsaEncoding:"ieee-p1363"});
  return `${unsigned}.${b64url(signature)}`;
}

function encryptPayload(payload,userPublicKey,userAuth){
  const receiverPublic=decode(userPublicKey);const authSecret=decode(userAuth);
  if(receiverPublic.length!==65||receiverPublic[0]!==4||authSecret.length<16)throw new Error("Invalid push subscription keys.");
  const sender=crypto.createECDH("prime256v1");sender.generateKeys();
  const senderPublic=sender.getPublicKey();
  const shared=sender.computeSecret(receiverPublic);
  const prkKey=hmac(authSecret,shared);
  const keyInfo=Buffer.concat([Buffer.from("WebPush: info\0"),receiverPublic,senderPublic]);
  const ikm=hkdfExpand(prkKey,keyInfo,32);
  const salt=crypto.randomBytes(16);
  const prk=hmac(salt,ikm);
  const cek=hkdfExpand(prk,Buffer.from("Content-Encoding: aes128gcm\0"),16);
  const nonce=hkdfExpand(prk,Buffer.from("Content-Encoding: nonce\0"),12);
  const plaintext=Buffer.concat([Buffer.from(payload),Buffer.from([2])]);
  const cipher=crypto.createCipheriv("aes-128-gcm",cek,nonce);
  const encrypted=Buffer.concat([cipher.update(plaintext),cipher.final(),cipher.getAuthTag()]);
  const recordSize=Buffer.alloc(4);recordSize.writeUInt32BE(4096);
  return Buffer.concat([salt,recordSize,Buffer.from([senderPublic.length]),senderPublic,encrypted]);
}

export async function sendWebPush(subscription,payload,options={}){
  const publicKey=String(process.env.WEB_PUSH_VAPID_PUBLIC_KEY||"").trim();
  const privateKey=String(process.env.WEB_PUSH_VAPID_PRIVATE_KEY||"").trim();
  const subject=String(process.env.WEB_PUSH_SUBJECT||"mailto:jesussavedmina@gmail.com").trim();
  if(!publicKey||!privateKey)throw new Error("Web Push VAPID keys are not configured.");
  const body=encryptPayload(JSON.stringify(payload),subscription.p256dh,subscription.auth_key);
  const token=vapidToken(subscription.endpoint,publicKey,privateKey,subject);
  return fetch(subscription.endpoint,{method:"POST",headers:{Authorization:`vapid t=${token}, k=${publicKey}`,"Content-Encoding":"aes128gcm","Content-Type":"application/octet-stream",TTL:String(options.ttl||86400),Urgency:options.urgency||"normal"},body,signal:AbortSignal.timeout(15000)});
}
