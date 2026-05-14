import { Outlet, Link, useLocation } from "@remix-run/react";
import { 
  Book, 
  Settings, 
  MessageSquare, 
  Database, 
  Code, 
  Zap, 
  Layout, 
  Users, 
  Shield, 
  Clock,
  ChevronRight,
  ChevronDown,
  Search,
  ExternalLink,
  Bot,
  Menu,
  X,
  Command
} from "lucide-react";
import React, { useState, useEffect } from 'react';
import { Logo } from "~/frontend/components/Logo";

const navLinks: { label: string; to: string }[] = [];

export default function DocsLayout() {
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const sections = [
    {
      title: "Getting started",
      items: [
        { label: "What is SiteGist", to: "/docs" },
        { label: "Live demo", to: "/#live-demo" },
        { label: "Use cases", to: "/features" },
      ]
    },
    {
      title: "Setup & configuration",
      items: [
        { label: "Create new chatbot", to: "/docs/setup" },
        { label: "Training your chatbot", to: "/docs/training" },
        { label: "Integrating with your Website", to: "/docs/integration" },
        { label: "Retraining your AI chatbot", to: "/docs/retraining" },
      ]
    },
    {
      title: "Managing your chatbot",
      items: [
        { label: "Dashboard", to: "/dashboard" },
        { label: "Add content", to: "/docs/content" },
        { label: "Chat history", to: "/docs/history" },
        { label: "Leads", to: "/docs/leads" },
        { label: "Customize chatbot", to: "/docs/customize" },
        { label: "Settings", to: "/docs/settings" },
        { label: "Advanced", to: "/docs/advanced" },
      ]
    },
    {
      title: "Updates",
      items: [
        { label: "Changelog", to: "/docs/changelog" },
      ]
    },
    {
      title: "API Documentation",
      items: [
        { label: "Getting started", to: "/docs/api-reference" },
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Docs Header */}
      <header className="sticky top-0 z-50 w-full border-b border-brand-border bg-white/80 backdrop-blur-md">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6 lg:gap-10 shrink-0">
            <Link to="/" className="flex items-center gap-2">
              <Logo size="sm" />
            </Link>
            <nav className="hidden lg:flex items-center gap-5">
              {navLinks.map(link => (
                <Link key={link.to} to={link.to} className="text-[13px] font-bold text-brand-gray hover:text-brand-dark transition-colors whitespace-nowrap">
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex-1 max-w-md hidden md:block">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-gray/40 group-focus-within:text-primary transition-colors" />
              <input 
                ref={searchInputRef}
                type="text" 
                placeholder="Search documentation..." 
                className="w-full pl-10 pr-20 py-2 bg-brand-light/50 border border-brand-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none">
                <span className="px-1.5 py-0.5 bg-white border border-brand-border rounded text-[9px] font-black text-brand-gray/60 uppercase">Ctrl</span>
                <span className="px-1.5 py-0.5 bg-white border border-brand-border rounded text-[9px] font-black text-brand-gray/60 uppercase">K</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 lg:gap-5 shrink-0">
            <Link to="mailto:support@sitegist.co" className="hidden xl:block text-[13px] font-bold text-brand-gray hover:text-brand-dark transition-colors">
              Support
            </Link>
            <Link 
              to="/signup" 
              className="hidden sm:block px-5 py-2.5 bg-brand-dark text-white rounded-xl text-[13px] font-black hover:scale-105 active:scale-95 transition-all shadow-lg shadow-brand-dark/10"
            >
              Create Your Chatbot Now
            </Link>
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 hover:bg-brand-light rounded-lg transition-colors"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6 text-brand-dark" /> : <Menu className="w-6 h-6 text-brand-dark" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <div className="lg:hidden absolute top-full left-0 right-0 bg-white border-b border-brand-border p-6 shadow-2xl animate-in slide-in-from-top duration-300">
            <nav className="flex flex-col gap-4">
              {navLinks.map(link => (
                <Link 
                  key={link.to} 
                  to={link.to} 
                  className="text-base font-bold text-brand-dark px-2 py-1"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <hr className="border-brand-border my-2" />
              <Link to="/docs" className="text-base font-bold text-primary px-2" onClick={() => setIsMobileMenuOpen(false)}>Documentation</Link>
              <Link to="/signup" className="mt-2 w-full py-4 bg-brand-dark text-white rounded-2xl font-black text-center" onClick={() => setIsMobileMenuOpen(false)}>
                Create Your Chatbot Now
              </Link>
            </nav>
          </div>
        )}
      </header>

      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className={`${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 fixed lg:sticky top-16 h-[calc(100vh-64px)] w-72 bg-brand-light/30 border-r border-brand-border overflow-y-auto transition-transform duration-300 z-40 p-6 lg:p-8`}>
          <div className="lg:hidden mb-10">
            <Logo size="md" />
          </div>

          <nav className="space-y-8">
            {sections.map((section) => (
              <div key={section.title}>
                <h4 className="text-[11px] font-black uppercase tracking-widest text-brand-dark/40 mb-4 px-2">
                  {section.title}
                </h4>
                <ul className="space-y-1">
                  {section.items.map((item) => (
                    <li key={item.label}>
                      <Link
                        to={item.to}
                        className={`group flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-bold transition-all ${
                          location.pathname === item.to
                            ? "bg-primary/10 text-primary"
                            : "text-brand-gray hover:text-brand-dark hover:bg-brand-light"
                        }`}
                      >
                        <ChevronRight className={`w-3 h-3 transition-transform ${location.pathname === item.to ? 'rotate-90 text-primary' : 'text-brand-gray/30 group-hover:text-brand-dark'}`} />
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          <div className="mt-12 pt-8 border-t border-brand-border">
            <Link 
              to="/dashboard" 
              className="flex items-center gap-2 text-xs font-black text-brand-dark hover:text-primary transition-colors"
            >
              <Bot className="w-4 h-4" /> Go to Dashboard
            </Link>
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 min-w-0 bg-white">
          <div className="max-w-4xl mx-auto px-6 py-12 lg:px-16 lg:py-16">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
