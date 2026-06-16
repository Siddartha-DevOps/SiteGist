import type { MetaFunction } from "@remix-run/node";
import { Header } from "~/frontend/components/Header";

export const meta: MetaFunction = () => [
  { title: "Integrations — Connect Your AI Chatbot | SiteGist" },
  {
    name: "description",
    content:
      "Connect SiteGist to Notion, Google Drive, Slack, Zapier, Freshdesk, Crisp, Intercom, and 5,000+ apps. Sync your knowledge base automatically and route escalations to the right tool.",
  },
  { property: "og:title", content: "Integrations — Connect Your AI Chatbot | SiteGist" },
  {
    property: "og:description",
    content:
      "Notion, Google Drive, Slack, Zapier, Crisp, Intercom, Freshdesk, and 5,000+ more. Connect everything to your AI chatbot.",
  },
];
import { Footer } from "~/frontend/components/Footer";
import { ChatWidget } from "~/frontend/components/ChatWidget";
import { CTAButton } from "~/frontend/components/CTAButton";
import { Link } from "@remix-run/react";
import { 
  Plus, 
  Search, 
  Layers, 
  Database, 
  Workflow, 
  Globe, 
  FileText, 
  Link2, 
  ArrowRight
} from "lucide-react";
import { useState } from "react";

// Helper to render high quality brand logos in filter ecosystem
function renderEcosystemIcon(name: string) {
  switch (name) {
    case "HubSpot":
      return (
        <svg viewBox="0 0 24 24" className="w-7 h-7 fill-[#FF7A59]" xmlns="http://www.w3.org/2000/svg">
          <path d="M21.4 11.6c-.2 0-.4-.1-.5-.2l-2.6-2.6c-.3-.3-.3-.8 0-1.1l.8-.8c-.7-.9-1.8-1.5-3-1.7V6c0-.4-.3-.7-.7-.7h-.8c-.4 0-.7.3-.7.7V5.2c-1.2.2-2.3.8-3 1.7L11.7 6c.3-.3.3-.8 0-1.1l-.8-.8c-.3-.3-.8-.3-1.1 0l-2 2c-.3.3-.3.8 0 1.1l.6.6c-1.1 1.2-1.7 2.8-1.7 4.5 0 2 1 3.8 2.5 5l-.3.3c-.3.3-.3.8 0 1.1l1.1 1.1c.3.3.8.3 1.1 0l.3-.3c1 .5 2.1.8 3.3.8.6 0 1.2-.1 1.8-.2V21c0 .4.3.7.7.7h.8c.4 0 .7-.3.7-.7V21c2.1-.5 3.9-1.9 4.8-4l.8.8c.3.3.8.3 1.1 0l1.1-1.1c.3-.3.3-.8 0-1.1l-.8-.8c.7-.9 1.2-2 1.4-3.2h.7c.4 0 .7-.3.7-.7v-.8c-.1-.3-.4-.5-.7-.5zM12 15c-1.7 0-3-1.3-3-3s1.3-3 3-3 3 1.3 3 3-1.3 3-3 3z"/>
        </svg>
      );
    case "Salesforce":
      return (
        <svg viewBox="0 0 24 24" className="w-7.5 h-7.5 fill-[#00A1E0]" xmlns="http://www.w3.org/2000/svg">
          <path d="M19.35 10.04C18.67 6.59 15.64 4 11.99 4c-2.91 0-5.42 1.64-6.65 4.04C2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z" />
        </svg>
      );
    case "Slack":
      return (
        <svg viewBox="0 0 24 24" className="w-7 h-7" xmlns="http://www.w3.org/2000/svg">
          <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523 2.528 2.528 0 0 1-2.522-2.523 2.528 2.528 0 0 1 2.522-2.52h2.52v2.52zm1.261 0a2.528 2.528 0 0 1 2.52-2.52h5.043a2.528 2.528 0 0 1 2.522 2.52v5.04a2.528 2.528 0 0 1-2.522 2.52H8.823a2.528 2.528 0 0 1-2.52-2.52v-5.04zM8.823 5.043a2.528 2.528 0 0 1-2.52-2.52A2.528 2.528 0 0 1 8.823 0a2.528 2.528 0 0 1 2.52 2.522v2.521h-2.52zm0 1.261a2.528 2.528 0 0 1 2.52 2.52v5.043a2.528 2.528 0 0 1-2.52 2.522H3.78a2.528 2.528 0 0 1-2.52-2.522V8.824a2.528 2.528 0 0 1 2.52-2.52h5.043zm10.135 3.761a2.528 2.528 0 0 1 2.522-2.52 2.528 2.528 0 0 1 2.52 2.52 2.528 2.528 0 0 1-2.52 2.522h-2.522v-2.522zm-1.262 0a2.528 2.528 0 0 1-2.52 2.52h-5.043a2.528 2.528 0 0 1-2.521-2.52V3.783a2.528 2.528 0 0 1 2.521-2.52h5.043a2.528 2.528 0 0 1 2.52 2.52v5.043zm-3.76 10.135a2.528 2.528 0 0 1 2.52 2.52 2.528 2.528 0 0 1-2.52 2.522 2.528 2.528 0 0 1-2.522-2.522v-2.52h2.522zm0-1.262a2.528 2.528 0 0 1-2.522-2.52v-5.042a2.528 2.528 0 0 1 2.522-2.521h5.04a2.528 2.528 0 0 1 2.523 2.521v5.042a2.528 2.528 0 0 1-2.523 2.52h-5.04z" fill="#E01E5A"/>
          <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52-2.52h2.52v2.52zm1.261 0v-5.04h5.043v5.04H6.303z" fill="#36C5F0"/>
          <path d="M8.823 5.043a2.528 2.528 0 0 1 2.52 2.52h-2.52v-2.52zm0 1.261h5.043v5.043H8.823V6.304z" fill="#2EB67D"/>
          <path d="M18.827 8.824a2.528 2.528 0 0 1 2.522 2.52h-2.522V8.824zm-1.262 0v5.043h-5.043V8.824h5.043z" fill="#ECB22E"/>
        </svg>
      );
    case "Zapier":
      return (
        <svg viewBox="0 0 24 24" className="w-8 h-8 fill-[#FF4F00]" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 0c-.8 0-1.5.7-1.5 1.5v5.3l-3.7-3.7c-.6-.6-1.5-.6-2.1 0s-.6 1.5 0 2.1l3.7 3.7h-5.3c-.8 0-1.5.7-1.5 1.5s.7 1.5 1.5 1.5h5.3l-3.7 3.7c-.6.6-.6 1.5 0 2.1s1.5.6 2.1 0l3.7-3.7v5.3c0 .8.7 1.5 1.5 1.5s1.5-.7 1.5-1.5v-5.3l3.7 3.7c.6.6 1.5.6 2.1 0s.6-1.5 0-2.1l-3.7-3.7h5.3c.8 0 1.5-.7 1.5-1.5s-.7-1.5-1.5-1.5h-5.3l3.7-3.7c.6-.6.6-1.5 0-2.1s-1.5-.6-2.1 0l-3.7 3.7v-5.3c0-.8-.7-1.5-1.5-1.5z"/>
        </svg>
      );
    case "Resend":
      return (
        <svg className="w-7 h-7 stroke-current text-[#101828]" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="4" width="18" height="16" rx="4"></rect>
          <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path>
        </svg>
      );
    case "Intercom":
      return (
        <svg viewBox="0 0 24 24" className="w-8 h-8 fill-[#1F8EFA]" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm1 14.5c0 .28-.22.5-.5.5h-1c-.28 0-.5-.22-.5-.5v-1c0-.28.22-.5.5-.5h1c.28 0 .5.22.5.5v1zm2.32-5.46c-.34.58-.93.99-1.32 1.39-.33.34-.5.64-.5 1.07 0 .28-.22.5-.5.5h-1c-.28 0-.5-.22-.5-.5 0-.97.43-1.63.97-2.18.36-.36.79-.69 1.03-1.09.28-.48.14-1.22-.44-1.42-.51-.18-1.07.13-1.26.63-.1.26-.36.43-.64.43h-1.02c-.44 0-.75-.41-.61-.83.47-1.47 1.95-2.48 3.59-2.28 1.69.21 3 1.63 3.09 3.32.04.79-.2 1.58-.65 2.18z"/>
        </svg>
      );
    case "Shopify":
      return (
        <svg className="w-7 h-7 fill-[#95BF47]" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M19.5 6h-3.3c-.6-3.2-2.7-5-4.2-5s-3.6 1.8-4.2 5H4.5c-.8 0-1.5.7-1.5 1.5l1.5 14c.1.8.8 1.5 1.6 1.5h11.8c.8 0 1.5-.7 1.6-1.5l1.5-14c.1-.8-.6-1.5-1.5-1.5zm-7.5-3.5c.7 0 1.9 1 2.3 3.5H9.7c.4-2.5 1.6-3.5 2.3-3.5zM12 17c-2.2 0-4-1.8-4-4s1.8-4 4-4 4 1.8 4 4-1.8 4-4 4z"/>
        </svg>
      );
    case "Zendesk":
      return (
        <svg className="w-7 h-7 fill-[#03363D]" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M19.7 18.2l-6-10.3c-.6-1-1.8-1-2.4 0L5.3 18.2c-.6 1 .1 2.3 1.2 2.3h12c1.1 0 1.8-1.3 1.2-2.3z M6.6 3.5C5.5 3.5 4.8 4.8 5.4 5.8l6 10.3c.6 1 1.8 1 2.4 0l6-10.3c.6-1-.1-2.3-1.2-2.3H6.6z"/>
        </svg>
      );
    case "Make.com":
      return (
        <svg className="w-7 h-7" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <circle cx="6" cy="12" r="4" fill="#A855F7" />
          <circle cx="18" cy="6" r="4" fill="#EC4899" />
          <circle cx="18" cy="18" r="4" fill="#3B82F6" />
          <line x1="6" y1="12" x2="18" y2="6" stroke="#94A3B8" strokeWidth="2.5" />
          <line x1="6" y1="12" x2="18" y2="18" stroke="#94A3B8" strokeWidth="2.5" />
        </svg>
      );
    case "Mailchimp":
      return (
        <svg className="w-7.5 h-7.5 fill-[#FFE01B]" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15H9v-2h2v2zm3.3-5.2s-.5.6-.7.9c-.3.4-.4.8-.4 1.3h-2c0-1.1.4-2.1 1.1-2.8l1.2-1.3c.4-.4.6-.9.6-1.4 0-1.1-.9-2-2-2s-2 .9-2 2H7c0-2.8 2.2-5 5-5s5 2.2 5 5c0 1-.4 2-1.7 3.3z" fill="#241C15" />
        </svg>
      );
    default:
      return <span className="text-xl font-bold">{name[0]}</span>;
  }
}

