import { randomBytes } from "node:crypto";
import { getRedis } from "~/lib/redis.server";
import { sendEmail } from "~/lib/email.server";
import { prisma } from "~/database/db.server";

const TOKEN_EXPIRATION_SEC = 60 * 15; // 15 minutes

export async function generateMagicLink(email: string, baseUrl: string) {
  const token = randomBytes(32).toString("hex");
  const redis = getRedis();
  
  // Always save to database for maximum durability and consistency
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRATION_SEC * 1000);
  await prisma.verificationToken.create({
    data: {
      email,
      token,
      expiresAt
    }
  });

  if (redis) {
    try {
      // Also store token in Redis: key="magic_link:token", value="email", expires in 15 mins for caching speed
      await redis.set(`magic_link:${token}`, email, { ex: TOKEN_EXPIRATION_SEC });
    } catch (err) {
      console.error("[Magic Link] Redis set failed:", err);
    }
  }

  const magicLink = `${baseUrl}/api/auth/verify?token=${token}`;
  
  console.log("==================================================");
  console.log(`[Auth Magic-Link] Generated for: ${email}`);
  console.log(`[Auth Magic-Link] Login Link: ${magicLink}`);
  console.log("==================================================");
  
  await sendEmail({
    to: email,
    subject: "Sign in to SiteGist",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; padding: 40px 20px; text-align: center;">
        <div style="max-width: 540px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 24px; padding: 48px; text-align: center; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <!-- Logo Brand Header -->
          <div style="font-size: 20px; font-weight: 800; color: #2563eb; margin-bottom: 24px; letter-spacing: -0.5px;">
            SiteGist
          </div>
          
          <!-- Heading -->
          <h1 style="font-size: 28px; font-weight: 800; color: #0f172a; margin-top: 0; margin-bottom: 24px; letter-spacing: -0.5px;">
            Sign in to SiteGist
          </h1>
          
          <!-- Recipient Text Block -->
          <p style="font-size: 15px; color: #475569; line-height: 24px; margin-bottom: 4px;">
            We received a request to sign in to SiteGist using
          </p>
          <p style="margin-top: 0; margin-bottom: 24px;">
            <a href="mailto:${email}" style="color: #2563eb; font-weight: 700; text-decoration: underline; font-size: 15px;">${email}</a>.
          </p>
          
          <p style="font-size: 15px; color: #475569; line-height: 24px; margin-bottom: 24px;">
            Click the button below to sign in.
          </p>
          
          <!-- Large Blue Button -->
          <div style="margin-bottom: 32px;">
            <a href="${magicLink}" style="background-color: #2563eb; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 12px; font-weight: 800; font-size: 15px; display: inline-block;">
              Sign in to SiteGist
            </a>
          </div>
          
          <!-- Divider -->
          <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 24px 0;" />
          
          <!-- Raw Link Fallback -->
          <p style="font-size: 12px; color: #64748b; margin-bottom: 8px; font-weight: 500;">
            Or copy and paste this link:
          </p>
          <p style="margin: 0; word-break: break-all;">
            <a href="${magicLink}" style="color: #2563eb; text-decoration: underline; font-size: 13px; font-weight: 500;">${magicLink}</a>
          </p>
        </div>
      </div>
    `
  });

  return token;
}

export async function checkMagicLinkWithoutConsuming(token: string) {
  const redis = getRedis();
  
  if (redis) {
    try {
      const email = await redis.get<string>(`magic_link:${token}`);
      if (email) {
        return email;
      }
    } catch (err) {
      console.error("[Magic Link] Redis check without consuming failed:", err);
    }
  }

  const vToken = await prisma.verificationToken.findUnique({
    where: { token }
  });

  if (!vToken) {
    console.warn(`[Magic Link Check] No token found in Database for: ${token.slice(0, 8)}...`);
    return null;
  }

  const now = new Date();
  if (vToken.expiresAt < now) {
    console.warn(`[Magic Link Check] Token is expired. DB expiresAt: ${vToken.expiresAt.toISOString()}, Now: ${now.toISOString()}`);
    return null;
  }

  return vToken.email;
}

export async function verifyMagicLink(token: string) {
  const redis = getRedis();
  let email: string | null = null;
  
  if (redis) {
    try {
      email = await redis.get<string>(`magic_link:${token}`);
      if (email) {
        // Consumer from Redis
        await redis.del(`magic_link:${token}`).catch(() => {});
      }
    } catch (err) {
      console.error("[Magic Link] Redis verify failed:", err);
    }
  }

  // Fallback to database lookup if Redis missed or failed
  if (!email) {
    const vToken = await prisma.verificationToken.findUnique({
      where: { token }
    });

    if (vToken) {
      const now = new Date();
      if (vToken.expiresAt >= now) {
        email = vToken.email;
      } else {
        console.warn(`[Magic Link Verify] Token in DB is expired. DB expiresAt: ${vToken.expiresAt.toISOString()}, Now: ${now.toISOString()}`);
      }
    } else {
      console.warn("[Magic Link Verify] Token not found in Database fallback either");
    }
  }

  // Always attempt to delete from DB to prevent replay attacks / reuse
  try {
    await prisma.verificationToken.delete({
      where: { token }
    });
  } catch (err) {
    // Already deleted or not exists; ignore
  }

  return email;
}
