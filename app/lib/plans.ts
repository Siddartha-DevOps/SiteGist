export type PlanInfo = {
  name: string;
  messageLimit: number; // -1 = unlimited
  chatbotLimit: number; // -1 = unlimited
};

export function getPlanForTier(tier: string | null | undefined): PlanInfo {
  // Try to read environment variables, with hardcoded defaults as in billing.tsx
  const PADDLE_STARTER_PLAN_ID = process.env.VITE_PADDLE_STARTER_PLAN_ID || "pri_01kqpebd19q7nppxkh53e0cnd3";
  const PADDLE_BASIC_PLAN_ID = process.env.VITE_PADDLE_GROWTH_PLAN_ID || process.env.VITE_PADDLE_BASIC_PLAN_ID || "pri_01kqpe8ad9772rdsn3ddbw4bg3";
  const PADDLE_PRO_PLAN_ID = process.env.VITE_PADDLE_SCALE_PLAN_ID || process.env.VITE_PADDLE_PRO_PLAN_ID || "pri_01kqpe9hv3r1v9wfxxvnjgq9zk";

  switch (tier) {
    case PADDLE_BASIC_PLAN_ID:
      return { name: "Growth", messageLimit: 5000, chatbotLimit: 3 };
    case PADDLE_PRO_PLAN_ID:
      return { name: "Scale", messageLimit: 25000, chatbotLimit: -1 };
    case "enterprise_plan":
      return { name: "Enterprise", messageLimit: -1, chatbotLimit: -1 };
    case PADDLE_STARTER_PLAN_ID:
    case "starter_plan":
    case "free":
    case null:
    case undefined:
    default:
      return { name: "Starter", messageLimit: 1000, chatbotLimit: 1 };
  }
}

export function hasRemoveBrandingAccess(
  tier: string | null | undefined,
  addons: { type: string; status: string }[]
): boolean {
  const PADDLE_BASIC_PLAN_ID = process.env.VITE_PADDLE_GROWTH_PLAN_ID || process.env.VITE_PADDLE_BASIC_PLAN_ID || "pri_01kqpe8ad9772rdsn3ddbw4bg3";
  const PADDLE_PRO_PLAN_ID = process.env.VITE_PADDLE_SCALE_PLAN_ID || process.env.VITE_PADDLE_PRO_PLAN_ID || "pri_01kqpe9hv3r1v9wfxxvnjgq9zk";

  if (tier === PADDLE_BASIC_PLAN_ID || tier === PADDLE_PRO_PLAN_ID || tier === "enterprise_plan") {
    return true;
  }

  return addons.some((a) => a.type === "remove_branding" && a.status === "active");
}
