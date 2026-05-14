import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, Form, useNavigation, Link } from "@remix-run/react";
import { requireUserId } from "~/backend/auth.server";
import { prisma } from "~/database/db.server";
import { ChevronLeft, User, Bot, Send, Calendar, Globe, Clock, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { useEffect, useRef } from "react";

export async function loader({ params, request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  const session = await (prisma.chatSession as any).findUnique({
    where: { id: params.sessionId },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      project: { select: { name: true, userId: true } }
    },
  });

  if (!session || session.project.userId !== userId) {
    return redirect("/dashboard/inbox");
  }

  return json({ session });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const userId = await requireUserId(request);
  const formData = await request.formData();
  const action = formData.get("_action");
  
  if (action === "toggle_mode") {
    const session = await prisma.chatSession.findUnique({ where: { id: params.sessionId } });
    const newMode = (session as any).mode === "human" ? "ai" : "human";
    await prisma.chatSession.update({
      where: { id: params.sessionId },
      data: { mode: newMode }
    });
    return json({ success: true });
  }

  const content = formData.get("content") as string;

  if (!content) return json({ error: "Content is required" }, { status: 400 });

  await prisma.message.create({
    data: {
      sessionId: params.sessionId!,
      role: "assistant",
      content,
    },
  });

  await prisma.chatSession.update({
    where: { id: params.sessionId },
    data: { updatedAt: new Date() }
  });

  return json({ success: true });
}

export default function SessionDetail() {
  const { session } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const isSending = navigation.state === "submitting";
  const scrollRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [session.messages]);

  useEffect(() => {
    if (!isSending) {
      formRef.current?.reset();
    }
  }, [isSending]);

  return (
    <div className="h-[calc(100vh-theme(spacing.32))] flex flex-col bg-white border border-zinc-100 rounded-[40px] overflow-hidden">
      {/* Detail Header */}
      <div className="p-6 border-b border-zinc-50 bg-white flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/dashboard/inbox" className="p-2 hover:bg-zinc-50 rounded-xl transition-colors">
            <ChevronLeft className="w-5 h-5 text-zinc-400" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-zinc-100 rounded-full flex items-center justify-center">
              <User className="text-zinc-400 w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold">{session.customerEmail || "Guest User"}</h2>
              <div className="flex items-center gap-2 text-[10px] text-text-muted font-bold uppercase tracking-wider">
                <span className="flex items-center gap-1"><Globe className="w-3 h-3" /> {session.project.name}</span>
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> ID: {session.id.slice(0, 8)}</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
           <Form method="post">
              <input type="hidden" name="_action" value="toggle_mode" />
              <button 
                type="submit"
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                  session.mode === 'human' 
                    ? 'bg-amber-100 text-amber-600 border border-amber-200' 
                    : 'bg-zinc-50 text-zinc-400 border border-zinc-100 hover:bg-zinc-100'
                }`}
              >
                {session.mode === 'human' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                {session.mode === 'human' ? 'Human Mode Active' : 'Enable Live Takeover'}
              </button>
           </Form>
        </div>
      </div>

      {/* Messages Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-10 space-y-8 bg-zinc-50/30">
        {session.messages.map((msg: any) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
            <div className="max-w-[70%] group">
              <div className={`p-4 rounded-3xl text-sm leading-relaxed ${
                msg.role === 'user' 
                  ? 'bg-white border border-zinc-100 text-zinc-800 rounded-bl-none shadow-sm' 
                  : 'bg-primary text-white rounded-br-none shadow-lg shadow-primary/10'
              }`}>
                {msg.content}
              </div>
              <p className={`text-[10px] mt-2 font-bold text-zinc-300 ${msg.role === 'user' ? 'text-left' : 'text-right'}`}>
                {format(new Date(msg.createdAt), "MMM d, h:mm a")}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Reply Area */}
      <div className="p-6 bg-white border-t border-zinc-50">
        <Form ref={formRef} method="post" className="relative">
          <textarea 
            name="content" 
            placeholder="Type your response as assistant..." 
            rows={3}
            required
            className="w-full px-5 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none pr-20"
          ></textarea>
          <button 
            type="submit" 
            disabled={isSending}
            className="absolute bottom-4 right-4 p-3 bg-primary text-white rounded-xl shadow-lg shadow-primary/20 hover:scale-110 active:scale-95 transition-all disabled:opacity-50"
          >
            {isSending ? <Clock className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </Form>
        <p className="text-[10px] text-center text-zinc-400 mt-4 font-bold tracking-widest uppercase">
          {session.mode === 'human' ? 'You are manually responding' : 'AI is currently handling this conversation'}
        </p>
      </div>
    </div>
  );
}
