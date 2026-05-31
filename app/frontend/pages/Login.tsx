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
        <div className="w-full max-w-md flex flex-col">
          <h1 className="text-[32px] md:text-[36px] font-bold text-[#0f172a] tracking-tight mb-8 text-center font-sans">
            Please check your email
          </h1>

          <div className="bg-white p-10 rounded-[32px] border border-[#e2e8f0] shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] w-full text-center space-y-6">
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 rounded-full border-[3px] border-[#10b981] flex items-center justify-center text-[#10b981]">
                <svg className="w-8 h-8 stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>

            <p className="text-slate-600 font-medium text-base mb-4 leading-relaxed">
              We've sent a log in link to
            </p>

            <div className="bg-[#f1f5f9]/60 border border-[#e1e8f0]/30 px-5 py-3 rounded-xl font-bold text-[#0f172a] text-center max-w-xs mx-auto text-base select-all tracking-tight my-4">
              {sentEmail}
            </div>

            <hr className="border-slate-100 my-6" />

            <div className="space-y-2">
              <h4 className="font-bold text-[#0f172a] text-base">Can't find it?</h4>
              <p className="text-slate-500 font-medium text-sm leading-relaxed">
                Check your spam/junk folder, or <Link to="/login" className="text-blue-600 hover:underline font-bold">try again</Link>
              </p>
            </div>

            {devVerificationUrl && (
              <div className="mt-6 p-5 rounded-[24px] bg-slate-50 border border-slate-200/60 text-left">
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
            </div>
            
            {error && (
              <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm font-medium border border-red-100 italic">
                {error}
              </div>
            )}
            
            <button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl font-bold text-base transition-all flex items-center justify-center shadow-lg shadow-blue-600/10 active:shadow-none hover:shadow-blue-600/20"
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                "Sign in / Sign up"
              )}
            </button>
          </Form>
        </div>
      </div>
    </div>
  );
}
