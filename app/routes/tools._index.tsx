import { Header } from "~/frontend/components/Header";
import { Footer } from "~/frontend/components/Footer";
import { 
  FileText, 
  Globe, 
  Code, 
  Layout, 
  FileJson, 
  Table, 
  ChevronRight,
  Sparkles,
  Zap,
  MessageSquare,
  FileCode,
  Search,
  CheckCircle2,
  List,
  Calculator,
  Mail,
  RefreshCcw,
  AtSign,
  Type
} from "lucide-react";
import { Link } from "@remix-run/react";

export default function ToolsIndex() {
  const toolCategories = [
    {
      title: "Convert to Markdown",
      tools: [
        { name: "Convert PDF to Markdown", to: "/tools/convert-pdf-to-markdown" },
        { name: "Convert DOCX to Markdown", to: "/tools/convert-docx-to-markdown" },
        { name: "Convert HTML to Markdown", to: "/tools/convert-html-to-markdown" },
        { name: "Convert Notion to Markdown", to: "/tools/convert-notion-to-markdown" },
        { name: "Convert Google Docs to Markdown", to: "/tools/convert-gdocs-to-markdown" },
        { name: "Convert XML to Markdown", to: "/tools/convert-xml-to-markdown" },
        { name: "Convert CSV to Markdown", to: "/tools/convert-csv-to-markdown" },
        { name: "Convert JSON to Markdown", to: "/tools/convert-json-to-markdown" },
        { name: "Convert RTF to Markdown", to: "/tools/convert-rtf-to-markdown" },
        { name: "Convert Paste to Markdown", to: "/tools/convert-paste-to-markdown" },
        { name: "Convert Webpage to Markdown", to: "/tools/convert-webpage-to-markdown" },
      ]
    },
    {
      title: "AI Chat Tools",
      tools: [
        { name: "AI Chat with Your Text Data", to: "/tools/chat-text" },
        { name: "AI Chat with Your Website Data", to: "/tools/chat-website" },
        { name: "AI Chat with Your Document & Data", to: "/tools/chat-document" },
        { name: "AI Chat with Your PDF Document & Data", to: "/tools/chat-pdf" },
        { name: "AI Chat with Your Word Document & Data", to: "/tools/chat-word" },
      ]
    },
    {
      title: "AI Generators",
      tools: [
        { name: "AI Reply Generator", to: "/tools/generator-reply" },
        { name: "AI Prompt Generator", to: "/tools/generator-prompt" },
        { name: "AI Prompt Optimizer", to: "/tools/generator-optimize" },
        { name: "AI FAQ Generator", to: "/tools/generator-faq" },
        { name: "AI Answer Generator", to: "/tools/generator-answer" },
        { name: "AI Email Response Generator", to: "/tools/generator-email" },
        { name: "AI Letter Generator", to: "/tools/generator-letter" },
        { name: "AI Blog Title Generator", to: "/tools/generator-blog-title" },
        { name: "AI Chatbot Name Generator", to: "/tools/generator-chatbot-name" },
        { name: "AI SaaS Brand Name Generator", to: "/tools/generator-brand-name" },
      ]
    },
    {
      title: "Integrations & Sync",
      tools: [
        { name: "Chat-to-Ticket (Zendesk)", to: "/tools/chat-to-ticket" },
        { name: "Chat-to-Slack Connector", to: "/tools/chat-slack" },
        { name: "Discord Alert Webhook", to: "/tools/discord-alerts" },
        { name: "Connect Notion Database", to: "/tools/notion-sync" },
        { name: "Google Drive File Sync", to: "/tools/gdrive-sync" },
      ]
    },
    {
      title: "Automated AI Creators",
      tools: [
        { name: "Auto-FAQ Generator from URL", to: "/tools/auto-faq" },
        { name: "Auto-Knowledge Base from Docs", to: "/tools/auto-kb" },
        { name: "AI Sitemap to Training Set", to: "/tools/sitemap-to-training" },
        { name: "Chatbot Personality Crafter", to: "/tools/persona-craft" },
      ]
    },
    {
      title: "All Tools",
      tools: [
        { name: "AI Chatbot Conversation Analysis", to: "/tools/analysis" },
        { name: "Sitemap Finder & Checker", to: "/tools/sitemap-finder" },
        { name: "Sitemap Validator", to: "/tools/sitemap-validator" },
        { name: "XML Sitemap Generator", to: "/tools/sitemap-generator" },
        { name: "Sitemap URL Extractor", to: "/tools/sitemap-extractor" },
        { name: "Website URL Extractor", to: "/tools/url-extractor" },
        { name: "Chatbot ROI Calculator", to: "/tools/roi-calculator" },
        { name: "Email Signature Generator", to: "/tools/email-signature" },
        { name: "SourceSync.ai", to: "https://sourcesync.ai" },
      ]
    }
  ];

  return (
    <div className="bg-[#FAF7F2] min-h-screen">
      <div className="pt-32 pb-20 px-6 max-w-7xl mx-auto">
        {/* Hero Section */}
        <div className="flex flex-col md:flex-row items-center gap-12 mb-32 bg-white p-12 rounded-[60px] border border-brand-border">
          <div className="flex-1 text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-light text-brand-gray text-[10px] font-bold uppercase tracking-widest mb-6 border border-brand-border">
              <Sparkles className="w-3 h-3 text-brand-accent" />
              Build with confidence
            </div>
            <h1 className="text-4xl md:text-7xl font-extrabold text-brand-dark mb-6 tracking-tight leading-[1.05]">
              EXPLORE <span className="text-brand-accent">AI TOOLS</span>
            </h1>
            <p className="text-xl text-brand-gray font-medium leading-relaxed max-w-lg mb-8">
              Build, learn, and explore the full power of SiteGist AI tools. Professional resources for your AI-powered future.
            </p>
          </div>
          <div className="flex-1 flex flex-col items-center">
            <div className="relative">
              <div className="w-full max-w-sm aspect-square bg-brand-light rounded-[40px] flex items-center justify-center border border-brand-border relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-brand-accent/5 to-transparent"></div>
                <div className="relative z-10 scale-125">
                  <svg width="240" height="240" viewBox="0 0 240 240" fill="none" xmlns="http://www.w3.org/2000/svg">
                    {/* Background circles for depth */}
                    <circle cx="120" cy="120" r="100" fill="#FF5C00" fillOpacity="0.03" />
                    <circle cx="120" cy="120" r="70" fill="#FF5C00" fillOpacity="0.05" />
                    
                    {/* Character head */}
                    <circle cx="120" cy="85" r="45" stroke="#1A1A1A" strokeWidth="4" fill="white" />
                    
                    {/* Character body/tunic */}
                    <path d="M50 200C50 161.34 81.3401 130 120 130C158.66 130 190 161.34 190 200V210H50V200Z" fill="#FF5C00" fillOpacity="0.1" stroke="#FF5C00" strokeWidth="3" />
                    
                    {/* Floating building blocks - colorful versions of the logo elements */}
                    <rect x="75" y="150" width="24" height="24" rx="6" fill="#FF5C00" className="animate-bounce" style={{ animationDuration: '3s' }} />
                    <rect x="140" y="145" width="20" height="20" rx="5" fill="#1A1A1A" className="animate-bounce" style={{ animationDuration: '4s' }} />
                    <circle cx="120" cy="175" r="12" fill="#FF5C00" fillOpacity="0.4" className="animate-pulse" />
                    
                    {/* Face details */}
                    <circle cx="105" cy="80" r="3" fill="#1A1A1A" />
                    <circle cx="135" cy="80" r="3" fill="#1A1A1A" />
                    <path d="M110 95C110 95 115 100 120 100C125 100 130 95 130 95" stroke="#1A1A1A" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </div>
                {/* Decorative dots to match the 'avatar' feel */}
                {[...Array(6)].map((_, i) => (
                  <div 
                    key={i} 
                    className="absolute w-2 h-2 bg-brand-accent rounded-full opacity-20"
                    style={{ 
                      top: `${Math.random() * 80 + 10}%`, 
                      left: `${Math.random() * 80 + 10}%`,
                      transitionDelay: `${i * 100}ms`
                    }}
                  ></div>
                ))}
              </div>
              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-white px-6 py-3 rounded-2xl border border-brand-border shadow-xl">
                 <div className="w-8 h-8 rounded-lg bg-brand-dark flex items-center justify-center text-white text-xs font-black">S</div>
                 <span className="font-extrabold text-brand-dark text-lg tracking-tighter">SiteGist</span>
              </div>
            </div>
          </div>
        </div>

        {/* Categories Section */}
        <div className="grid md:grid-cols-2 gap-10">
          {toolCategories.map((category) => (
            <div key={category.title} className="bg-white p-10 rounded-[40px] border border-brand-border">
              <h2 className="text-2xl font-extrabold text-brand-dark mb-8 flex items-center gap-3">
                <div className="w-2 h-8 bg-brand-accent rounded-full"></div>
                {category.title}
              </h2>
              <div className="space-y-3">
                {category.tools.map((tool) => (
                  <Link
                    key={tool.name}
                    to={tool.to}
                    className="flex items-center justify-between p-4 rounded-2xl hover:bg-brand-light transition-all group"
                  >
                    <span className="font-bold text-brand-dark group-hover:text-brand-accent transition-colors">
                      {tool.name}
                    </span>
                    <ChevronRight className="w-5 h-5 text-brand-gray/30 group-hover:translate-x-1 transition-all" />
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <Footer />
    </div>
  );
}

