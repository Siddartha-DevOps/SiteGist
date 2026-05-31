import { Form, Link } from "@remix-run/react";
import { Loader2 } from "lucide-react";
import { Logo } from "~/frontend/components/Logo";
import { Turnstile } from "~/frontend/components/Turnstile";

interface LoginPageProps {
  error?: string;
  success?: boolean;
  sentEmail?: string;
  isSubmitting: boolean;
  devVerificationUrl?: string;
  hasResend?: boolean;
}

export function LoginPage({ error, success, sentEmail, isSubmitting, devVerificationUrl, hasResend }: LoginPageProps) {
  const configSiteKey = typeof window !== "undefined" ? (window as any).ENV?.VITE_CLOUDFLARE_TURNSTILE_SITE_KEY : undefined;
  const siteKey = configSiteKey || "1x00000000000000000000AA"; // Fallback to Cloudflare's public testing siteKey

  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f8fafc] p-6 selection:bg-blue-600 selection:text-white">
        <div className="w-full max-w-md bg-white p-10 rounded-[32px] border border-[#e2e8f0] shadow-xl text-center space-y-6">
          <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-[#0f172a]">Check your email</h1>
          <p className="text-slate-600 font-medium leading-relaxed">
            We've sent a magic login link to <span className="text-[#0f172a] font-bold">{sentEmail}</span>. 
            Click the link in the email to log in automatically.
          </p>

          {devVerificationUrl && (
            <div className="mt-4 p-5 rounded-[24px] bg-slate-50 border border-slate-200/60 text-left">
              <div className="flex items-center gap-2 mb-2">
                <span className="flex h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
                <span className="text-xs font-black text-slate-800 uppercase tracking-wider">SiteGist Fast Pass</span>
              </div>
              <p className="text-[11px] font-medium text-slate-500 mb-3 leading-relaxed">
                {!hasResend 
                  ? "Since RESEND_API_KEY is not defined in your environment variables, we generated an instant-bypass login link below for your testing convenience."
                  : "We've detected you are running in a container sandbox. Feel free to use this fast-pass link to sign in instantly:"}
              </p>
              <a 
                href={devVerificationUrl}
                className="w-full inline-flex items-center justify-center py-3 px-4 bg-zinc-950 hover:bg-black active:scale-95 text-white font-extrabold text-xs uppercase tracking-widest rounded-xl transition-all shadow-sm text-center"
              >
                Proceed directly to Dashboard
              </a>
            </div>
          )}

          <div className="pt-2">
            <Link to="/login" className="inline-block text-blue-600 font-bold hover:underline">Try another email</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#f8fafc] p-6 selection:bg-blue-600 selection:text-white">
      <div className="w-full max-w-md flex flex-col">
        {/* Brand Logo back to home */}
        <div className="flex justify-center mb-6">
          <Link to="/">
            <Logo size="md" />
          </Link>
        </div>

        {/* Title as shown in screenshot */}
        <h1 className="text-[32px] md:text-[36px] font-bold text-[#0f172a] tracking-tight mb-8 text-center font-sans">
          Sign in to your account
        </h1>
        
        {/* White Card as in screenshot */}
        <div className="bg-white p-10 rounded-[32px] border border-[#e2e8f0] shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] w-full">
          <Form method="post" className="space-y-6">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-[#0f172a]">
                Email address
              </label>
              <input 
                type="email" 
                name="email" 
                required 
                autoFocus
                className="w-full px-4 py-3.5 bg-white border border-[#cbd5e1] rounded-xl text-[#0f172a] placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-sans text-base"
                placeholder="abc@example.com"
              />
            </div>
            
            <div className="flex flex-col items-center justify-center my-4 overflow-hidden rounded-xl border border-[#e2e8f0] p-4 bg-slate-50/50">
              {/* Embedded Turnstile with light theme */}
              <Turnstile 
                siteKey={siteKey} 
                options={{ theme: "light" }}
              />
              {!configSiteKey && (
                <p className="text-[10px] text-slate-400 mt-2 font-bold tracking-tight">
                  Running in Turnstile Sandbox mode (solve challenge to submit)
                </p>
              )}
            </div>
            
            {error && (
              <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm font-medium border border-red-100 italic">
                {error}
              </div>
            )}
            
            <button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-full font-semibold text-base transition-all flex items-center justify-center shadow-lg shadow-blue-600/10 active:shadow-none hover:shadow-blue-600/20"
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                "Sign in / Sign up"
              )}
            </button>
          </Form>
          
          <p className="mt-8 text-center text-xs text-slate-500 leading-relaxed font-medium">
            No password needed. Enter your email and pass the secure Turnstile check to receive an instant sign-in link.
          </p>
        </div>
      </div>
    </div>
  );
}
