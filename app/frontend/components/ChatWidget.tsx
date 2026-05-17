import { useState, useEffect } from "react";
import { Logo } from "./Logo";
import { X, Send, Bot, MessageSquare, Sparkles, Copy, ThumbsUp, ThumbsDown, Check } from "lucide-react";
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
  const [copiedId, setCopiedId] = useState<number | string | null>(null);
  const [reactions, setReactions] = useState<Record<string | number, 'like' | 'dislike' | null>>({});

  const handleCopy = (text: string, id: number | string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleReaction = (id: string | number, type: 'like' | 'dislike') => {
    setReactions(prev => ({
      ...prev,
      [id]: prev[id] === type ? null : type
    }));
  };

  const ActionButtons = ({ text, id, isWelcome = false }: { text: string; id: number | string; isWelcome?: boolean }) => {
    const reaction = reactions[id];
    
    return (
      <div className={`absolute bottom-1 right-1 flex items-center gap-0.5 opacity-0 group-hover/msg:opacity-100 transition-all duration-200 pr-1 pb-1`}>
        <div className="relative">
          <button 
            onClick={() => handleCopy(text, id)}
            className="p-1.5 rounded-lg hover:bg-white hover:shadow-sm transition-all text-zinc-400 hover:text-[#155DEE] group/btn"
          >
            {copiedId === id ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <AnimatePresence>
            {copiedId === id && (
              <motion.div 
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 5 }}
                exit={{ opacity: 0, y: -5 }}
                className="absolute left-1/2 -translate-x-1/2 top-full mt-1 px-1.5 py-0.5 bg-zinc-800 text-white text-[10px] rounded shadow-lg whitespace-nowrap z-50 pointer-events-none"
              >
                Copied!
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <button 
          onClick={() => handleReaction(id, 'like')}
          className={`p-1.5 rounded-lg hover:bg-white hover:shadow-sm transition-all ${reaction === 'like' ? 'text-[#155DEE] bg-white shadow-sm' : 'text-zinc-400 hover:text-[#155DEE]'}`}
        >
          <ThumbsUp className={`w-3.5 h-3.5 ${reaction === 'like' ? 'fill-current' : ''}`} />
        </button>
        <button 
          onClick={() => handleReaction(id, 'dislike')}
          className={`p-1.5 rounded-lg hover:bg-white hover:shadow-sm transition-all ${reaction === 'dislike' ? 'text-zinc-800/80 bg-white shadow-sm' : 'text-zinc-400 hover:text-zinc-800'}`}
        >
          <ThumbsDown className={`w-3.5 h-3.5 ${reaction === 'dislike' ? 'fill-current' : ''}`} />
        </button>
      </div>
    );
  };

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
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          projectId: "demo-project",
          message: userMessage, 
          sessionId 
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }
      if (!response.body) throw new Error("Response body is empty");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = "";
      let buffer = "";

      // Add empty assistant message to start streaming into
      const assistantStartTime = new Date();
      setMessages((prev) => [...prev, { role: "assistant", content: "", timestamp: assistantStartTime }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        // Keep the last partial line in the buffer
        buffer = lines.pop() || "";
        
        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine) continue;
          
          if (trimmedLine.startsWith("data: ")) {
            try {
              const data = JSON.parse(trimmedLine.slice(6));
              if (data.content) {
                const content = data.content;
                if (content.toLowerCase().includes("[error]")) {
                  const errorMsg = content.replace(/\[ERROR\]/i, "").trim();
                  assistantMessage = `❌ Error: ${errorMsg}`;
                } else {
                  assistantMessage += content;
                }
                
                setMessages((prev) => {
                  const newMessages = [...prev];
                  const lastIndex = newMessages.length - 1;
                  if (newMessages[lastIndex].role === "assistant") {
                    newMessages[lastIndex] = {
                      ...newMessages[lastIndex],
                      content: assistantMessage,
                    };
                  }
                  return newMessages;
                });
              }
            } catch (e) {
              console.warn("Failed to parse SSE data line:", trimmedLine);
            }
          } else if (trimmedLine.startsWith("event: session")) {
            // Wait for next 'data' line which follows session event
          } else if (trimmedLine.startsWith("event: metadata")) {
             // Metadata context...
          }
        }
      }
    } catch (error) {
      console.error("Chat Error:", error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `⚠️ Connection Error: ${errorMsg}. Please check your internet or API keys.` },
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
      className="w-[380px] h-[650px] max-h-[85vh] bg-white rounded-[32px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.25)] border border-zinc-100 overflow-hidden flex flex-col mb-2 ring-1 ring-black/5"
    >
      {/* Header */}
      <div className="bg-white p-5 text-zinc-800 flex items-center justify-between border-b border-zinc-100 relative overflow-hidden group">
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-10 h-10 flex items-center justify-center">
            <Logo size="sm" hideText />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] font-black flex items-center gap-1.5 bg-clip-text text-transparent bg-gradient-to-r from-[#155DEE] to-[#7C6EF0]">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse shrink-0" />
              ASK SiteGIST
            </p>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="p-2 hover:bg-zinc-100 rounded-lg transition-colors relative z-10 text-zinc-400 hover:text-zinc-600"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Messages Area */}
      <div id="chat-messages" className="flex-1 overflow-y-auto p-5 space-y-4 bg-white">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shrink-0 border border-zinc-100 shadow-sm overflow-hidden p-1">
            <Logo size="sm" hideText className="scale-75" />
          </div>
          <div className="bg-zinc-50/50 p-4 rounded-2xl rounded-tl-none border border-zinc-100 text-[13px] font-medium text-zinc-800 shadow-sm leading-relaxed max-w-[85%] whitespace-pre-line relative group/msg overflow-hidden">
            👋 Hi, I’m the SiteGIST Assistant — built by SiteGIST itself.{"\n"}
            Ask me about:{"\n"}
            • Plans & pricing{"\n"}
            • Setup & integrations{"\n"}
            • Security & privacy{"\n"}
            • Enterprise & other options.

            <ActionButtons 
              text={`👋 Hi, I’m the SiteGIST Assistant — built by SiteGIST itself.\nAsk me about:\n• Plans & pricing\n• Setup & integrations\n• Security & privacy\n• Enterprise & other options.`} 
              id="welcome" 
              isWelcome 
            />
          </div>
        </div>

        {messages.map((msg, i) => (
          <div key={i} className={`flex items-start gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
            {msg.role === "assistant" && (
              <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shrink-0 border border-zinc-200 shadow-sm overflow-hidden p-1">
                <Logo size="sm" hideText className="scale-75" />
              </div>
            )}
            <div className={`flex flex-col max-w-[85%] relative group/msg`}>
              <div className={`p-4 rounded-2xl text-[13px] font-medium shadow-sm leading-relaxed overflow-hidden ${
                msg.role === "user" 
                  ? "bg-white text-zinc-800 border border-zinc-100 rounded-tr-none" 
                  : "bg-zinc-50/50 text-zinc-800 border border-zinc-100 rounded-tl-none"
              }`}>
                {msg.content || <span className="flex gap-1 animate-pulse"><span className="w-1.5 h-1.5 bg-zinc-400 rounded-full"></span>.</span>}
                
                {msg.role === "assistant" && msg.content && (
                  <ActionButtons text={msg.content} id={i} />
                )}
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
          className="flex gap-2 p-2 bg-zinc-50 border border-zinc-100 rounded-2xl focus-within:ring-2 focus-within:ring-[#155DEE]/10 focus-within:border-[#155DEE] transition-all"
        >
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            disabled={isTyping}
            className="flex-1 bg-transparent px-3 text-sm font-medium outline-none placeholder:text-zinc-400 text-zinc-800"
          />
          <button 
            type="submit"
            disabled={!input.trim() || isTyping}
            className="p-2.5 bg-white border border-zinc-100 text-zinc-400 rounded-xl shadow-sm hover:bg-zinc-50 active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
        <div className="flex items-center justify-center gap-1.5 mt-4 opacity-40 group">
           <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Powered by</span>
           <Logo size="sm" hideText className="scale-50 grayscale group-hover:grayscale-0 transition-all opacity-50" />
           <span className="text-[9px] font-black uppercase tracking-widest text-[#155DEE] -ml-1">SiteGist</span>
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
    <div className="flex flex-col items-end gap-2 group">
      <button
        onClick={onClick}
        className={`relative flex items-center justify-center transition-all duration-500 hover:scale-110 active:scale-90 focus:outline-none ${
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
    </div>
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
    <div className="fixed bottom-4 right-6 z-[100] flex flex-col items-end">
      <AnimatePresence>
        {isOpen && <ChatWidgetPanel onClose={() => setIsOpen(false)} />}
      </AnimatePresence>
      <ChatWidgetLauncher isOpen={isOpen} onClick={() => setIsOpen(!isOpen)} />
    </div>
  );
}
