import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { verifyPaddleWebhook } from "~/backend/paddle.server";
import { prisma } from "~/database/db.server";

export async function action({ request }: ActionFunctionArgs) {
  const data = await verifyPaddleWebhook(request);
  if (!data) return json({ error: "Invalid signature" }, { status: 401 });
  
  const eventName = data.alert_name;
  const email = data.email;
  // Paddle 'passthrough' usually contains our JSON meta
  let userId = data.passthrough as string; 

  if (eventName === "subscription_created" || eventName === "subscription_updated" || eventName === "payment_succeeded") {
    const planId = (data.subscription_plan_id || data.product_id) as string;
    
    await prisma.user.update({
      where: { email: email as string },
      data: { subscriptionTier: planId }
    });
  }

  if (eventName === "subscription_cancelled") {
    await prisma.user.update({
      where: { email: email as string },
      data: { subscriptionTier: "free" }
    });
  }

  return json({ received: true });
}
