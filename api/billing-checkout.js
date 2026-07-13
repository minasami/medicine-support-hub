import { appUrl, requireUser, serviceRest, stripeClient } from "./_billing-server.js";
import { errorStatus, sendJson } from "./_platform-server.js";

export default async function handler(request,response){
  if(request.method!=="POST")return sendJson(response,405,{message:"Method not allowed."});
  try{
    const context=await requireUser(request);const stripe=stripeClient();const price=String(process.env.STRIPE_PRO_PRICE_ID||"");
    if(!price)throw Object.assign(new Error("The Pro price is not configured yet."),{statusCode:503});
    const existing=await serviceRest(`/rest/v1/user_billing_accounts?select=stripe_customer_id&user_id=eq.${context.user.id}&limit=1`);
    let customer=existing?.[0]?.stripe_customer_id;
    if(!customer){const created=await stripe.customers.create({email:context.user.email,metadata:{supabase_user_id:context.user.id}});customer=created.id;await serviceRest("/rest/v1/user_billing_accounts?on_conflict=user_id",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify({user_id:context.user.id,stripe_customer_id:customer})});}
    const origin=appUrl(request);const session=await stripe.checkout.sessions.create({mode:"subscription",customer,line_items:[{price,quantity:1}],client_reference_id:context.user.id,metadata:{supabase_user_id:context.user.id,plan_code:"pro"},subscription_data:{metadata:{supabase_user_id:context.user.id,plan_code:"pro"}},success_url:`${origin}/account?billing=success`,cancel_url:`${origin}/account?billing=canceled`,allow_promotion_codes:true});
    return sendJson(response,200,{url:session.url});
  }catch(error){return sendJson(response,errorStatus(error),{message:error.message||"Could not start Pro checkout."});}
}
