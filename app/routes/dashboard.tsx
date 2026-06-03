import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { requireUserId, getUser } from "~/backend/auth.server";
import { prisma } from "~/database/db.server";
import { DashboardLayoutPage } from "~/frontend/pages/DashboardLayout";

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  const user = await getUser(request);
  
  // Query subscriptionStatus from DB user
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { subscriptionStatus: true }
  });

  return json({ 
    user,
    subscriptionStatus: dbUser?.subscriptionStatus || null
  });
}

export default function DashboardLayout() {
  const { user, subscriptionStatus } = useLoaderData<typeof loader>();
  return <DashboardLayoutPage user={user} subscriptionStatus={subscriptionStatus} />;
}
