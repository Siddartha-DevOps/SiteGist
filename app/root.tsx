import {
  isRouteErrorResponse,
  json,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  useLocation,
  useRouteError,
  useRouteLoaderData
} from "@remix-run/react";
import type { LinksFunction, LoaderFunctionArgs } from "@remix-run/node";
import React from "react";
import { Bot } from "lucide-react";

import "./frontend/styles/tailwind.css";
import { Header } from "./frontend/components/Header";
import { BlogHeader } from "./frontend/components/BlogHeader";
import { ChatWidget } from "./frontend/components/ChatWidget";

export async function loader({ request }: LoaderFunctionArgs) {
  return json({
    ENV: {
      VITE_POSTHOG_KEY: process.env.VITE_POSTHOG_KEY,
      VITE_POSTHOG_HOST: process.env.VITE_POSTHOG_HOST,
      PARTYKIT_HOST: process.env.PARTYKIT_HOST,
      VITE_CLOUDFLARE_TURNSTILE_SITE_KEY: process.env.VITE_CLOUDFLARE_TURNSTILE_SITE_KEY,
    },
  });
}

export const links: LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const data = useRouteLoaderData("root") as { ENV: any } | undefined;
  
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>SiteGist — AI-Powered Customer Support</title>
        <meta name="description" content="SiteGist understands your site and delivers instant, accurate answers to your customers — 24/7. No humans required." />
        <meta name="theme-color" content="#155DEE" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="SiteGist" />
        <meta property="og:title" content="SiteGist — AI-Powered Customer Support" />
        <meta property="og:description" content="SiteGist understands your site and delivers instant, accurate answers to your customers — 24/7." />
        <meta property="og:image" content="/images/hero.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:url" content="https://sitegist.co" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="SiteGist — AI-Powered Customer Support" />
        <meta name="twitter:description" content="SiteGist understands your site and delivers instant, accurate answers — 24/7." />
        <meta name="twitter:image" content="/images/hero.png" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <Meta />
        <Links />
      </head>
      <body suppressHydrationWarning>
        {children}
        <ScrollRestoration />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.ENV = ${JSON.stringify(data?.ENV || {})}`,
          }}
        />
        <Scripts />
      </body>
    </html>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  console.error("ErrorBoundary caught an unhandled exception:", error);

  const is404 = isRouteErrorResponse(error) && error.status === 404;

  return (
    <div className="bg-[#FAF9F6] min-h-screen flex items-center justify-center p-6 text-[#1E293B]">
      <div className="max-w-md w-full bg-white p-8 rounded-[32px] border border-[#E2E8F0] shadow-xl text-center">
        <div className="w-16 h-16 bg-[#EFF6FF] rounded-2xl flex items-center justify-center text-[#2563EB] mx-auto mb-6">
          <Bot className="w-8 h-8 text-[#155DEE]" />
        </div>
        <h1 className="text-2xl font-extrabold mb-3 tracking-tight">
          {is404 ? "This Page has Wandered Off" : "Let's Re-establish Contact"}
        </h1>
        <p className="text-[#64748B] text-sm font-medium mb-8 leading-relaxed">
          {is404
            ? "The page you're seeking couldn't be located. Let me guide you back to secure ground."
            : "We are currently streamlining our secure assistant connections to handle your request. Let's refresh the assistant or head back to the main portal."}
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => {
              if (typeof window !== "undefined") {
                window.location.reload();
              }
            }}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#155DEE] text-white px-6 py-3 rounded-xl font-bold hover:bg-[#004AD6] transition-all cursor-pointer"
          >
            Retry Connection
          </button>
          <a
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-slate-100 text-slate-800 px-[#20px] py-3 rounded-xl font-bold hover:bg-slate-200 transition-all"
          >
            Back to Home
          </a>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const location = useLocation();
  const isBlog = location.pathname.startsWith("/blog");
  const isEmbed = location.pathname.startsWith("/embed");
  const isDashboard = location.pathname.startsWith("/dashboard");

  return (
    <div key={location.pathname} className="min-h-screen flex flex-col">
      {!isEmbed && !isDashboard && (isBlog ? <BlogHeader /> : <Header />)}
      <main className="flex-grow">
        <Outlet />
      </main>
      {!isEmbed && !isDashboard && <ChatWidget />}
    </div>
  );
}
