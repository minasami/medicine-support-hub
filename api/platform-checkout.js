import { appUrl, requireUser, serviceRest, stripeClient } from "./_billing-server.js";
import { errorStatus, parseBody, sendJson } from "./_platform-server.js";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export default async function handler(request,response){
  if(request.method!=="POST")return sendJson(response,405,{message:"Method not allowed."});
  try{
    const context=await requireUser(request);const paymentRequestId=String(parseBody(request).payment_request_id||"");
    if(!UUID.test(paymentRequestId))throw Object.assign(new Error("A valid payment request is required."),{statusCode:400});
    const rows=await serviceRest(`/rest/v1/platform_payment_requests?select=*&id=eq.${paymentRequestId}&limit=1`);
    const payment=rows?.[0];
    if(!payment||payment.user_id!==context.user.id)throw Object.assign(new Error("Payment request not found."),{statusCode:404});
    if(!["pending","checkout_created"].includes(payment.status))throw Object.assign(new Error("This payment request is no longer payable."),{statusCode:409});
    if(payment.expires_at&&Date.parse(payment.expires_at)<=Date.now())throw Object.assign(new Error("This payment request has expired."),{statusCode:410});
    const existing=await serviceRest(`/rest/v1/platform_payment_transactions?select=stripe_checkout_session_id&payment_request_id=eq.${payment.id}&limit=1`);
    const stripe=stripeClient();
    if(existing?.[0]?.stripe_checkout_session_id){const prior=await stripe.checkout.sessions.retrieve(existing[0].stripe_checkout_session_id);if(prior.url)return sendJson(response,200,{url:prior.url});}
    const lineItem=payment.mode==="subscription"?{price:payment.stripe_price_id,quantity:1}:{price_data:{currency:payment.currency,unit_amount:Number(payment.amount_minor),product_data:{name:payment.description}},quantity:1};
    const origin=appUrl(request);const metadata={payment_request_id:payment.id,user_id:context.user.id,purpose:payment.purpose,target_type:payment.target_type,target_id:payment.target_id};
    const session=await stripe.checkout.sessions.create({mode:payment.mode,customer_email:context.user.email,line_items:[lineItem],client_reference_id:context.user.id,metadata,subscription_data:payment.mode==="subscription"?{metadata}:undefined,success_url:`${origin}/account?payment=success&request_id=${payment.id}`,cancel_url:`${origin}/account?payment=canceled&request_id=${payment.id}`},{idempotencyKey:`checkout-${payment.idempotency_key}`});
    await serviceRest("/rest/v1/platform_payment_transactions?on_conflict=payment_request_id",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify({payment_request_id:payment.id,user_id:context.user.id,stripe_checkout_session_id:session.id,amount_minor:payment.amount_minor,currency:payment.currency,payment_status:"checkout_created",metadata:{purpose:payment.purpose}})});
    await serviceRest(`/rest/v1/platform_payment_requests?id=eq.${payment.id}`,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({status:"checkout_created",updated_at:new Date().toISOString()})});
    return sendJson(response,200,{url:session.url});
  }catch(error){return sendJson(response,errorStatus(error),{message:error.message||"Could not start checkout."});}
}
