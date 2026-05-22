import { type LoaderFunctionArgs, redirect } from "@remix-run/node";

export async function loader({ request }: LoaderFunctionArgs) {
  return redirect("/login");
}

export default function Signup() {
  return null;
}
