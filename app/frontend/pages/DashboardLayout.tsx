import { 
  LogOut, 
  Bot, 
  Menu, 
  MessageSquare, 
  Sparkles, 
  User, 
  BookOpen, 
  LifeBuoy, 
  ChevronDown,
  LayoutDashboard,
  FileText,
  Database,
  ShieldCheck
} from "lucide-react";
import { Link, Form, useLocation, Outlet } from "@remix-run/react";
import React, { useState, useRef, useEffect } from 'react';
import { Logo } from "~/frontend/components/Logo";
import { ChatWidget } from "~/frontend/components/ChatWidget";
import { motion, AnimatePresence } from "framer-motion";

interface DashboardLayoutPageProps {
  user: any;
  subscriptionStatus: string | null;
}

export function DashboardLayoutPage({ user, subscriptionStatus }: DashboardLayoutPageProps) {
  const location = useLocation();
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsAccountOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const hasActiveSub = subscriptionStatus === "active";

  const navItems = [
    { label: "Chatbots", icon: LayoutDashboard, href: "/dashboard" },
    hasActiveSub
      ? { label: "Billing", icon: Sparkles, href: "/dashboard/billing" }
      : { label: "Start Trial", icon: Sparkles, href: "/pricing" },
    { label: "Profile", icon: User, href: "/dashboard/settings" },
    { label: "Docs", icon: BookOpen, href: "/docs" },
    { label: "Support", icon: LifeBuoy, href: "mailto:support@sitegist.co", external: true },
    { label: "Feedback", icon: MessageSquare, href: "mailto:support@sitegist.co?subject=SiteGist%20Feedback", external: true },
    { label: "Admin", icon: Database, href: "/dashboard/admin" },
  ];

  return (
    <div className="min-h-screen bg-white font-sans text-brand-dark antialiased overflow-hidden flex flex-col">
      {/* Top Header */}
      <header className="z-30 shrink-0 bg-white py-3 border-b border-brand-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between">
            {/* Logo & Subscription Status Badge */}
            <div className="shrink-0 mr-auto lg:mx-0 flex items-center gap-3">
              <Link to="/" className="flex transition-transform hover:scale-[1.02]">
                <Logo size="sm" variant="light" />
              </Link>
              {hasActiveSub ? (
                <div id="badge-pro-active" className="px-2.5 py-1 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest rounded-full leading-none flex items-center gap-1.5 ring-1 ring-primary/20">
                  <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse"></span>
                  Pro Plan Active
                </div>
              ) : (
                <div id="badge-free-trial" className="px-2.5 py-1 bg-zinc-100 text-zinc-500 text-[10px] font-black uppercase tracking-widest rounded-full leading-none flex items-center gap-1.5 ring-1 ring-zinc-200">
                  <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full"></span>
                  {subscriptionStatus === "trialing" ? "Trial" : "Free Plan"}
                </div>
              )}
            </div>

            {/* Center Navigation */}
            <div className="hidden lg:flex gap-1 items-center justify-center">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  id={`nav-item-${item.label.toLowerCase().replace(" ", "-")}`}
                  to={item.href}
                  target={item.external ? "_blank" : undefined}
                  rel={item.external ? "noopener noreferrer" : undefined}
                  className={`group inline-flex items-center justify-center gap-2 text-sm font-medium transition-all duration-150 rounded-lg px-3 py-2 ${
                    location.pathname === item.href
                      ? "bg-brand-light text-primary"
                      : "text-brand-gray hover:bg-brand-light hover:text-brand-dark"
                  }`}
                >
                  <item.icon className={`h-4.5 w-4.5 transition-all duration-150 ${
                    location.pathname === item.href ? "text-primary" : "text-brand-gray/60 group-hover:text-brand-dark"
                  }`} />
                  {item.label}
                </Link>
              ))}
            </div>

            {/* Right Account Menu */}
            <div className="flex items-center ml-auto lg:ml-0">
              <div className="relative" ref={dropdownRef}>
                <button 
                  onClick={() => setIsAccountOpen(!isAccountOpen)}
                  className="group inline-flex items-center justify-center gap-2 text-sm font-semibold text-brand-gray transition-all duration-150 rounded-lg px-3 py-2 hover:bg-brand-light hover:text-brand-dark"
                >
                  <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center text-primary text-[10px] font-black mr-1 border border-primary/20">
                    {user?.email?.[0].toUpperCase() || "U"}
                  </div>
                  My Account
                  <ChevronDown className={`h-3 w-3 text-brand-gray/40 transition-transform duration-200 ${isAccountOpen ? 'rotate-180' : ''} group-hover:text-brand-dark`} />
                </button>

                <AnimatePresence>
                  {isAccountOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.1, ease: "easeOut" }}
                      className="absolute right-0 top-full mt-2 w-56 whitespace-nowrap bg-white shadow-2xl rounded-2xl border border-brand-border overflow-hidden py-1.5 ring-1 ring-black/5"
                    >
                      <div className="px-4 py-3 border-b border-brand-border mb-1">
                        <p className="text-xs font-bold text-brand-gray uppercase tracking-widest mb-1">Signed in as</p>
                        <p className="text-sm font-bold text-brand-dark truncate">{user?.email}</p>
                      </div>
                      
                      <Link 
                        to="/dashboard/settings" 
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-bold text-brand-gray hover:bg-brand-light hover:text-brand-dark transition-all"
                        onClick={() => setIsAccountOpen(false)}
                      >
                        <User className="w-4 h-4 text-brand-gray/60" /> Profile Settings
                      </Link>

                      <Link
                        to="/dashboard/settings/privacy"
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-bold text-brand-gray hover:bg-brand-light hover:text-brand-dark transition-all"
                        onClick={() => setIsAccountOpen(false)}
                      >
                        <ShieldCheck className="w-4 h-4 text-brand-gray/60" /> Privacy & Data
                      </Link>

                      <div className="h-[1px] bg-brand-border my-1.5" />

                      <Form action="/logout" method="post" className="w-full">
                        <button 
                          type="submit" 
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-bold text-red-500 hover:bg-red-50 transition-all"
                        >
                          <LogOut className="w-4 h-4 shrink-0" /> Logout
                        </button>
                      </Form>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-white pt-6 lg:pt-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <Outlet />
        </div>
      </main>

      {/* Vertical Feedback Button — opens a feedback email (was a dead button). */}
      <a
        href="mailto:support@sitegist.co?subject=SiteGist%20Feedback"
        className="fixed right-0 top-1/2 -translate-y-1/2 translate-x-[calc(50%-12px)] hover:translate-x-0 transition-all duration-300 z-40 bg-brand-dark text-white px-5 py-2.5 rounded-l-2xl font-bold text-xs uppercase tracking-widest flex items-center gap-3 shadow-2xl vertical-rl rotate-180"
        style={{ writingMode: 'vertical-rl' }}
      >
        <MessageSquare className="w-4 h-4 rotate-90" />
        Feedback
      </a>

      {/* Floating support chat widget — the real, functional ChatWidget so it
          actually opens and matches the rest of the site (was a dead decorative
          button with no onClick/panel). */}
      <ChatWidget />
    </div>

  );
}
