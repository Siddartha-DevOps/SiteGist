import { randomBytes } from "node:crypto";
import { getRedis } from "~/lib/redis.server";
import { sendEmail } from "~/lib/email.server";
import { prisma } from "~/database/db.server";

const TOKEN_EXPIRATION_SEC = 60 * 15; // 15 minutes

export async function generateMagicLink(email: string, baseUrl: string) {
  const token = randomBytes(32).toString("hex");
  const redis = getRedis();
  
  if (redis) {
    // Store token in Redis: key="magic_link:token", value="email", expires in 15 mins
    await redis.set(`magic_link:${token}`, email, { ex: TOKEN_EXPIRATION_SEC });
  } else {
    // Fallback to Database
    await prisma.verificationToken.create({
      data: {
        email,
        token,
        expiresAt: new Date(Date.now() + TOKEN_EXPIRATION_SEC * 1000)
      }
    });
  }

  const magicLink = `${baseUrl}/api/auth/verify?token=${token}`;
  
  await sendEmail({
    to: email,
    subject: "Login to SiteGist",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #6c5ce7;">Login to SiteGist</h2>
        <p>Click the button below to log in to your account. This link will expire in 15 minutes.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${magicLink}" style="background-color: #6c5ce7; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Log in</a>
        </div>
        <p style="color: #666; font-size: 14px;">If you didn't request this link, you can safely ignore this email.</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="color: #999; font-size: 12px;">SiteGist Technologies Inc.</p>
      </div>
    `
  });

  return token;
}

export async function verifyMagicLink(token: string) {
  const redis = getRedis();
  
  if (redis) {
    const email = await redis.get<string>(`magic_link:${token}`);
    if (email) {
      // Consume token
      await redis.del(`magic_link:${token}`);
      return email;
    }
  }

  // Fallback to Database or if Redis missed
  const vToken = await prisma.verificationToken.findUnique({
    where: { token }
  });

  if (!vToken || vToken.expiresAt < new Date()) {
    return null;
  }

  // Consume token
  await prisma.verificationToken.delete({
    where: { id: vToken.id }
  });

  return vToken.email;
}
