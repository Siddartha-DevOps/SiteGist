import {
  LogOut,
  Menu,
  MessageSquare,
  Sparkles,
  User,
  BookOpen,
  LifeBuoy,
  LayoutDashboard,
  Database,
} from "lucide-react";
import { Link, Form, useLocation, Outlet } from "@remix-run/react";
import React, { useState, useEffect } from "react";
import { Logo } from "~/frontend/components/Logo";
import { ChatWidget } from "~/frontend/components/ChatWidget";
import { motion, AnimatePresence } from "framer-motion";

interface DashboardLayoutPageProps {
  user: any;
  subscriptionStatus: string | null;
}

type NavItem = { label: string; icon: any; href: string; external?: boolean };

export function DashboardLayoutPage({ user, subscriptionStatus }: DashboardLayoutPageProps) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const hasActiveSub = subscriptionStatus === "active";

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const mainNav: NavItem[] = [
    { label: "Chatbots", icon: LayoutDashboard, href: "/dashboard" },
    hasActiveSub
      ? { label: "Billing", icon: Sparkles, href: "/dashboard/billing" }
      : { label: "Upgrade Plan", icon: Sparkles, href: "/pricing" },
    { label: "Profile", icon: User, href: "/dashboard/settings" },
    { label: "Admin", icon: Database, href: "/dashboard/admin" },
  ];
  const resourceNav: NavItem[] = [
    { label: "Docs", icon: BookOpen, href: "/docs" },
    { label: "Support", icon: LifeBuoy, href: "mailto:support@sitegist.co", external: true },
    { label: "Feedback", icon: MessageSquare, href: "mailto:support@sitegist.co?subject=SiteGist%20Feedback", external: true },
  ];

  const renderNav = (item: NavItem) => {
    const active = location.pathname === item.href;
    return (
      <Link
        key={item.href}
        id={`nav-item-${item.label.toLowerCase().replace(" ", "-")}`}
        to={item.href}
        target={item.external ? "_blank" : undefined}
        rel={item.external ? "noopener noreferrer" : undefined}
        className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all ${
          active ? "bg-primary/10 text-primary" : "text-brand-gray hover:bg-zinc-100 hover:text-brand-dark"
        }`}
      >
        <item.icon
          className={`w-5 h-5 shrink-0 ${active ? "text-primary" : "text-brand-gray/50 group-hover:text-brand-dark"}`}
        />
        {item.label}
      </Link>
    );
  };

  const sidebar = (
    <div className="flex flex-col h-full">
      {/* Logo + plan badge */}
      <div className="px-5 pt-6 pb-5">
        <Link to="/" className="flex items-center transition-transform hover:scale-[1.02]">
          <Logo size="sm" variant="light" />
        </Link>
        <div className="mt-3">
          {hasActiveSub ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest rounded-full ring-1 ring-primary/20">
              <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" /> Pro Plan
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-zinc-100 text-zinc-500 text-[10px] font-black uppercase tracking-widest rounded-full ring-1 ring-zinc-200">
              <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full" />
              {subscriptionStatus === "trialing" ? "Trial" : "Free Plan"}
            </span>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 space-y-1">
        {mainNav.map(renderNav)}
        <p className="px-3 pt-6 pb-2 text-[10px] font-black uppercase tracking-widest text-brand-gray/40">Resources</p>
        {resourceNav.map(renderNav)}
      </nav>

      {/* Account */}
      <div className="border-t border-brand-border p-3">
        <div className="flex items-center gap-3 px-2 py-1.5">
          <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary text-xs font-black border border-primary/20 shrink-0">
            {user?.email?.[0]?.toUpperCase() || "U"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold text-brand-gray/50 uppercase tracking-widest leading-none mb-0.5">Signed in</p>
            <p className="text-xs font-bold text-brand-dark truncate">{user?.email || "Account"}</p>
          </div>
          <Form action="/logout" method="post">
            <button
              type="submit"
              title="Logout"
              className="p-2 rounded-lg text-brand-gray/60 hover:text-red-500 hover:bg-red-50 transition-all"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </Form>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50 font-sans text-brand-dark antialiased">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col bg-white border-r border-brand-border">{sidebar}</aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 bg-black/30 z-40 lg:hidden"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "tween", duration: 0.2 }}
              className="fixed inset-y-0 left-0 w-64 bg-white border-r border-brand-border z-50 lg:hidden"
            >
              {sidebar}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <header className="lg:hidden flex items-center gap-3 px-4 h-14 bg-white border-b border-brand-border shrink-0 z-30">
          <button onClick={() => setMobileOpen(true)} className="p-2 -ml-2 text-brand-gray" aria-label="Open menu">
            <Menu className="w-5 h-5" />
          </button>
          <Logo size="sm" variant="light" />
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
            <Outlet />
          </div>
        </main>
      </div>

      <ChatWidget />
    </div>
  );
}
