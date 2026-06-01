import { json } from "@remix-run/node";

export async function loader() {
  const clientToken = process.env.VITE_PADDLE_CLIENT_TOKEN || "";
  const starterPlanId = process.env.VITE_PADDLE_STARTER_PLAN_ID || "";
  const basicPlanId = process.env.VITE_PADDLE_GROWTH_PLAN_ID || process.env.VITE_PADDLE_BASIC_PLAN_ID || "";
  const proPlanId = process.env.VITE_PADDLE_SCALE_PLAN_ID || process.env.VITE_PADDLE_PRO_PLAN_ID || "";
  const paddleApiKey = process.env.PADDLE_API_KEY || "";
  const paddleWebhookSecret = process.env.PADDLE_WEBHOOK_SECRET || "";
  const paddleEnv = process.env.PADDLE_ENVIRONMENT || "";

  // Perform diagnostic formatting assessments
  const diagnostics = {
    clientToken: {
      length: clientToken.length,
      prefix: clientToken.substring(0, 12),
      isConfigured: clientToken.length > 0,
      isValidClientTokenFormat: clientToken.startsWith("live_client_") || clientToken.startsWith("test_client_"),
      isSandbox: clientToken.startsWith("test_"),
      isLive: clientToken.startsWith("live_"),
      suggestedEnvironment: clientToken.startsWith("test_") ? "sandbox" : "production"
    },
    plans: {
      starter: {
        id: starterPlanId,
        isConfigured: starterPlanId.length > 0 && !starterPlanId.includes("starter_price_id"),
        isValidPriceIdFormat: starterPlanId.startsWith("pri_")
      },
      basic: {
        id: basicPlanId,
        isConfigured: basicPlanId.length > 0 && !basicPlanId.includes("growth_price_id"),
        isValidPriceIdFormat: basicPlanId.startsWith("pri_")
      },
      pro: {
        id: proPlanId,
        isConfigured: proPlanId.length > 0 && !proPlanId.includes("scale_price_id"),
        isValidPriceIdFormat: proPlanId.startsWith("pri_")
      }
    },
    backend: {
      hasApiKey: paddleApiKey.length > 0,
      hasWebhookSecret: paddleWebhookSecret.length > 0,
      configuredEnv: paddleEnv || "production (default)",
      isEnvMismatch: (clientToken.startsWith("test_") && paddleEnv === "production") || (clientToken.startsWith("live_") && paddleEnv === "sandbox")
    }
  };

  // Compile detailed suggestions for developers
  const recommendations: string[] = [];
  
  if (!diagnostics.clientToken.isConfigured) {
    recommendations.push("VITE_PADDLE_CLIENT_TOKEN is not configured in your .env file.");
  } else if (!diagnostics.clientToken.isValidClientTokenFormat) {
    recommendations.push(
      `Your VITE_PADDLE_CLIENT_TOKEN starts with '${diagnostics.clientToken.prefix}'. Paddle.js v3 client-side tokens MUST start with 'live_client_' (Production) or 'test_client_' (Sandbox). Please verify you didn't accidentally copy an API secret key or a shortened key.`
    );
  }

  if (diagnostics.clientToken.isConfigured && diagnostics.clientToken.isLive) {
    recommendations.push(
      "Your Client Token is LIVE. Make sure your Plan IDs (Starter, Basic, Pro) are copied from your LIVE Paddle catalog. Sandbox Plan IDs will fail to load with a LIVE client token."
    );
  }

  if (diagnostics.clientToken.isConfigured && diagnostics.clientToken.isSandbox) {
    recommendations.push(
      "Your Client Token is SANDBOX. Make sure your Plan IDs (Starter, Basic, Pro) are copied from your SANDBOX Paddle catalog."
    );
  }

  if (!diagnostics.plans.starter.isConfigured) {
    recommendations.push("VITE_PADDLE_STARTER_PLAN_ID is missing or not configured.");
  } else if (!diagnostics.plans.starter.isValidPriceIdFormat) {
    recommendations.push(`VITE_PADDLE_STARTER_PLAN_ID ('${starterPlanId}') does not start with the standard 'pri_' prefix format.`);
  }

  if (!diagnostics.plans.basic.isConfigured) {
    recommendations.push("VITE_PADDLE_BASIC_PLAN_ID is missing or empty.");
  }

  if (diagnostics.backend.isEnvMismatch) {
    recommendations.push(
      `Potential Environment Mismatch: Frontend Client Token is '${diagnostics.clientToken.isSandbox ? "sandbox" : "live"}', but backend PADDLE_ENVIRONMENT is set to '${paddleEnv}'. Keep them in sync.`
    );
  }

  const result = {
    status: recommendations.length === 0 ? "OK" : "WARNING",
    timestamp: new Date().toISOString(),
    diagnostics,
    recommendations,
    howToFix: "Update your /.env file with valid credentials, then restart the development server if changes do not reflect.",
  };

  // Log diagnostic results to the console for live terminal troubleshooting
  console.log("========================================");
  console.log("🎒 [PADDLE DIAGNOSTIC] Running checkout configuration check...");
  console.log(`- Token Configured: ${diagnostics.clientToken.isConfigured ? "YES" : "NO"}`);
  console.log(`- Token Starts with: ${diagnostics.clientToken.prefix}`);
  console.log(`- Is Valid V3 Client Token Format: ${diagnostics.clientToken.isValidClientTokenFormat ? "YES" : "NO"}`);
  console.log(`- Starter Plan ID: ${starterPlanId || "Not Set"}`);
  console.log(`- Basic Plan ID: ${basicPlanId || "Not Set"}`);
  console.log(`- Pro Plan ID: ${proPlanId || "Not Set"}`);
  if (recommendations.length > 0) {
    console.log("⚠️ Warnings/Recommendations:");
    recommendations.forEach((rec, idx) => console.log(`  ${idx + 1}. ${rec}`));
  } else {
    console.log("✅ Configuration looks correct.");
  }
  console.log("========================================");

  return json(result);
}
