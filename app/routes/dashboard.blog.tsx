import type { LoaderFunctionArgs } from "@remix-run/node";
import { Outlet } from "@remix-run/react";
import { requireOwner } from "~/backend/auth.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireOwner(request);
  return null;
}

export default function BlogLayout() {
  return <Outlet />;
}