export default function Integrations() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  const categories = ["All", "CRM", "Email", "Slack", "Automations", "E-commerce"];

  const integrations = [
    { name: "HubSpot", category: "CRM", description: "Sync contacts and conversations directly to HubSpot.", icon: "H" },
    { name: "Salesforce", category: "CRM", description: "Manage leads and opportunities in the world's #1 CRM.", icon: "S" },
    { name: "Slack", category: "Slack", description: "Get instant notifications for every new lead.", icon: "S" },
    { name: "Zapier", category: "Automations", description: "Connect with 5,000+ apps using Zapier workflows.", icon: "Z" },
    { name: "Resend", category: "Email", description: "Automated event-triggered transactional emails.", icon: "R" },
    { name: "Intercom", category: "Slack", description: "Seamlessly handoff chats to human agents.", icon: "I" },
    { name: "Shopify", category: "E-commerce", description: "Answer product questions and track orders directly.", icon: "S" },
    { name: "Zendesk", category: "CRM", description: "Convert chats into support tickets automatically.", icon: "Z" },
    { name: "Make.com", category: "Automations", description: "Advanced automation workflows for your AI bot.", icon: "M" },
    { name: "Mailchimp", category: "Email", description: "Add new leads to your marketing campaigns.", icon: "M" },
  ];

  const filtered = integrations.filter(int => {
    const matchesSearch = int.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = activeCategory === "All" || int.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="bg-white min-h-screen relative overflow-x-hidden">
      {/* Inject custom micro-animations for the layout */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes orbit-float-1 {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-12px) scale(1.02); }
        }
        @keyframes orbit-float-2 {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(14px) scale(0.98); }
        }
        @keyframes orbit-float-3 {
          0%, 100% { transform: translateX(0px) translateY(0px); }
          50% { transform: translateX(-8px) translateY(-8px); }
        }
        @keyframes orbit-float-4 {
          0%, 100% { transform: translateX(0px) translateY(0px); }
          50% { transform: translateX(8px) translateY(8px); }
        }
        @keyframes pulse-ring {
          0% { transform: scale(0.95); opacity: 0.15; }
          50% { transform: scale(1.15); opacity: 0.35; }
          100% { transform: scale(0.95); opacity: 0.15; }
        }
        .animate-float-1 { animation: orbit-float-1 7s ease-in-out infinite; }
        .animate-float-2 { animation: orbit-float-2 8s ease-in-out infinite; }
        .animate-float-3 { animation: orbit-float-3 9s ease-in-out infinite; }
        .animate-float-4 { animation: orbit-float-4 10s ease-in-out infinite; }
        .animate-ring-pulse { animation: pulse-ring 4s ease-in-out infinite; }
      `}} />

      {/* Hero Section */}
      <div className="pt-36 pb-16 px-6 max-w-7xl mx-auto text-center">
        {/* Badge */}
        <div id="integrations-ecosystem-badge" className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#155DEE]/10 text-[#155DEE] text-xs font-black uppercase tracking-widest mb-6">
          <Layers className="w-3.5 h-3.5 text-[#155DEE]" />
          INTEGRATION ECOSYSTEM
        </div>

        {/* Heading */}
        <h1 id="integrations-hero-title" className="text-4xl md:text-6xl font-black text-[#101828] mb-6 tracking-tight max-w-4xl mx-auto leading-tight md:leading-[1.15]">
          Connect <span className="text-[#155DEE] drop-shadow-[0_0_20px_rgba(21,93,238,0.3)] select-all">workflows</span> with Direct <span className="text-[#155DEE] drop-shadow-[0_0_20px_rgba(21,93,238,0.3)] select-all">integrations</span> with favourite tools.
        </h1>

        {/* Subtitle */}
        <p id="integrations-hero-description" className="text-lg md:text-xl text-brand-gray max-w-3xl mx-auto mb-8 font-medium leading-relaxed">
          Let SiteGist answer support questions over your customers' communication channels of choice.
        </p>

        {/* Glowing Info Dotted Elements */}
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 mb-10 text-sm font-semibold max-w-4xl mx-auto text-[#667085]">
          <span className="cursor-pointer border-b border-dotted border-gray-400 hover:border-[#155DEE] hover:text-[#155DEE] transition-all duration-300 hover:drop-shadow-[0_0_8px_rgba(21,93,238,0.55)]">
            Personalized onboarding help
          </span>
          <span className="text-gray-300 pointer-events-none hidden sm:inline">•</span>
          <span className="cursor-pointer border-b border-dotted border-gray-400 hover:border-[#155DEE] hover:text-[#155DEE] transition-all duration-300 hover:drop-shadow-[0_0_8px_rgba(21,93,238,0.55)]">
            Friendly pricing as you scale
          </span>
          <span className="text-gray-300 pointer-events-none hidden sm:inline">•</span>
          <span className="cursor-pointer border-b border-dotted border-gray-400 hover:border-[#155DEE] hover:text-[#155DEE] transition-all duration-300 hover:drop-shadow-[0_0_8px_rgba(21,93,238,0.55)]">
            95+ languages supported.
          </span>
          <span className="text-gray-300 pointer-events-none hidden md:inline">•</span>
          <span className="cursor-pointer border-b border-dotted border-gray-400 hover:border-[#155DEE] hover:text-[#155DEE] transition-all duration-300 hover:drop-shadow-[0_0_8px_rgba(21,93,238,0.55)]">
            7-day free trial.
          </span>
          <span className="text-gray-300 pointer-events-none hidden sm:inline">•</span>
          <span className="cursor-pointer border-b border-dotted border-gray-400 hover:border-[#155DEE] hover:text-[#155DEE] transition-all duration-300 hover:drop-shadow-[0_0_8px_rgba(21,93,238,0.55)]">
            Cancel anytime.
          </span>
        </div>

        {/* CTA Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20">
          <CTAButton to="/signup" variant="primary" className="px-8 py-3.5 text-sm font-extrabold shadow-lg shadow-[#155DEE]/15 hover:scale-[1.02] transform transition-all">
            Start a free trial
          </CTAButton>
          <CTAButton to="/contact-us" variant="secondary" className="px-8 py-3.5 text-sm font-extrabold border-2 hover:scale-[1.02] transform transition-all">
            Book a demo
          </CTAButton>
        </div>
      </div>

      {/* Orbit Graphic Component Container */}
      <div className="relative w-full max-w-5xl h-[480px] md:h-[620px] mx-auto flex items-center justify-center px-4 mb-32 z-10">
        {/* Soft radial grid lines mimicking orbit paths */}
        <div className="absolute w-[160px] h-[160px] border border-dashed border-[#155DEE]/15 rounded-full pointer-events-none" />
        <div className="absolute w-[340px] h-[340px] border border-dashed border-[#155DEE]/15 rounded-full pointer-events-none" />
        <div className="absolute w-[530px] h-[530px] border border-dashed border-[#155DEE]/12 rounded-full pointer-events-none" />
        <div className="absolute w-[720px] h-[720px] border border-dashed border-[#155DEE]/8 rounded-full pointer-events-none h-hidden sm:block" />

        {/* Ambient background blur gradient in center */}
        <div className="absolute w-[260px] h-[260px] bg-[#155DEE]/5 blur-[75px] rounded-full pointer-events-none" />

        {/* Center SiteGist Hub representation */}
        <div className="relative z-10 w-28 h-28 md:w-36 md:h-36 bg-white rounded-full p-2.5 border-2 border-[#155DEE] shadow-[0_0_60px_rgba(21,93,238,0.25)] flex items-center justify-center transition-transform hover:scale-105 duration-300">
          <div className="w-full h-full bg-[#155DEE]/5 rounded-full flex items-center justify-center relative">
            <div className="absolute inset-0 bg-[#155DEE]/10 rounded-full animate-ring-pulse pointer-events-none" />
            {/* Built-in Robot shape matching our SiteGist branding perfectly */}
            <svg width="56" height="56" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-[55%] h-[55%] select-none">
              <circle cx="36" cy="12" r="4" fill="#155DEE"/>
              <rect x="34.5" y="16" width="3" height="8" rx="1.5" fill="#155DEE"/>
              <rect x="8" y="24" width="56" height="40" rx="14" fill="url(#orbitCentralAvatarGrad)"/>
              <rect x="14" y="30" width="44" height="28" rx="8" fill="#101828"/>
              <path d="M22 41 C22 39 28 39 28 41" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
              <path d="M44 41 C44 39 50 39 50 41" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
              <path d="M27 49 C27 52 45 52 45 49" stroke="#155DEE" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
              <rect x="4" y="38" width="4" height="12" rx="2" fill="#155DEE"/>
              <rect x="64" y="38" width="4" height="12" rx="2" fill="#155DEE"/>
              <defs>
                <linearGradient id="orbitCentralAvatarGrad" x1="0" y1="24" x2="72" y2="64" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#155DEE"/>
                  <stop offset="1" stopColor="#7C6EF0"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>

        {/* Floating integrations orbiting dynamically */}
        
        {/* SLACK (Top Right Orbit) */}
        <div className="absolute top-[12%] right-[18%] md:right-[22%] z-20 animate-float-1 group">
          <div className="relative w-14 h-14 md:w-16 md:h-16 bg-[#121013] rounded-full p-3.5 shadow-lg border border-[#2b2a2d] flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-[0_0_25px_rgba(224,30,90,0.4)] cursor-pointer">
            <svg viewBox="0 0 24 24" className="w-full h-full fill-white" xmlns="http://www.w3.org/2000/svg">
              <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523 2.528 2.528 0 0 1-2.522-2.523 2.528 2.528 0 0 1 2.522-2.52h2.52v2.52zm1.261 0a2.528 2.528 0 0 1 2.52-2.52h5.043a2.528 2.528 0 0 1 2.522 2.52v5.04a2.528 2.528 0 0 1-2.522 2.52H8.823a2.528 2.528 0 0 1-2.52-2.52v-5.04zM8.823 5.043a2.528 2.528 0 0 1-2.52-2.52A2.528 2.528 0 0 1 8.823 0a2.528 2.528 0 0 1 2.52 2.522v2.521h-2.52zm0 1.261a2.528 2.528 0 0 1 2.52 2.52v5.043a2.528 2.528 0 0 1-2.52 2.522H3.78a2.528 2.528 0 0 1-2.52-2.522V8.824a2.528 2.528 0 0 1 2.52-2.52h5.043zm10.135 3.761a2.528 2.528 0 0 1 2.522-2.52 2.528 2.528 0 0 1 2.52 2.52 2.528 2.528 0 0 1-2.52 2.522h-2.522v-2.522zm-1.262 0a2.528 2.528 0 0 1-2.52 2.52h-5.043a2.528 2.528 0 0 1-2.521-2.52V3.783a2.528 2.528 0 0 1 2.521-2.52h5.043a2.528 2.528 0 0 1 2.52 2.52v5.043zm-3.76 10.135a2.528 2.528 0 0 1 2.52 2.52 2.528 2.528 0 0 1-2.52 2.522 2.528 2.528 0 0 1-2.522-2.522v-2.52h2.522zm0-1.262a2.528 2.528 0 0 1-2.522-2.52v-5.042a2.528 2.528 0 0 1 2.522-2.521h5.04a2.528 2.528 0 0 1 2.523 2.521v5.042a2.528 2.528 0 0 1-2.523 2.52h-5.04z"/>
            </svg>
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-[#101828] text-white text-[10px] font-black px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">Slack</div>
          </div>
        </div>

        {/* INTERCOM (Mid Left Orbit) */}
        <div className="absolute top-[38%] left-[10%] md:left-[16%] z-20 animate-float-3 group">
          <div className="relative w-15 h-15 md:w-18 md:h-18 bg-gradient-to-tr from-[#1F8EFA] to-[#004AD6] rounded-full p-4 shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-[0_0_25px_rgba(31,142,250,0.5)] cursor-pointer">
            <svg viewBox="0 0 24 24" className="w-full h-full fill-white" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm1 14.5c0 .28-.22.5-.5.5h-1c-.28 0-.5-.22-.5-.5v-1c0-.28.22-.5.5-.5h1c.28 0 .5.22.5.5v1zm2.32-5.46c-.34.58-.93.99-1.32 1.39-.33.34-.5.64-.5 1.07 0 .28-.22.5-.5.5h-1c-.28 0-.5-.22-.5-.5 0-.97.43-1.63.97-2.18.36-.36.79-.69 1.03-1.09.28-.48.14-1.22-.44-1.42-.51-.18-1.07.13-1.26.63-.1.26-.36.43-.64.43h-1.02c-.44 0-.75-.41-.61-.83.47-1.47 1.95-2.48 3.59-2.28 1.69.21 3 1.63 3.09 3.32.04.79-.2 1.58-.65 2.18z"/>
            </svg>
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-[#101828] text-white text-[10px] font-black px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">Intercom</div>
          </div>
        </div>

        {/* WHATSAPP (Top Left Inner Orbit) */}
        <div className="absolute top-[22%] left-[24%] md:left-[28%] z-20 animate-float-2 group">
          <div className="relative w-12 h-12 md:w-14 md:h-14 bg-white rounded-full p-2.5 shadow-md border border-[#25D366]/20 flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-[0_0_20px_rgba(37,211,102,0.4)] cursor-pointer">
            <svg viewBox="0 0 24 24" className="w-full h-full fill-[#25D366]" xmlns="http://www.w3.org/2000/svg">
              <path d="M12.003 2C6.479 2 2 6.478 2 12.002c0 1.765.459 3.49 1.332 5.011l-1.311 4.792 4.908-1.287A9.94 9.94 0 0012.003 22c5.526 0 10.005-4.479 10.005-10s-4.479-10-10.005-10zm0 18c-1.597 0-3.155-.425-4.525-1.233l-.326-.192-2.99 1.053 1.071-2.956-.213-.339A7.95 7.95 0 014.004 12c0-4.411 3.589-8 8-8s8 3.589 8 8-3.589 8-8 8z M15.545 13.916c-.237-.118-1.398-.69-1.614-.768-.216-.079-.372-.118-.529.118-.157.236-.61.767-.746.925-.137.157-.274.177-.511.059a6.417 6.417 0 01-1.895-1.171 7.076 7.076 0 01-1.314-1.636c-.137-.236-.015-.363.103-.481.107-.107.237-.275.355-.413.118-.137.157-.236.236-.393.078-.157.039-.295-.02-.413-.058-.118-.529-1.278-.725-1.75-.19-.459-.384-.397-.529-.404-.136-.007-.294-.008-.451-.008-.157 0-.412.059-.628.295-.216.236-.824.806-.824 1.964s.844 2.279.962 2.437c.118.157 1.66 2.535 4.022 3.553.562.242 1.001.387 1.344.496.565.179 1.079.154 1.486.094.453-.067 1.398-.57 1.594-1.122.196-.551.196-1.023.137-1.122-.058-.099-.215-.158-.452-.276z"/>
            </svg>
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-[#101828] text-white text-[10px] font-black px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">WhatsApp</div>
          </div>
        </div>

        {/* MESSENGER (Mid Right Orbit) */}
        <div className="absolute top-[36%] right-[8%] md:right-[14%] z-20 animate-float-4 group">
          <div className="relative w-13 h-13 md:w-15 md:h-15 bg-white rounded-full p-0.5 shadow-md border border-pink-100 flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-[0_0_20px_rgba(255,0,128,0.3)] cursor-pointer">
            <div className="w-full h-full rounded-full bg-gradient-to-tr from-[#0695FF] via-[#A200FF] to-[#FF0779] p-3 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-full h-full fill-white" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C6.36 2 2 6.13 2 11.7c0 2.9 1.15 5.51 3.03 7.42v3.7c0 .48.51.79.93.55l4.12-2.37c.61.16 1.25.26 1.92.26 5.64 0 10-4.13 10-9.7C22 6.13 17.64 2 12 2zm1.25 12.87l-2.43-2.61-4.75 2.61 5.22-5.56 2.44 2.61 4.73-2.61-5.21 5.56z"/>
              </svg>
            </div>
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-[#101828] text-white text-[10px] font-black px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">Messenger</div>
          </div>
        </div>

        {/* ZAPIER (Top Left Outer Orbit) */}
        <div className="absolute top-[8%] left-[16%] md:left-[20%] z-20 animate-float-3 group">
          <div className="relative w-13 h-13 md:w-15 md:h-15 bg-white rounded-full p-3.5 shadow-lg border border-[#FF4F00]/10 flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-[0_0_20px_rgba(255,79,0,0.35)] cursor-pointer">
            <svg viewBox="0 0 24 24" className="w-full h-full fill-[#FF4F00]" xmlns="http://www.w3.org/2000/svg">
              <path d="M18.8 8.4h-5.2l3.4-6.2c.2-.4.1-.9-.3-1.1-.4-.2-.9-.1-1.1.3l-5 9.1c-.2.4-.1.9.3 1.1h5.2l-3.4 6.2c-.2.4-.1.9.3 1.1.2.1.3.1.5.1.3 0 .6-.2.7-.4l5-9.1c.2-.4.1-.9-.4-1.1zm-8.2 12.8c-2.3 0-4.2-1.9-4.2-4.2 0-1 .4-2 1-2.7L8.6 13c-1.3.7-2.2 2-2.2 3.6 0 2.2 1.8 4 4 4s4-1.8 4-4c0-.9-.3-1.8-.8-2.5l-1.3 1.1c.4.4.6.9.6 1.4 0 1.2-1 2.2-2.1 2.2z"/>
            </svg>
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-[#101828] text-white text-[10px] font-black px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">Zapier</div>
          </div>
        </div>

        {/* HUBSPOT (Bottom Right Orbit) */}
        <div className="absolute bottom-[14%] right-[16%] md:right-[22%] z-20 animate-float-2 group">
          <div className="relative w-13 h-13 md:w-15 md:h-15 bg-white rounded-full p-3 shadow-md border border-[#FF7A59]/20 flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-[0_0_20px_rgba(255,122,89,0.4)] cursor-pointer">
            <svg viewBox="0 0 24 24" className="w-full h-full fill-[#FF7A59]" xmlns="http://www.w3.org/2000/svg">
              <path d="M21.4 11.6c-.2 0-.4-.1-.5-.2l-2.6-2.6c-.3-.3-.3-.8 0-1.1l.8-.8c-.7-.9-1.8-1.5-3-1.7V6c0-.4-.3-.7-.7-.7h-.8c-.4 0-.7.3-.7.7V5.2c-1.2.2-2.3.8-3 1.7L11.7 6c.3-.3.3-.8 0-1.1l-.8-.8c-.3-.3-.8-.3-1.1 0l-2 2c-.3.3-.3.8 0 1.1l.6.6c-1.1 1.2-1.7 2.8-1.7 4.5 0 2 1 3.8 2.5 5l-.3.3c-.3.3-.3.8 0 1.1l1.1 1.1c.3.3.8.3 1.1 0l.3-.3c1 .5 2.1.8 3.3.8.6 0 1.2-.1 1.8-.2V21c0 .4.3.7.7.7h.8c.4 0 .7-.3.7-.7V21c2.1-.5 3.9-1.9 4.8-4l.8.8c.3.3.8.3 1.1 0l1.1-1.1c.3-.3.3-.8 0-1.1l-.8-.8c.7-.9 1.2-2 1.4-3.2h.7c.4 0 .7-.3.7-.7v-.8c-.1-.3-.4-.5-.7-.5zM12 15c-1.7 0-3-1.3-3-3s1.3-3 3-3 3 1.3 3 3-1.3 3-3 3z"/>
            </svg>
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-[#101828] text-white text-[10px] font-black px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">HubSpot</div>
          </div>
        </div>

        {/* ZENDESK (Bottom Left Orbit) */}
        <div className="absolute bottom-[24%] left-[12%] md:left-[18%] z-20 animate-float-1 group">
          <div className="relative w-12 h-12 md:w-14 md:h-14 bg-[#03363D] rounded-full p-3.5 shadow-md flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-[0_0_20px_rgba(3,54,61,0.45)] cursor-pointer">
            <svg viewBox="0 0 24 24" className="w-full h-full fill-[#FFF]" xmlns="http://www.w3.org/2000/svg">
              <path d="M19.7 18.2l-6-10.3c-.6-1-1.8-1-2.4 0L5.3 18.2c-.6 1 .1 2.3 1.2 2.3h12c1.1 0 1.8-1.3 1.2-2.3z M6.6 3.5C5.5 3.5 4.8 4.8 5.4 5.8l6 10.3c.6 1 1.8 1 2.4 0l6-10.3c.6-1-.1-2.3-1.2-2.3H6.6z"/>
            </svg>
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-[#101828] text-white text-[10px] font-black px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">Zendesk</div>
          </div>
        </div>

        {/* ACTIVECAMPAIGN (Bottom Middle-Right Orbit) */}
        <div className="absolute bottom-[10%] right-[32%] md:right-[38%] z-20 animate-float-3 group">
          <div className="relative w-11 h-11 md:w-13 md:h-13 bg-[#356AE6] rounded-full p-2.5 shadow-md flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-[0_0_20px_rgba(53,106,230,0.5)] cursor-pointer">
            <svg viewBox="0 0 24 24" className="w-full h-full fill-white" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H7c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.04-.42 1.99-1.07 2.75z"/>
            </svg>
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-[#101828] text-white text-[10px] font-black px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">ActiveCampaign</div>
          </div>
        </div>
      </div>

      {/* Data Source Integrations Full Section */}
      <div id="data-source-integrations-section" className="bg-[#FAF9F6] border-y border-brand-border py-28 px-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-16 max-w-3xl mx-auto">
            <div id="data-sources-badge" className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#155DEE]/10 text-[#155DEE] text-xs font-black uppercase tracking-wider mb-5">
              DATA SOURCE INTEGRATIONS
            </div>
            <h2 id="data-sources-title" className="text-3xl md:text-5xl font-black text-[#101828] tracking-tight mb-6 leading-tight">
              Enhance Your Chatbot with Diverse Data Sources
            </h2>
            <p id="data-sources-description" className="text-brand-gray font-medium text-base md:text-lg leading-relaxed">
              Integrate a wide range of data sources to empower SiteGist with rich, varied, and up-to-date training material, ensuring a well-informed and effective chatbot experience.
            </p>
          </div>

          {/* Cards Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            
            {/* GOOGLE DRIVE */}
            <div className="bg-white rounded-[32px] border border-brand-border p-6 shadow-sm hover:shadow-xl hover:border-[#155DEE]/20 transition-all duration-300 group flex flex-col">
              <div className="w-full h-44 rounded-[24px] bg-[#FFFBEB] flex items-center justify-center mb-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/5 to-transparent pointer-events-none" />
                <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-amber-200/50 group-hover:scale-105 transform transition-transform duration-300">
                  {/* Google Drive Logo */}
                  <svg viewBox="0 0 24 24" className="w-10 h-10" xmlns="http://www.w3.org/2000/svg">
                    <path d="M15.43 14.92L18.86 9h-6.86l-3.43 5.92M8.57 15l3.43-5.92L5.14 9l-3.43 5.92M12 15.92h6.86L15.43 21H8.57" fill="#155DEE"/>
                    <path d="M15.43 14.92h-6.86L5.14 9h6.86" fill="#00C9A7" />
                    <path d="M12 15.92L15.43 21h6.86L18.86 9" fill="#FFB800" />
                  </svg>
                </div>
              </div>
              <h3 className="text-2xl font-bold text-[#101828] mb-3 tracking-tight">Google Drive</h3>
              <p className="text-brand-gray text-sm leading-relaxed font-medium">
                Seamlessly access and sync chatbot training data stored in Google Drive, enabling easy management and updating of resources.
              </p>
            </div>

            {/* DROPBOX */}
            <div className="bg-white rounded-[32px] border border-brand-border p-6 shadow-sm hover:shadow-xl hover:border-[#155DEE]/20 transition-all duration-300 group flex flex-col">
              <div className="w-full h-44 rounded-[24px] bg-[#EFF6FF] flex items-center justify-center mb-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/5 to-transparent pointer-events-none" />
                <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-blue-200/50 group-hover:scale-105 transform transition-transform duration-300">
                  {/* Dropbox icon */}
                  <svg viewBox="0 0 24 24" className="w-10 h-10 fill-[#0061FE]" xmlns="http://www.w3.org/2000/svg">
                    <path d="M6 2l6 4-6 4-6-4 6-4zm12 4l6-4-6-4-6 4 6 4zm-12 8l6-4-6-4-6 4 6 4zm12 0l6-4-6-4-6 4 6 4zM6 15.5l6 4 6-4-6-2.5-6 2.5z"/>
                  </svg>
                </div>
              </div>
              <h3 className="text-2xl font-bold text-[#101828] mb-3 tracking-tight">Dropbox</h3>
              <p className="text-brand-gray text-sm leading-relaxed font-medium">
                Integrate with Dropbox to utilize stored documents and files for chatbot training, ensuring data is readily available and up-to-date.
              </p>
            </div>

            {/* ONEDRIVE */}
            <div className="bg-white rounded-[32px] border border-brand-border p-6 shadow-sm hover:shadow-xl hover:border-[#155DEE]/20 transition-all duration-300 group flex flex-col">
              <div className="w-full h-44 rounded-[24px] bg-[#F0F9FF] flex items-center justify-center mb-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-tr from-sky-500/5 to-transparent pointer-events-none" />
                <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-sky-200/50 group-hover:scale-105 transform transition-transform duration-300">
                  {/* OneDrive Cloud icon */}
                  <svg viewBox="0 0 24 24" className="w-10 h-10 fill-[#0078D4]" xmlns="http://www.w3.org/2000/svg">
                    <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/>
                  </svg>
                </div>
              </div>
              <h3 className="text-2xl font-bold text-[#101828] mb-3 tracking-tight">OneDrive</h3>
              <p className="text-brand-gray text-sm leading-relaxed font-medium">
                Leverage OneDrive for cloud-based storage of chatbot training materials, offering easy access and collaboration features.
              </p>
            </div>

            {/* SHAREPOINT */}
            <div className="bg-white rounded-[32px] border border-brand-border p-6 shadow-sm hover:shadow-xl hover:border-[#155DEE]/20 transition-all duration-300 group flex flex-col">
              <div className="w-full h-44 rounded-[24px] bg-[#F0FDF4] flex items-center justify-center mb-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-tr from-teal-500/5 to-transparent pointer-events-none" />
                <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-teal-200/50 group-hover:scale-105 transform transition-transform duration-300">
                  {/* SharePoint logo shape */}
                  <div className="flex gap-1 items-center justify-center">
                    <span className="w-5 h-5 rounded-full bg-[#0078D4] opacity-80"></span>
                    <span className="w-4 h-4 rounded-full bg-[#008272] -ml-2"></span>
                    <span className="w-3 h-3 rounded-full bg-[#D83B01] -ml-1"></span>
                  </div>
                </div>
              </div>
              <h3 className="text-2xl font-bold text-[#101828] mb-3 tracking-tight">SharePoint</h3>
              <p className="text-brand-gray text-sm leading-relaxed font-medium">
                Utilize SharePoint to organize and share chatbot training documents within a team, supporting efficient content management.
              </p>
            </div>

            {/* ZENDESK */}
            <div className="bg-white rounded-[32px] border border-brand-border p-6 shadow-sm hover:shadow-xl hover:border-[#155DEE]/20 transition-all duration-300 group flex flex-col">
              <div className="w-full h-44 rounded-[24px] bg-[#03363D]/10 flex items-center justify-center mb-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-tr from-emerald-900/5 to-transparent pointer-events-none" />
                <div className="w-20 h-20 bg-[#03363D] rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-105 transform transition-transform duration-300">
                  {/* Zendesk Z logo */}
                  <svg viewBox="0 0 24 24" className="w-10 h-10 fill-white" xmlns="http://www.w3.org/2000/svg">
                    <path d="M19.7 18.2l-6-10.3c-.6-1-1.8-1-2.4 0L5.3 18.2c-.6 1 .1 2.3 1.2 2.3h12c1.1 0 1.8-1.3 1.2-2.3z M6.6 3.5C5.5 3.5 4.8 4.8 5.4 5.8l6 10.3c.6 1 1.8 1 2.4 0l6-10.3c.6-1-.1-2.3-1.2-2.3H6.6z"/>
                  </svg>
                </div>
              </div>
              <h3 className="text-2xl font-bold text-[#101828] mb-3 tracking-tight">Zendesk</h3>
              <p className="text-brand-gray text-sm leading-relaxed font-medium">
                Integrate with Zendesk to access its help center content, providing a rich source of information for training your chatbot, thereby enhancing its knowledge base and response capability.
              </p>
            </div>

            {/* GITBOOK */}
            <div className="bg-white rounded-[32px] border border-brand-border p-6 shadow-sm hover:shadow-xl hover:border-[#155DEE]/20 transition-all duration-300 group flex flex-col">
              <div className="w-full h-44 rounded-[24px] bg-[#F8FAFC] flex items-center justify-center mb-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-tr from-slate-500/5 to-transparent pointer-events-none" />
                <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-slate-200/50 group-hover:scale-105 transform transition-transform duration-300">
                  {/* Gitbook logo shape */}
                  <div className="flex flex-col items-center">
                     <span className="text-[#38BDF8] text-2xl font-black font-mono">GitBook</span>
                  </div>
                </div>
              </div>
              <h3 className="text-2xl font-bold text-[#101828] mb-3 tracking-tight">Gitbook</h3>
              <p className="text-brand-gray text-sm leading-relaxed font-medium">
                Connect with Gitbook to access structured documentation and knowledge bases, enriching the chatbot's learning resources.
              </p>
            </div>

            {/* BOX */}
            <div className="bg-white rounded-[32px] border border-brand-border p-6 shadow-sm hover:shadow-xl hover:border-[#155DEE]/20 transition-all duration-300 group flex flex-col">
              <div className="w-full h-44 rounded-[24px] bg-[#EFF6FF]/70 flex items-center justify-center mb-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/5 to-transparent pointer-events-none" />
                <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-blue-100/50 group-hover:scale-105 transform transition-transform duration-300">
                  <span className="text-2xl font-black tracking-tight text-[#0061FF] font-sans">box</span>
                </div>
              </div>
              <h3 className="text-2xl font-bold text-[#101828] mb-3 tracking-tight">Box</h3>
              <p className="text-brand-gray text-sm leading-relaxed font-medium">
                Incorporate Box for secure cloud storage of training data, ensuring safe and organized access to chatbot resources.
              </p>
            </div>

            {/* NOTION */}
            <div className="bg-white rounded-[32px] border border-brand-border p-6 shadow-sm hover:shadow-xl hover:border-[#155DEE]/20 transition-all duration-300 group flex flex-col">
              <div className="w-full h-44 rounded-[24px] bg-[#F5F5F4] flex items-center justify-center mb-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-tr from-stone-500/5 to-transparent pointer-events-none" />
                <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-stone-200/50 group-hover:scale-105 transform transition-transform duration-300">
                  <span className="text-3xl font-black tracking-tighter text-black font-serif">N</span>
                </div>
              </div>
              <h3 className="text-2xl font-bold text-[#101828] mb-3 tracking-tight">Notion</h3>
              <p className="text-brand-gray text-sm leading-relaxed font-medium">
                Link with Notion to harness extensive notes and organized data for training, enhancing the chatbot's knowledge base.
              </p>
            </div>

            {/* FRESHDESK */}
            <div className="bg-white rounded-[32px] border border-brand-border p-6 shadow-sm hover:shadow-xl hover:border-[#155DEE]/20 transition-all duration-300 group flex flex-col">
              <div className="w-full h-44 rounded-[24px] bg-[#ECFDF5] flex items-center justify-center mb-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/5 to-transparent pointer-events-none" />
                <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-emerald-200/50 group-hover:scale-105 transform transition-transform duration-300">
                  <div className="w-10 h-10 bg-[#10B981] rounded-xl flex items-center justify-center">
                    <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white" xmlns="http://www.w3.org/2000/svg">
                      <rect x="3" y="10" width="18" height="11" rx="4" />
                      <circle cx="8" cy="6" r="3" />
                      <circle cx="16" cy="6" r="3" />
                    </svg>
                  </div>
                </div>
              </div>
              <h3 className="text-2xl font-bold text-[#101828] mb-3 tracking-tight">Freshdesk</h3>
              <p className="text-brand-gray text-sm leading-relaxed font-medium">
                Integrate with Freshdesk to access and utilize help center articles, providing a rich source of information for training your chatbot and enhancing its knowledge base.
              </p>
            </div>

            {/* CONFLUENCE */}
            <div className="bg-white rounded-[32px] border border-brand-border p-6 shadow-sm hover:shadow-xl hover:border-[#155DEE]/20 transition-all duration-300 group flex flex-col">
              <div className="w-full h-44 rounded-[24px] bg-[#EEF2FF] flex items-center justify-center mb-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/5 to-transparent pointer-events-none" />
                <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-indigo-200/50 group-hover:scale-105 transform transition-transform duration-300">
                  {/* Confluence custom element pattern */}
                  <div className="flex gap-1.5 rotate-45">
                    <div className="w-6 h-6 bg-[#0052CC] rounded-sm"></div>
                    <div className="w-6 h-6 bg-[#2684FF] rounded-sm"></div>
                  </div>
                </div>
              </div>
              <h3 className="text-2xl font-bold text-[#101828] mb-3 tracking-tight">Confluence</h3>
              <p className="text-brand-gray text-sm leading-relaxed font-medium">
                Use Confluence as a source of comprehensive documentation and collaborative content, providing rich training material for the chatbot.
              </p>
            </div>

            {/* INTERCOM */}
            <div className="bg-white rounded-[32px] border border-brand-border p-6 shadow-sm hover:shadow-xl hover:border-[#155DEE]/20 transition-all duration-300 group flex flex-col">
              <div className="w-full h-44 rounded-[24px] bg-[#EFF6FF] flex items-center justify-center mb-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-tr from-[#1F8EFA]/10 to-transparent pointer-events-none" />
                <div className="w-20 h-20 bg-[#1F8EFA] rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-105 transform transition-transform duration-300">
                  <svg viewBox="0 0 24 24" className="w-10 h-10 fill-white" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm1 14.5c0 .28-.22.5-.5.5h-1c-.28 0-.5-.22-.5-.5v-1c0-.28.22-.5.5-.5h1c.28 0 .5.22.5.5v1zm2.32-5.46c-.34.58-.93.99-1.32 1.39-.33.34-.5.64-.5 1.07 0 .28-.22.5-.5.5h-1c-.28 0-.5-.22-.5-.5 0-.97.43-1.63.97-2.18.36-.36.79-.69 1.03-1.09.28-.48.14-1.22-.44-1.42-.51-.18-1.07.13-1.26.63-.1.26-.36.43-.64.43h-1.02c-.44 0-.75-.41-.61-.83.47-1.47 1.95-2.48 3.59-2.28 1.69.21 3 1.63 3.09 3.32.04.79-.2 1.58-.65 2.18z"/>
                  </svg>
                </div>
              </div>
              <h3 className="text-2xl font-bold text-[#101828] mb-3 tracking-tight">Intercom</h3>
              <p className="text-brand-gray text-sm leading-relaxed font-medium">
                Integrate with Intercom to access and leverage help center articles, enriching your chatbot's knowledge base and improving its response accuracy.
              </p>
            </div>

            {/* YOUTUBE */}
            <div className="bg-white rounded-[32px] border border-brand-border p-6 shadow-sm hover:shadow-xl hover:border-[#155DEE]/20 transition-all duration-300 group flex flex-col">
              <div className="w-full h-44 rounded-[24px] bg-[#FFF1F2] flex items-center justify-center mb-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-tr from-red-500/5 to-transparent pointer-events-none" />
                <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-red-200/50 group-hover:scale-105 transform transition-transform duration-300">
                  {/* YouTube symbol */}
                  <svg viewBox="0 0 24 24" className="w-12 h-12 fill-[#FF0000]" xmlns="http://www.w3.org/2000/svg">
                    <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.107C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.388.511a3.002 3.002 0 0 0-2.11 2.107C0 8.047 0 12 0 12s0 3.953.502 5.837a3.002 3.002 0 0 0 2.11 2.107c1.883.511 9.388.511 9.388.511s7.505 0 9.388-.511a3.002 3.002 0 0 0 2.11-2.107c.502-1.884.502-5.837.502-5.837s0-3.953-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                  </svg>
                </div>
              </div>
              <h3 className="text-2xl font-bold text-[#101828] mb-3 tracking-tight">YouTube</h3>
              <p className="text-brand-gray text-sm leading-relaxed font-medium">
                Train your chatbot using YouTube videos, playlists, and channels to provide comprehensive knowledge from video content.
              </p>
            </div>

          </div>

          {/* Centered CTA looking for another integration section */}
          <div className="mt-20 pt-16 border-t border-brand-border/60 text-center max-w-2xl mx-auto">
            <h4 className="text-2xl md:text-3xl font-black text-[#101828] mb-4 tracking-tight">
              Looking for another integration?
            </h4>
            <Link 
              to="/contact-us" 
              className="inline-flex items-center gap-2 text-[#155DEE] hover:text-[#155DEE]/80 font-black text-lg transition-all duration-300 group"
            >
              Submit a request
              <ArrowRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Main Filterable Integrations List */}
      <div className="py-24 px-6 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-accent/5 text-brand-accent text-xs font-extrabold uppercase tracking-widest mb-4">
            Filter Ecosystem
          </div>
          <h2 className="text-3xl md:text-4xl font-extrabold text-brand-dark tracking-tight mb-4">
            Search our entire integration suite
          </h2>
          <p className="text-brand-gray font-medium text-sm md:text-base max-w-xl mx-auto">
            Find the direct tool adapters ready to bridge your custom support channels, databases, or workflow pipelines.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-12">
          <div className="flex bg-brand-light p-1 rounded-2xl overflow-x-auto max-w-full">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-5 py-2 rounded-xl text-xs font-extrabold tracking-wider uppercase transition-all whitespace-nowrap ${
                  activeCategory === cat 
                    ? "bg-white text-brand-dark shadow-sm" 
                    : "text-brand-gray hover:text-brand-dark"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-gray" />
            <input 
              type="text" 
              placeholder="Search integrations..."
              className="w-full pl-12 pr-6 py-3.5 bg-brand-light rounded-2xl border border-transparent focus:border-brand-accent/30 focus:ring-4 focus:ring-brand-accent/5 outline-none font-semibold text-xs uppercase tracking-wider transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Catalog List */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-24">
          {filtered.map((item) => (
            <div key={item.name} className="p-8 rounded-3xl border border-brand-border hover:border-brand-accent/30 bg-white transition-all duration-300 group flex flex-col">
              <div className="flex items-center justify-between mb-8">
                 <div className="w-14 h-14 bg-brand-light rounded-2xl flex items-center justify-center text-xl font-black text-brand-dark border border-brand-border group-hover:border-brand-accent/20 group-hover:scale-105 transition-all">
                    {renderEcosystemIcon(item.name)}
                 </div>
                 <div className="px-3 py-1 rounded-full bg-brand-light text-[10px] font-bold text-brand-gray uppercase tracking-widest border border-brand-border">
                    {item.category}
                 </div>
              </div>
              <h3 className="text-xl font-extrabold text-brand-dark mb-3 tracking-tight">{item.name}</h3>
              <p className="text-sm font-medium text-brand-gray leading-relaxed mb-8 flex-grow">
                {item.description}
              </p>
              <button className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-brand-light text-brand-dark text-xs font-bold uppercase tracking-widest hover:bg-brand-dark hover:text-white transition-all border border-brand-dark/5">
                 Configure
                 <Plus className="w-4 h-4" />
              </button>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full py-20 text-center">
              <p className="text-brand-gray font-bold">No integrations found matching your search.</p>
            </div>
          )}
        </div>

        {/* Suggestion box */}
        <div className="bg-[#155DEE] text-white rounded-[40px] p-12 text-center relative overflow-hidden shadow-xl shadow-blue-500/10">
          <div className="relative z-10">
            <h2 className="text-3xl font-extrabold mb-6">Need a custom integration?</h2>
            <p className="mb-8 font-medium text-white/80 max-w-xl mx-auto">
              Our developer API is ready for you. Or just reach out and we'll see if we can build it for you.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
               <CTAButton to="/docs" variant="secondary" className="bg-white text-brand-accent border-white hover:bg-brand-light px-10 border-none">Check API Docs</CTAButton>
               <CTAButton to="/contact-us" variant="text" className="text-white hover:text-white/80">Submit Integration Request</CTAButton>
            </div>
          </div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 blur-3xl rounded-full translate-x-20 -translate-y-20"></div>
        </div>
      </div>

      <Footer />
      <ChatWidget />
    </div>
  );
}
