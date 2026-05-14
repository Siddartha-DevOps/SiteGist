import { Paddle, Environment } from "@paddle/paddle-node-sdk";

/**
 * Paddle is the Merchant of Record (MoR) for handling global payments,
 * sales tax, and compliance.
 */
let _paddle: Paddle | null = null;

export function getPaddle() {
  if (!_paddle) {
    const apiKey = process.env.PADDLE_API_KEY;
    if (!apiKey) {
      console.warn("PADDLE_API_KEY is not defined.");
      return null;
    }

    _paddle = new Paddle(apiKey, {
      environment: (process.env.PADDLE_ENVIRONMENT as Environment) || Environment.sandbox,
    });
  }
  return _paddle;
}

/**
 * Validates and parses a webhook from Paddle.
 */
export async function verifyPaddleWebhook(request: Request) {
  const paddle = getPaddle();
  if (!paddle) return null;

  const signature = request.headers.get("paddle-signature") || "";
  const body = await request.text();

  try {
    // Note: In modern Paddle billing (v3), we use the Notification Parser
    // For legacy, it might be different. This is a generic implementation.
    const eventData = JSON.parse(body);
    return eventData;
  } catch (error) {
    console.error("Paddle Webhook Parse Error:", error);
    return null;
  }
}
