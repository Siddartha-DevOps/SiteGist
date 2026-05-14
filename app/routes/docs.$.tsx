import { Construction, ArrowLeft } from "lucide-react";
import { Link } from "@remix-run/react";
import React from 'react';

export default function DocsComingSoon() {
  return (
    <div className="text-center py-20 flex flex-col items-center">
      <div className="w-20 h-20 bg-brand-light rounded-3xl flex items-center justify-center mb-8 ring-1 ring-brand-border">
        <Construction className="text-primary w-10 h-10" />
      </div>
      <h1 className="text-3xl font-black text-brand-dark mb-4">Content Coming Soon</h1>
      <p className="text-brand-gray font-medium max-w-sm mx-auto mb-10 leading-relaxed">
        We're currently writing this documentation page to help you get the most out of SiteGist. Check back shortly!
      </p>
      <Link 
        to="/docs" 
        className="flex items-center gap-2 px-8 py-4 bg-brand-dark text-white rounded-2xl font-bold hover:scale-105 transition-all shadow-xl shadow-brand-dark/20"
      >
        <ArrowLeft className="w-5 h-5" /> Back to Overview
      </Link>
    </div>
  );
}
