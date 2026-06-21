import type { LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useFetcher, Link } from "@remix-run/react";
import { requireUserId } from "~/backend/auth.server";
import { prisma } from "~/database/db.server";
import { useState, useEffect, useRef } from "react";
import { Send, ChevronLeft, Bot, Sparkles, MessageSquare, ExternalLink, ThumbsUp, ThumbsDown } from "lucide-react";
import Markdown from "react-markdown";

export async function loader({ params, request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId");
  
  if (!projectId) return redirect("/dashboard");

  try {
    let project = null;

    if (projectId === "mock-proj-1") {
      // Allow any logged-in user to preview the Acme Website Chatbot (mock-proj-1)
      project = await prisma.project.findFirst({
        where: { id: projectId },
      });
    } else {
      // Enforce owner checks for real user-defined projects
      project = await prisma.project.findFirst({
        where: { id: projectId, userId },
      });
    }

    if (!project) {
      console.warn(`[Playground Loader] Project of ID ${projectId} not found or doesn't belong to userId ${userId}. Redirecting to dashboard.`);
      return redirect("/dashboard");
    }

    return json({ project });
  } catch (err: any) {
    console.error("[Playground Loader] Failed to load the project:", err);
    throw new Response("Internal Server Error during playground project load: " + (err.message || String(err)), { status: 500 });
  }
}

export default function Playground() {
  const { project } = useLoaderData<typeof loader>();
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string, citations?: any[], timestamp?: Date }[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;
    
    const userMsg = input;
    const now = new Date();
    setInput("");
    setMessages(prev => [...prev, { role: 'user', content: userMsg, timestamp: now }]);
    setMessages(prev => [...prev, { role: 'assistant', content: "", citations: [], timestamp: new Date() } as any]);
    setIsStreaming(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id, message: userMsg }),
      });

      if (!response.body) return;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const raw = decoder.decode(value);
        const chunks = raw.split("\n\n");
        for (const chunk of chunks) {
          if (chunk.startsWith("event: metadata")) {
             // Handle metadata in next line
             const dataChunk = chunks[chunks.indexOf(chunk) + 1];
             if (dataChunk?.startsWith("data: ")) {
               try {
                 const meta = JSON.parse(dataChunk.slice(6));
                 if (meta.citations) {
                   setMessages(prev => {
                     const newMsgs = [...prev];
                     newMsgs[newMsgs.length - 1] = { ...(newMsgs[newMsgs.length - 1] as any), citations: meta.citations };
                     return newMsgs;
                   });
                 }
               } catch (e) {}
             }
          }

          if (chunk.startsWith("data: ")) {
            try {
              const data = JSON.parse(chunk.slice(6));
              if (data.content) {
                accumulated += data.content;
                setMessages(prev => {
                  const newMsgs = [...prev];
                  newMsgs[newMsgs.length - 1] = { ...newMsgs[newMsgs.length - 1], content: accumulated };
                  return newMsgs;
                });
              }
            } catch (e) {}
          }
        }
      }
    } catch (error) {
      console.error("Playground chat error:", error);
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <div className="h-[calc(100vh-7rem)] flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <Link to={`/dashboard/projects/${project.id}`} className="inline-flex items-center gap-2 text-sm font-bold text-text-muted hover:text-brand-gray transition-colors mb-2">
            <ChevronLeft className="w-4 h-4" /> Back to project
          </Link>
          <h1 className="text-4xl font-black">AI Playground</h1>
        </div>
        
        <div className="px-4 py-2 bg-primary-muted text-primary rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-2">
          <Sparkles className="w-3 h-3" /> Testing Mode
        </div>
      </div>

      <div className="flex-1 bg-white border border-zinc-100 rounded-[40px] flex flex-col overflow-hidden shadow-xl shadow-zinc-200/20">
        {/* Chat Area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-8">
          <div className="max-w-3xl mx-auto space-y-6">
          {messages.length === 0 && (
            <div className="text-center py-20 bg-zinc-50/50 rounded-[32px] border border-zinc-100 border-dashed">
              <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                <MessageSquare className="text-zinc-300 w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold mb-2">Start a conversation</h2>
              <p className="text-text-muted max-w-xs mx-auto">
                Test your AI's responses based on the sources you've trained it on.
              </p>
            </div>
          )}
          
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex gap-4 max-w-[90%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  msg.role === 'user' ? 'bg-zinc-900' : 'bg-primary'
                }`}>
                  {msg.role === 'user' ? <div className="text-white text-xs font-bold">ME</div> : <Bot className="text-white w-5 h-5" />}
                </div>
                <div className="flex flex-col">
                  <div className={`p-6 rounded-[32px] text-lg leading-relaxed prose prose-zinc max-w-none ${
                    msg.role === 'user' 
                      ? 'bg-zinc-900 text-white rounded-tr-none' 
                      : 'bg-zinc-100 text-zinc-800 rounded-tl-none'
                  }`}>
                    <Markdown>{msg.content}</Markdown>
                    
                    {msg.role === 'assistant' && (msg as any).citations?.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-zinc-300/20">
                        <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-2">Sources</p>
                        <div className="flex flex-wrap gap-2">
                          {(msg as any).citations.map((cite: any, i: number) => (
                            <a 
                              key={i} 
                              href={cite.url} 
                              target="_blank" 
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 px-2 py-1 bg-white/50 border border-zinc-200 rounded-lg text-[10px] font-bold text-primary hover:border-primary transition-all decoration-none"
                            >
                              <ExternalLink className="w-3 h-3" /> {cite.title || 'Source'}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  {msg.timestamp && (
                    <span className={`text-[10px] mt-1 opacity-30 font-bold uppercase tracking-widest px-2 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
          
          {isStreaming && (
            <div className="flex justify-start">
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                  <Bot className="text-white w-5 h-5" />
                </div>
                <div className="bg-zinc-100 p-6 rounded-[32px] rounded-tl-none flex gap-1.5 items-center">
                  <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></span>
                  <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                  <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                </div>
              </div>
            </div>
          )}
          </div>
        </div>

        {/* Input Area */}
        <div className="p-10 border-t border-zinc-100 bg-zinc-50/30">
          <div className="max-w-4xl mx-auto relative">
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask your AI something..."
              className="w-full px-8 py-6 bg-white border border-zinc-100 rounded-3xl shadow-lg shadow-zinc-200/50 focus:ring-4 focus:ring-primary/5 outline-none transition-all pr-20 font-medium"
            />
            <button 
              onClick={handleSend}
              disabled={!input.trim() || isStreaming}
              className="absolute right-3 top-3 bottom-3 aspect-square bg-primary text-white rounded-2xl flex items-center justify-center hover:bg-primary/90 disabled:opacity-30 transition-all active:scale-95 shadow-lg shadow-primary/20"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          <p className="text-center text-[11px] font-black uppercase tracking-widest text-zinc-300 mt-6 overflow-hidden">
            Testing responses for: {project.name}
          </p>
        </div>
      </div>
    </div>
  );
}
