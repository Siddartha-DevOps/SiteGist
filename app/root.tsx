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
  console.error(error);

  return (
    <div className="bg-brand-bg min-h-screen flex items-center justify-center p-6 text-brand-dark">
      <div className="max-w-md w-full bg-white p-8 rounded-[32px] border border-brand-border shadow-2xl text-center">
        <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center text-red-500 mx-auto mb-6">
          <Bot className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold mb-4">
          {isRouteErrorResponse(error)
            ? `${error.status} ${error.statusText}`
            : error instanceof Error
            ? error.message
            : "Something went wrong"}
        </h1>
        <p className="text-brand-gray font-medium mb-8">
          The application encountered an unexpected error. Please check your environment variables or contact support.
        </p>
        <a
          href="/"
          className="inline-flex items-center gap-2 bg-brand-dark text-white px-6 py-3 rounded-xl font-bold hover:bg-brand-accent transition-all"
        >
          Back to Home
        </a>
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
