import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { requireUserId } from "~/backend/auth.server";
import { prisma } from "~/database/db.server";
import { MessageSquare, ChevronRight, User, Bot, Calendar } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  const sessions = await prisma.chatSession.findMany({
    where: { project: { userId } },
    include: {
      project: { select: { name: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
      _count: { select: { messages: true } }
    },
    orderBy: { updatedAt: "desc" },
  });
  return json({ sessions });
}

export default function Inbox() {
  const { sessions } = useLoaderData<typeof loader>();

  return (
    <div>
      <div className="mb-12">
        <h1 className="text-4xl font-black mb-2">Conversations</h1>
        <p className="text-text-muted">Monitor and respond to customer chats.</p>
      </div>

      <div className="bg-white border border-zinc-100 rounded-[40px] overflow-hidden">
        {sessions.length === 0 ? (
          <div className="p-20 text-center">
            <div className="w-16 h-16 bg-zinc-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <MessageSquare className="text-zinc-300 w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold mb-2">No conversations yet</h2>
            <p className="text-text-muted">When customers chat with your bot, they'll show up here.</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-50">
            {sessions.map((session: any) => (
              <Link 
                key={session.id} 
                to={`/dashboard/inbox/${session.id}`}
                className="flex items-center gap-6 p-6 hover:bg-zinc-50 transition-colors group"
              >
                <div className="w-12 h-12 bg-zinc-100 rounded-full flex items-center justify-center shrink-0">
                  <User className="text-zinc-400 w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-bold truncate">
                      {session.customerEmail || "Guest User"}
                      <span className="ml-2 text-xs font-medium px-2 py-0.5 bg-zinc-50 text-zinc-400 rounded-full border border-zinc-100">
                        {session.project.name}
                      </span>
                    </p>
                    <p className="text-xs text-text-muted font-medium whitespace-nowrap">
                      {formatDistanceToNow(new Date(session.updatedAt), { addSuffix: true })}
                    </p>
                  </div>
                  <p className="text-sm text-text-muted truncate">
                    {session.messages[0]?.content || "No messages yet"}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-xs font-bold text-zinc-300 bg-zinc-50 px-2.5 py-1 rounded-lg">
                    {session._count.messages} msg
                  </div>
                  <ChevronRight className="w-5 h-5 text-zinc-300 group-hover:text-primary transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
