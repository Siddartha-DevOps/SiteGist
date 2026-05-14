import { json, unstable_parseMultipartFormData, unstable_createMemoryUploadHandler } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import { Header } from "~/frontend/components/Header";
import { Footer } from "~/frontend/components/Footer";
import { FileText, Copy, Check, Download, AlertCircle, Loader2 } from "lucide-react";
import { useActionData, useNavigation, Form } from "@remix-run/react";
import { useState, useRef, useEffect } from "react";
import { parsePdf } from "~/lib/pdf.server";

export async function action({ request }: ActionFunctionArgs) {
  const uploadHandler = unstable_createMemoryUploadHandler({
    maxPartSize: 10 * 1024 * 1024, // 10MB
  });

  const formData = await unstable_parseMultipartFormData(request, uploadHandler);
  const file = formData.get("pdf") as File;

  if (!file) {
    return json({ error: "No file uploaded" }, { status: 400 });
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const data = await parsePdf(buffer);
    
    // Simple text to markdown conversion (can be improved)
    const markdown = `# ${file.name}\n\n${data.text}`;
    
    return json({ success: true, markdown, fileName: file.name });
  } catch (error: any) {
    console.error("PDF Parsing Error:", error);
    return json({ error: `Failed to parse PDF: ${error.message}` }, { status: 500 });
  }
}

export default function PdfToMarkdown() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  
  const [copied, setCopied] = useState(false);
  const resultRef = useRef<HTMLTextAreaElement>(null);

  const handleCopy = () => {
    if (actionData && "markdown" in actionData) {
      navigator.clipboard.writeText(actionData.markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    if (actionData && "markdown" in actionData) {
      const blob = new Blob([actionData.markdown], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const downloadName = (actionData as any).fileName.replace(/\.pdf$/i, ".md") || "document.md";
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="bg-white min-h-screen">
      <div className="pt-32 pb-20 px-6 max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-light text-brand-gray text-[10px] font-bold uppercase tracking-widest mb-6 border border-brand-border">
            <FileText className="w-3 h-3" />
            PDF Converter
          </div>
          <h1 className="text-4xl font-extrabold text-brand-dark mb-4 tracking-tight">PDF to Markdown</h1>
          <p className="text-brand-gray font-medium">Extract text from PDF documents and save as clean Markdown.</p>
        </div>

        <div className="bg-brand-light/50 p-8 rounded-3xl border border-brand-border mb-12">
          <Form method="post" encType="multipart/form-data" className="space-y-6">
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-brand-border rounded-2xl p-12 hover:border-brand-accent/50 hover:bg-brand-accent/5 transition-all cursor-pointer relative group">
              <input 
                type="file" 
                name="pdf" 
                accept=".pdf" 
                required 
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <div className="bg-white p-4 rounded-xl shadow-sm mb-4 group-hover:scale-110 transition-transform">
                <FileText className="w-8 h-8 text-brand-accent" />
              </div>
              <p className="text-sm font-bold text-brand-dark mb-1">Click or drag PDF here</p>
              <p className="text-xs text-brand-gray">Maximum file size: 10MB</p>
            </div>

            <button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full py-4 bg-brand-dark text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-brand-accent transition-all shadow-lg shadow-brand-dark/10 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Converting...
                </>
              ) : (
                "Convert to Markdown"
              )}
            </button>
          </Form>

          {actionData && "error" in actionData && (
            <div className="mt-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-600 text-sm font-medium">
              <AlertCircle className="w-5 h-5" />
              {actionData.error}
            </div>
          )}
        </div>

        {actionData && "markdown" in actionData && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-extrabold text-brand-dark">Converted Result</h2>
              <div className="flex gap-2">
                <button 
                  onClick={handleCopy}
                  className="p-2.5 bg-white border border-brand-border rounded-xl hover:bg-brand-light transition-all flex items-center gap-2 text-xs font-bold text-brand-dark"
                >
                  {copied ? <Check className="w-4 h-4 text-brand-online" /> : <Copy className="w-4 h-4" />}
                  {copied ? "Copied!" : "Copy Markdown"}
                </button>
                <button 
                   onClick={handleDownload}
                   className="p-2.5 bg-brand-dark text-white rounded-xl hover:bg-brand-accent transition-all flex items-center gap-2 text-xs font-bold shadow-md shadow-brand-dark/10"
                >
                  <Download className="w-4 h-4" />
                  Download .md
                </button>
              </div>
            </div>
            
            <div className="relative">
              <textarea 
                ref={resultRef}
                readOnly
                value={actionData.markdown}
                className="w-full h-96 p-8 bg-brand-dark text-white/90 font-mono text-sm rounded-3xl border border-white/10 outline-none focus:ring-4 focus:ring-brand-accent/20 transition-all resize-none overflow-y-auto"
              />
              <div className="absolute top-4 right-4 text-[10px] uppercase font-bold tracking-widest text-white/20">
                Markdown Output
              </div>
            </div>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
