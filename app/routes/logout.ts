import type { ActionFunctionArgs } from "@remix-run/node";
import { logout } from "~/backend/auth.server";

export async function action({ request }: ActionFunctionArgs) {
  return logout(request);
}
