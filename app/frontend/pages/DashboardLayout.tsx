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
  FileText
} from "lucide-react";
import { Link, Form, useLocation, Outlet } from "@remix-run/react";
import React, { useState, useRef, useEffect } from 'react';
import { Logo } from "~/frontend/components/Logo";
import { motion, AnimatePresence } from "framer-motion";

interface DashboardLayoutPageProps {
  user: any;
}

export function DashboardLayoutPage({ user }: DashboardLayoutPageProps) {
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

  const navItems = [
    { label: "Chatbots", icon: LayoutDashboard, href: "/dashboard" },
    ...(user?.role === "OWNER" ? [{ label: "Blog", icon: FileText, href: "/dashboard/blog" }] : []),
    { label: "Start Trial", icon: Sparkles, href: "/pricing" },
    { label: "Profile", icon: User, href: "/dashboard/settings" },
    { label: "Docs", icon: BookOpen, href: "/docs" },
    { label: "Support", icon: LifeBuoy, href: "mailto:support@sitegist.co", external: true },
    { label: "Feedback", icon: MessageSquare, href: "/dashboard/feedback" },
  ];

  return (
    <div className="min-h-screen bg-white font-sans text-brand-dark antialiased overflow-hidden flex flex-col">
      {/* Top Header */}
      <header className="z-30 shrink-0 bg-white py-3 border-b border-brand-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="shrink-0 mr-auto lg:mx-0">
              <Link to="/" className="flex transition-transform hover:scale-[1.02]">
                <Logo size="sm" variant="light" />
              </Link>
            </div>

            {/* Center Navigation */}
            <div className="hidden lg:flex gap-1 items-center justify-center">
              {navItems.map((item) => (
                <Link
                  key={item.href}
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

      {/* Vertical Feedback Button */}
      <button 
        type="button"
        className="fixed right-0 top-1/2 -translate-y-1/2 translate-x-[calc(50%-12px)] hover:translate-x-0 transition-all duration-300 z-40 bg-brand-dark text-white px-5 py-2.5 rounded-l-2xl font-bold text-xs uppercase tracking-widest flex items-center gap-3 shadow-2xl vertical-rl rotate-180"
        style={{ writingMode: 'vertical-rl' }}
      >
        <MessageSquare className="w-4 h-4 rotate-90" />
        Feedback
      </button>

      {/* Floating Chat Widget with Logo */}
      <div className="fixed bottom-8 right-8 z-40">
        <button className="group relative w-14 h-14 bg-primary rounded-full shadow-2xl shadow-primary/40 flex items-center justify-center hover:scale-110 active:scale-95 transition-all">
          <div className="absolute -top-12 right-0 bg-brand-dark text-white px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl">
            Chat with us
            <div className="absolute bottom-0 right-5 translate-y-1/2 w-2 h-2 bg-brand-dark rotate-45"></div>
          </div>
          <div className="bg-white rounded-lg flex items-center justify-center shadow-inner overflow-hidden ring-1 ring-white/20">
            <Logo size="sm" hideText className="scale-[0.6]" />
          </div>
          <div className="absolute top-0 right-0 w-3.5 h-3.5 bg-brand-online border-2 border-primary rounded-full"></div>
        </button>
      </div>
    </div>

  );
}
