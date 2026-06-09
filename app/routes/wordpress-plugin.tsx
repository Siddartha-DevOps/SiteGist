import { Header } from "~/frontend/components/Header";
import { Footer } from "~/frontend/components/Footer";
import { CTAButton } from "~/frontend/components/CTAButton";
import { 
  Download, 
  Settings, 
  Zap, 
  CheckCircle, 
  Code,
  Smartphone,
  Globe,
  Layout
} from "lucide-react";

export default function WordpressPlugin() {
  const steps = [
    { title: "Install", description: "Download the plugin file and upload it via WordPress Admin > Plugins > Add New > Upload Plugin.", icon: <Download className="w-5 h-5" /> },
    { title: "Activate", description: "Activate the plugin and open Settings > SiteGist Chatbot in your WordPress admin.", icon: <Zap className="w-5 h-5" /> },
    { title: "Connect", description: "Paste your Project ID from the SiteGist dashboard and click Save. Your chatbot is live.", icon: <Settings className="w-5 h-5" /> },
  ];

  return (
    <div className="bg-white min-h-screen">
      <div className="pt-32 pb-20 px-6 max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row items-center gap-16 mb-32">
          <div className="flex-1">
             <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-[#21759b] rounded-2xl flex items-center justify-center">
                   <Globe className="w-7 h-7 text-white" />
                </div>
                <div className="text-sm font-black text-brand-dark uppercase tracking-widest">SiteGist for WordPress</div>
             </div>
             <h1 className="text-4xl md:text-6xl font-extrabold text-brand-dark mb-6 tracking-tight leading-[1.1]">
                Launch your AI bot <br />
                <span className="text-brand-accent">without any code.</span>
             </h1>
             <p className="text-xl text-brand-gray mb-10 max-w-xl leading-relaxed">
                Connect your WordPress site to SiteGist in seconds. No theme hacking or complex scripts required. Just install and go live.
             </p>
             <div className="flex flex-col sm:flex-row items-start gap-4">
               <a
                 href="/sitegist-chatbot.php"
                 download="sitegist-chatbot.php"
                 className="inline-flex items-center gap-2 px-10 py-5 text-base font-bold text-white rounded-2xl bg-[#21759b] hover:bg-[#1a5f80] transition-all w-full sm:w-auto justify-center"
               >
                 <Download className="w-5 h-5" />
                 Download Plugin
               </a>
               <CTAButton to="/signup" variant="secondary" className="px-10 py-5 text-base w-full sm:w-auto">View Setup Guide</CTAButton>
             </div>
          </div>
          <div className="flex-1">
             <div className="bg-brand-light rounded-[40px] p-8 md:p-12 border border-brand-border shadow-xl">
                <div className="bg-white rounded-2xl border border-brand-border p-6 shadow-sm mb-6">
                   <div className="flex items-center gap-4 mb-6">
                      <div className="w-6 h-6 bg-brand-accent rounded-full"></div>
                      <div className="h-4 w-32 bg-brand-light rounded-full"></div>
                   </div>
                   <div className="space-y-4">
                      <div className="h-3 w-full bg-brand-light/50 rounded-full"></div>
                      <div className="h-3 w-5/6 bg-brand-light/50 rounded-full"></div>
                      <div className="h-3 w-4/6 bg-brand-light/50 rounded-full"></div>
                   </div>
                </div>
                {/* Plugin Settings Mock */}
                <div className="bg-white rounded-2xl border border-brand-border p-8 shadow-sm">
                   <h4 className="font-bold text-brand-dark mb-6 flex items-center gap-2">
                     <Settings className="w-4 h-4 text-brand-accent" />
                     SiteGist Settings
                   </h4>
                   <div className="space-y-6">
                      <div>
                        <label className="block text-[10px] font-black text-brand-gray uppercase tracking-widest mb-2">Project ID</label>
                        <div className="w-full py-3 px-4 bg-brand-light rounded-xl border border-brand-border text-sm font-mono text-brand-dark">
                          cm9x3kabcdef0123456...
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                         <div className="w-10 h-5 bg-brand-online rounded-full relative">
                            <div className="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full"></div>
                         </div>
                         <span className="text-sm font-bold text-brand-dark">Bot Enabled</span>
                      </div>
                   </div>
                </div>
             </div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-32">
           {steps.map((step) => (
             <div key={step.title} className="p-8 rounded-3xl border border-brand-border bg-white hover:border-brand-accent/20 transition-all text-center">
                <div className="w-12 h-12 bg-brand-light rounded-2xl flex items-center justify-center text-brand-accent mx-auto mb-6">
                  {step.icon}
                </div>
                <h3 className="text-xl font-bold text-brand-dark mb-4">{step.title}</h3>
                <p className="text-brand-gray text-sm leading-relaxed font-medium">
                  {step.description}
                </p>
             </div>
           ))}
        </div>

        <div className="bg-brand-dark rounded-[40px] p-12 md:p-20 text-center relative overflow-hidden">
           <h2 className="text-3xl md:text-5xl font-extrabold text-white mb-8 tracking-tight">Trusted by WordPress developers.</h2>
           <p className="text-white/60 text-xl max-w-2xl mx-auto mb-12">
             SiteGist is optimized for Gutenberg, Elementor, and all major WordPress themes.
           </p>
           <div className="flex justify-center gap-12 font-bold text-white/40 uppercase tracking-widest text-xs">
              <span>SEO Optimized</span>
              <span>Lightweight</span>
              <span>Mobile Ready</span>
           </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
