import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { requireUserId, getUser } from "~/backend/auth.server";
import { DashboardLayoutPage } from "~/frontend/pages/DashboardLayout";

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  const user = await getUser(request);
  return json({ user });
}

export default function DashboardLayout() {
  const { user } = useLoaderData<typeof loader>();
  return <DashboardLayoutPage user={user} />;
}
