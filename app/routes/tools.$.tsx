import { Header } from "~/frontend/components/Header";
import { Footer } from "~/frontend/components/Footer";
import { Sparkles, ArrowLeft, Construction } from "lucide-react";
import { Link, useParams } from "@remix-run/react";

export default function ToolPlaceholder() {
  const params = useParams();
  const toolName = params["*"]?.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ") || "This Tool";

  return (
    <div className="bg-[#FAF7F2] min-h-screen">
      <Header />
      <div className="pt-40 pb-20 px-6 max-w-4xl mx-auto text-center">
        <div className="w-24 h-24 bg-brand-light rounded-[32px] flex items-center justify-center mx-auto mb-8 border border-brand-border">
          <Construction className="w-10 h-10 text-brand-accent" />
        </div>
        
        <h1 className="text-4xl md:text-5xl font-extrabold text-brand-dark mb-6 tracking-tight">
          {toolName} is <span className="text-brand-accent">Coming Soon</span>
        </h1>
        
        <p className="text-xl text-brand-gray font-medium mb-12 max-w-lg mx-auto leading-relaxed">
          We're hard at work building this tool to help you automate your workflow. It will be available very shortly!
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link 
            to="/tools" 
            className="flex items-center gap-2 px-8 py-4 bg-brand-dark text-white rounded-2xl font-bold hover:bg-brand-accent transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to All Tools
          </Link>
          <Link 
            to="/" 
            className="flex items-center gap-2 px-8 py-4 bg-white border border-brand-border text-brand-dark rounded-2xl font-bold hover:bg-brand-light transition-all"
          >
            Go to Homepage
          </Link>
        </div>

        <div className="mt-24 p-12 bg-white rounded-[40px] border border-brand-border relative overflow-hidden">
           <div className="absolute top-0 right-0 p-8 transform rotate-12 opacity-5 translate-x-4 -translate-y-4">
             <Sparkles className="w-32 h-32 text-brand-accent" />
           </div>
           <h3 className="text-2xl font-extrabold text-brand-dark mb-4">Want early access?</h3>
           <p className="text-brand-gray font-medium mb-8">Join 2,000+ others getting notified about our latest AI tool releases.</p>
           <form className="flex max-w-md mx-auto gap-2">
             <input 
               type="email" 
               placeholder="Enter your email" 
               className="flex-1 px-6 py-4 rounded-xl border border-brand-border outline-none focus:ring-2 focus:ring-brand-accent/20 transition-all font-medium"
             />
             <button className="px-8 py-4 bg-brand-accent text-white rounded-xl font-bold hover:bg-brand-dark transition-all">
               Notify Me
             </button>
           </form>
        </div>
      </div>
      <Footer />
    </div>
  );
}
