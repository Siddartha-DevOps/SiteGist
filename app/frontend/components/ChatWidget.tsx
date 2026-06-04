import * as React from "react";
import { useState, useEffect } from "react";
import { Logo } from "./Logo";
import { X, Send, Bot, MessageSquare, Sparkles, Copy, ThumbsUp, ThumbsDown, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";

/**
 * ActionButtons
 * Reusable component for message actions (copy, like, dislike).
 */
const ActionButtons = ({ text, id, reactions, handleCopy, handleReaction, copiedId }: { 
  text: string; 
  id: number | string; 
  reactions: Record<string | number, 'like' | 'dislike' | null>;
  handleCopy: (text: string, id: number | string) => void;
  handleReaction: (id: string | number, type: 'like' | 'dislike') => void;
  copiedId: number | string | null;
}) => {
  const reaction = reactions[id];
  
  return (
    <div className="absolute -bottom-4 right-4 flex items-center gap-0.5 p-1 bg-white border border-zinc-100 rounded-2xl shadow-lg transition-all duration-300 opacity-0 -translate-y-1 pointer-events-none group-hover/msg:opacity-100 group-hover/msg:translate-y-0 group-hover/msg:pointer-events-auto z-20 hover:shadow-xl">
      <div className="relative">
        <button 
          onClick={() => handleCopy(text, id)}
          className={`p-2 rounded-xl transition-all ${copiedId === id ? 'text-green-500 bg-green-50' : 'text-zinc-400 hover:text-[#155DEE] hover:bg-[#155DEE]/5'} active:scale-90`}
          title="Copy"
        >
          {copiedId === id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
      <button 
        onClick={() => handleReaction(id, 'like')}
        className={`p-2 rounded-xl transition-all ${reaction === 'like' ? 'text-[#155DEE] bg-[#155DEE]/10' : 'text-zinc-400 hover:text-[#155DEE] hover:bg-[#155DEE]/5'} active:scale-90`}
        title="Like"
      >
        <ThumbsUp className={`w-3.5 h-3.5 ${reaction === 'like' ? 'fill-current' : ''}`} />
      </button>
      <button 
        onClick={() => handleReaction(id, 'dislike')}
        className={`p-2 rounded-xl transition-all ${reaction === 'dislike' ? 'text-zinc-800 bg-zinc-100' : 'text-zinc-400 hover:text-zinc-800 hover:bg-zinc-50'} active:scale-90`}
        title="Dislike"
      >
        <ThumbsDown className={`w-3.5 h-3.5 ${reaction === 'dislike' ? 'fill-current' : ''}`} />
      </button>
    </div>
  );
};

/**
 * ChatWidgetPanel
 * The main chat interface that slides into view.
 */
function ChatWidgetPanel({ onClose, suggestions: propSuggestions }: {
  onClose: () => void;
  suggestions?: string[];
}) {
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string; timestamp?: Date }[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<number | string | null>(null);
  const [reactions, setReactions] = useState<Record<string | number, 'like' | 'dislike' | null>>({});
  const [showSuggestions, setShowSuggestions] = useState(true);

  const suggestedQuestions = (propSuggestions && propSuggestions.length > 0)
    ? propSuggestions
    : [
        "Can you tell me more about the AI-powered answers feature?",
        "What kind of tools can I integrate with SiteGist?",
        "How does the multi-channel deployment work?",
      ];

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

  const handleSuggestionClick = (question: string) => {
    setInput(question);
    handleSend(question);
  };

  const getRelativeTime = (date?: Date) => {
    if (!date) return "just now";
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    if (diff < 60000) return "just now";
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  useEffect(() => {
    const el = document.getElementById("chat-messages");
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isTyping]);

  const handleSend = async (overrideInput?: string) => {
    const textToSend = overrideInput || input;
    if (!textToSend.trim() || isTyping) return;

    const userMessage = textToSend.trim();
    const now = new Date();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage, timestamp: now }]);
    setIsTyping(true);
    setShowSuggestions(false);

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
              if (data.sessionId) {
                setSessionId(data.sessionId);
              }
            } catch (e) {
              console.warn("Failed to parse SSE data line:", trimmedLine);
            }
          } else if (trimmedLine.startsWith("event: ")) {
            // Stream metadata and type indicators are followed by corresponding data lines. Safe to skip here.
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
      setShowSuggestions(true);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20, originX: 1, originY: 1 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 20 }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
      className="w-[420px] h-[720px] max-h-[90vh] bg-white rounded-[32px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.25)] border border-zinc-100 overflow-hidden flex flex-col mb-2 ring-1 ring-black/5"
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
      <div id="chat-messages" className="flex-1 overflow-y-auto p-5 space-y-6 bg-zinc-50/10">
        <div className="flex items-end gap-2">
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shrink-0 border border-zinc-100 shadow-sm overflow-hidden p-1.5 mb-1">
            <Logo size="sm" hideText className="scale-75" />
          </div>
          <div className="flex flex-col max-w-[85%]">
            <div className="bg-white p-4 rounded-2xl rounded-tl-none rounded-bl-none border border-zinc-100 text-[13px] font-medium text-zinc-900 shadow-sm leading-relaxed relative group/msg">
              <div className="text-zinc-900 space-y-2">
                <p>👋 Hi, I’m the SiteGIST Assistant — built by SiteGIST itself.</p>
                <p>Ask me about:</p>
                <p>
                  • AI-powered answers from your content<br/>
                  • Multi-channel deployment<br/>
                  • Lead capture with customizable forms<br/>
                  • Human agent handoff (Slack/Zendesk)<br/>
                  • Integrations (Zapier, Notion, etc)
                </p>
              </div>

              <ActionButtons 
                text={`👋 Hi, I’m the SiteGIST Assistant — built by SiteGIST itself.\nAsk me about:\n• AI-powered answers from your content\n• Multi-channel deployment\n• Lead capture with customizable forms\n• Human agent handoff (Slack/Zendesk)\n• Integrations (Zapier, Notion, etc)`} 
                id="welcome" 
                reactions={reactions}
                handleCopy={handleCopy}
                handleReaction={handleReaction}
                copiedId={copiedId}
              />
            </div>

            <span className="text-[9px] mt-1.5 ml-1 opacity-40 font-bold uppercase tracking-wider">
              just now
            </span>
          </div>
        </div>

        {messages.map((msg, i) => (
          <div key={i} className={`flex items-end gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
            {msg.role === "assistant" && (
              <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shrink-0 border border-zinc-200 shadow-sm overflow-hidden p-1.5 mb-1">
                <Logo size="sm" hideText className="scale-75" />
              </div>
            )}
            <div className={`flex flex-col max-w-[85%] relative group/msg`}>
              <div className={`p-4 rounded-2xl text-[13px] font-medium shadow-sm leading-relaxed whitespace-pre-wrap relative ${
                msg.role === "user" 
                  ? "bg-[#0A2D60] text-white rounded-tr-none" 
                  : "bg-white text-zinc-900 border border-zinc-200/50 rounded-tl-none rounded-bl-none"
              }`}>
                {msg.content ? (
                  <div>
                    {msg.content}
                  </div>
                ) : (
                  <span className="flex gap-1 animate-pulse"><span className="w-1.5 h-1.5 bg-zinc-400 rounded-full"></span>.</span>
                )}
                
                {msg.role === "assistant" && msg.content && (
                  <ActionButtons text={msg.content} id={i} reactions={reactions} handleCopy={handleCopy} handleReaction={handleReaction} copiedId={copiedId} />
                )}
              </div>

              <span className={`text-[9px] mt-1.5 opacity-40 font-bold uppercase tracking-wider ${msg.role === "user" ? "text-right mr-1" : "ml-1"}`}>
                {getRelativeTime(msg.timestamp)}
              </span>
            </div>
          </div>
        ))}

        {showSuggestions && !isTyping && messages.length > 0 && messages[messages.length - 1].role === 'assistant' && (
          <div className="flex flex-col gap-2 pl-11 pt-2">
            {suggestedQuestions.map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleSuggestionClick(q)}
                className="text-[12px] text-zinc-600 font-medium bg-zinc-50 hover:bg-[#155DEE]/5 hover:text-[#155DEE] border border-zinc-100 hover:border-[#155DEE]/20 px-3 py-2 rounded-xl transition-all text-left w-fit shadow-sm"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {isTyping && messages[messages.length-1]?.role !== 'assistant' && (
          <div className="flex items-end gap-2 text-left">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shrink-0 border border-zinc-200 shadow-sm overflow-hidden p-1.5 mb-1">
              <Logo size="sm" hideText className="scale-75" />
            </div>
            <div className="bg-white px-4 py-3 rounded-2xl rounded-tl-none rounded-bl-none border border-zinc-100 shadow-sm flex gap-1">
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
        <div className="flex items-center justify-center gap-1.5 mt-4 group cursor-default">
           <span className="text-[9px] font-black uppercase tracking-[0.12em] text-zinc-400">Powered by</span>
           <Logo size="sm" hideText className="scale-75 transition-all opacity-30 grayscale group-hover:opacity-100 group-hover:grayscale-0" />
           <span className="text-[10px] font-black uppercase tracking-tight -ml-1">
             <span className="text-zinc-800">Site</span><span className="text-[#155DEE]">Gist</span>
           </span>
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
export function ChatWidget({ suggestions }: { suggestions?: string[] } = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return (
    <div className="fixed bottom-4 right-6 z-[100] flex flex-col items-end opacity-0 pointer-events-none">
       {/* Placeholder to avoid hydration mismatch */}
    </div>
  );

  return (
    <div className="fixed bottom-4 right-6 z-[100] flex flex-col items-end" suppressHydrationWarning>
      <AnimatePresence mode="wait">
        {isOpen && <ChatWidgetPanel onClose={() => setIsOpen(false)} suggestions={suggestions} />}
      </AnimatePresence>
      <ChatWidgetLauncher isOpen={isOpen} onClick={() => setIsOpen(!isOpen)} />
    </div>
  );
}
