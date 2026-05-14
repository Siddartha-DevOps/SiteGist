import { createCookieSessionStorage, redirect } from "@remix-run/node";
import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "~/database/db.server";

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString("hex")}`;
}

export async function comparePassword(password: string, hash: string) {
  const [salt, key] = hash.split(":");
  const derivedKey = scryptSync(password, salt, 64);
  const keyBuffer = Buffer.from(key, "hex");
  return timingSafeEqual(keyBuffer, derivedKey);
}

const sessionSecret = process.env.SESSION_SECRET || "DEFAULT_SECRET_CHANGE_ME";

const storage = createCookieSessionStorage({
  cookie: {
    name: "sitegist_session",
    secure: process.env.NODE_ENV === "production",
    secrets: [sessionSecret],
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    httpOnly: true,
  },
});

export async function createUserSession(userId: string, redirectTo: string) {
  const session = await storage.getSession();
  session.set("userId", userId);
  return redirect(redirectTo, {
    headers: {
      "Set-Cookie": await storage.commitSession(session),
    },
  });
}

export async function getUserSession(request: Request) {
  return storage.getSession(request.headers.get("Cookie"));
}

export async function getUserId(request: Request) {
  const session = await getUserSession(request);
  const userId = session.get("userId");
  if (!userId || typeof userId !== "string") return null;
  return userId;
}

export async function requireUserId(
  request: Request,
  redirectTo: string = new URL(request.url).pathname
) {
  const userId = await getUserId(request);
  if (!userId) {
    const searchParams = new URLSearchParams([["redirectTo", redirectTo]]);
    throw redirect(`/login?${searchParams}`);
  }
  return userId;
}

export async function getUser(request: Request) {
  const userId = await getUserId(request);
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { subscriptions: true }
  });

  if (user && user.email === "sidduchitiki@gmail.com") {
    // Ensure the founder always has OWNER role
    return { ...user, role: "OWNER" };
  }

  return user;
}

export async function requireOwner(request: Request) {
  const user = await getUser(request);
  if (!user || user.role !== "OWNER") {
    throw redirect("/dashboard");
  }
  return user;
}

export async function logout(request: Request) {
  const session = await getUserSession(request);
  return redirect("/", {
    headers: {
      "Set-Cookie": await storage.destroySession(session),
    },
  });
}
