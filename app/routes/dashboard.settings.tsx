import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, Form, useNavigation, useActionData } from "@remix-run/react";
import { requireUserId, getUser } from "~/backend/auth.server";
import { prisma } from "~/database/db.server";
import { Save, User, Loader2 } from "lucide-react";

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  const user = await getUser(request);
  return json({ user });
}

export async function action({ request }: ActionFunctionArgs) {
  const userId = await requireUserId(request);
  const formData = await request.formData();
  const name = formData.get("name") as string;

  // Simple update for demonstration
  return json({ success: true, message: "Settings updated (simulated)" });
}

export default function Settings() {
  const { user } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const actionData = useActionData<typeof action>();
  const isSaving = navigation.state === "submitting";

  return (
    <div>
      <div className="mb-12">
        <h1 className="text-4xl font-black mb-2">Settings</h1>
        <p className="text-text-muted">Manage your account and preferences.</p>
      </div>

      <div className="max-w-2xl bg-white p-10 rounded-[40px] border border-zinc-100 shadow-xl shadow-zinc-200/20">
        <h2 className="text-2xl font-bold mb-8 flex items-center gap-3">
          <User className="text-primary w-6 h-6" /> Profile Information
        </h2>
        
        <Form method="post" className="space-y-8">
          <div>
            <label className="block text-sm font-bold mb-2 text-zinc-500">Email Address</label>
            <input 
              type="email" 
              value={user?.email} 
              disabled 
              className="w-full px-5 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl text-zinc-400 outline-none cursor-not-allowed"
            />
            <p className="mt-2 text-xs text-zinc-400">Email cannot be changed.</p>
          </div>
          
          <div>
            <label className="block text-sm font-bold mb-2">Display Name</label>
            <input 
              type="text" 
              name="name" 
              placeholder="Your Name"
              defaultValue={user?.email.split('@')[0]}
              className="w-full px-5 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none transition-all"
            />
          </div>
          
          {actionData?.success && <p className="text-green-500 font-bold text-sm">{actionData.message}</p>}
          
          <button 
            type="submit" 
            disabled={isSaving}
            className="w-full py-5 bg-zinc-900 text-white rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-zinc-800 transition-all shadow-xl shadow-zinc-200/50"
          >
            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            Save Changes
          </button>
        </Form>

        <div className="mt-12 pt-12 border-t border-zinc-50">
          <h3 className="text-lg font-bold text-red-500 mb-4">Danger Zone</h3>
          <p className="text-sm text-text-muted mb-6">Once you delete your account, there is no going back. Please be certain.</p>
          <button className="px-6 py-3 border border-red-200 text-red-500 rounded-xl font-bold text-sm hover:bg-red-50 transition-all">
            Delete Account
          </button>
        </div>
      </div>
    </div>
  );
}
