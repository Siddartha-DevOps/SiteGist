import { useState, useEffect } from "react";
import { Logo } from "./Logo";
import { X, Send, Bot, MessageSquare, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * ChatWidgetPanel
 * The main chat interface that slides into view.
 */
function ChatWidgetPanel({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string; timestamp?: Date }[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    const el = document.getElementById("chat-messages");
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const userMessage = input.trim();
    const now = new Date();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage, timestamp: now }]);
    setIsTyping(true);

    try {
      // For demo purposes on the landing page, we use a placeholder project ID if none exists
      // In a real app, this would be the actual ID of the site's help bot
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          projectId: "demo-project",
          message: userMessage, 
          sessionId 
        }),
      });

      if (!response.ok) throw new Error("Failed to send message");
      if (!response.body) return;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = "";

      // Add empty assistant message to start streaming into
      const assistantStartTime = new Date();
      setMessages((prev) => [...prev, { role: "assistant", content: "", timestamp: assistantStartTime }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const raw = decoder.decode(value);
        const chunks = raw.split("\n\n");
        for (const chunk of chunks) {
          if (chunk.startsWith("data: ")) {
            try {
              const data = JSON.parse(chunk.slice(6));
              if (data.content) {
                if (data.content.startsWith("[ERROR]")) {
                  const errorMsg = data.content.replace("[ERROR]", "").trim();
                  assistantMessage = `❌ Error: ${errorMsg}`;
                } else {
                  assistantMessage += data.content;
                }
                
                setMessages((prev) => {
                  const newMessages = [...prev];
                  newMessages[newMessages.length - 1] = {
                    role: "assistant",
                    content: assistantMessage,
                  };
                  return newMessages;
                });
              }
            } catch (e) {}
          } else if (chunk.startsWith("event: session")) {
            try {
              const dataPart = chunk.split("\ndata: ")[1] || chunk.split("data: ")[1];
              const data = JSON.parse(dataPart);
              if (data.sessionId) setSessionId(data.sessionId);
            } catch (e) {}
          }
        }
      }
    } catch (error) {
      console.error("Chat Error:", error);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I had trouble connecting. Please try again later." },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20, originX: 1, originY: 1 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 20 }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
      className="w-[360px] h-[520px] max-h-[70vh] bg-white rounded-[32px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.25)] border border-zinc-100 overflow-hidden flex flex-col mb-4 ring-1 ring-black/5"
    >
      {/* Header */}
      <div className="bg-primary p-5 text-white flex items-center justify-between shadow-lg shadow-primary/20 relative overflow-hidden group">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.2)_0%,transparent_70%)]" />
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-md shadow-inner ring-1 ring-white/20">
            <Logo size="sm" hideText variant="dark" />
          </div>
          <div>
            <p className="font-bold text-sm tracking-tight">SiteGist Assistant</p>
            <p className="text-[10px] opacity-80 uppercase tracking-widest font-black flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
              AI Support
            </p>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors relative z-10"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Messages Area */}
      <div id="chat-messages" className="flex-1 overflow-y-auto p-5 space-y-4 bg-zinc-50/30">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shrink-0 border border-zinc-200 shadow-sm overflow-hidden p-1">
            <Logo size="sm" hideText className="scale-75" />
          </div>
          <div className="bg-white p-4 rounded-2xl rounded-tl-none border border-zinc-100 text-[13px] font-medium text-brand-dark shadow-sm leading-relaxed max-w-[85%]">
            Hi! I'm SiteGist's knowledge assistant. How can I help you today?
          </div>
        </div>

        {messages.map((msg, i) => (
          <div key={i} className={`flex items-start gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
            {msg.role === "assistant" && (
              <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shrink-0 border border-zinc-200 shadow-sm overflow-hidden p-1">
                <Logo size="sm" hideText className="scale-75" />
              </div>
            )}
            <div className="flex flex-col max-w-[85%]">
              <div className={`p-4 rounded-2xl text-[13px] font-medium shadow-sm leading-relaxed ${
                msg.role === "user" 
                  ? "bg-primary text-white rounded-tr-none" 
                  : "bg-white text-brand-dark border border-zinc-100 rounded-tl-none"
              }`}>
                {msg.content || <span className="flex gap-1 animate-pulse"><span className="w-1.5 h-1.5 bg-zinc-400 rounded-full"></span>.</span>}
              </div>
              {msg.timestamp && (
                <span className={`text-[9px] mt-1 opacity-40 font-bold uppercase tracking-wider ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          </div>
        ))}

        {isTyping && messages[messages.length-1]?.role !== 'assistant' && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shrink-0 border border-zinc-200 shadow-sm overflow-hidden p-1">
              <Logo size="sm" hideText className="scale-75" />
            </div>
            <div className="bg-white px-4 py-3 rounded-2xl rounded-tl-none border border-zinc-100 shadow-sm flex gap-1">
              <div className="w-1.5 h-1.5 bg-zinc-300 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
              <div className="w-1.5 h-1.5 bg-zinc-300 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
              <div className="w-1.5 h-1.5 bg-zinc-300 rounded-full animate-bounce"></div>
            </div>
          </div>
        )}
      </div>

      {/* Footer / Input */}
      <div className="p-4 bg-white border-t border-zinc-100">
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex gap-2 p-2 bg-zinc-50 border border-zinc-100 rounded-2xl focus-within:ring-2 focus-within:ring-primary/10 focus-within:border-primary transition-all"
        >
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            disabled={isTyping}
            className="flex-1 bg-transparent px-3 text-sm font-medium outline-none placeholder:text-zinc-400"
          />
          <button 
            type="submit"
            disabled={!input.trim() || isTyping}
            className="p-2.5 bg-primary text-white rounded-xl shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
        <div className="flex items-center justify-center gap-1.5 mt-4 opacity-30 group">
           <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Powered by</span>
           <Logo size="sm" hideText variant="light" className="scale-50 grayscale group-hover:grayscale-0 transition-all" />
           <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400 -ml-2">SiteGist</span>
        </div>
      </div>
    </motion.div>
  );
}

/**
 * ChatWidgetLauncher
 * The floating button that triggers the panel.
 */
function ChatWidgetLauncher({ isOpen, onClick }: { isOpen: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center justify-center transition-all duration-500 hover:scale-110 active:scale-90 group focus:outline-none ${
        isOpen ? "opacity-100" : "opacity-90 hover:opacity-100"
      }`}
    >
      <div className="relative p-2">
        <Logo 
          size="lg" 
          hideText 
          className={`transition-all duration-500 ${
            isOpen ? "scale-110 drop-shadow-2xl" : "drop-shadow-xl group-hover:drop-shadow-[0_10px_20px_rgba(108,92,231,0.4)]"
          }`} 
        />
        {!isOpen && (
          <div className="absolute top-2 right-2 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white shadow-sm pointer-events-none animate-pulse" />
        )}
      </div>
    </button>
  );
}

/**
 * ChatWidget
 * The high-level component that manages state and layout.
 */
export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end">
      <AnimatePresence>
        {isOpen && <ChatWidgetPanel onClose={() => setIsOpen(false)} />}
      </AnimatePresence>
      <ChatWidgetLauncher isOpen={isOpen} onClick={() => setIsOpen(!isOpen)} />
    </div>
  );
}
