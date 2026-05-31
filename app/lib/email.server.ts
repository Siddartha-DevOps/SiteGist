import { Resend } from "resend";

/**
 * Resend for transactional and programmatic emails.
 */
let _resend: Resend | null = null;

export function getResend() {
  if (!_resend) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn("RESEND_API_KEY is not defined.");
      return null;
    }
    _resend = new Resend(apiKey);
  }
  return _resend;
}

export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  const resend = getResend();
  if (!resend) return;

  const senderEmail = process.env.SENDER_EMAIL || "support@sitegist.co";
  const fromName = process.env.SENDER_NAME || "SiteGist";

  return await resend.emails.send({
    from: `${fromName} <${senderEmail}>`,
    to,
    subject,
    html,
  });
}

/**
 * Bento is used for event-based marketing emails.
 */
export async function trackBentoEvent(email: string, event: string, properties?: any) {
  const siteUuid = process.env.BENTO_SITE_UUID;
  const secretKey = process.env.BENTO_SECRET_KEY;

  if (!siteUuid || !secretKey) return;

  // Bento uses a tracking pixel or API. Here's the API approach.
  try {
    await fetch(`https://app.bentonow.com/api/v1/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${Buffer.from(`${siteUuid}:${secretKey}`).toString("base64")}`,
      },
      body: JSON.stringify({
        site_uuid: siteUuid,
        type: event,
        email,
        fields: properties,
      }),
    });
  } catch (error) {
    console.error("Bento Tracking Error:", error);
  }
}
