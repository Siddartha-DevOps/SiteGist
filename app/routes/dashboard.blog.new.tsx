import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useActionData, useNavigation, useNavigate } from "@remix-run/react";
import { useState, useEffect } from "react";
import { prisma } from "~/database/db.server";
import { requireOwner } from "~/backend/auth.server";
import { BlogEditor } from "~/frontend/components/BlogEditor";
import { ArrowLeft, Save, Send, Trash2, Image as ImageIcon } from "lucide-react";
import slugify from "slugify";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireOwner(request);
  return json({});
}

export default function NewBlogPost() {
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [status, setStatus] = useState("false");
  const navigation = useNavigation();
  const navigate = useNavigate();
  const isSubmitting = navigation.state === "submitting";

  useEffect(() => {
    if (title) {
      setSlug(slugify(title, { lower: true, strict: true }));
    }
  }, [title]);

  return (
    <div className="space-y-8 pb-20">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-brand-light rounded-xl transition-all text-brand-gray hover:text-brand-dark"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-black text-brand-dark tracking-tight">New Post</h1>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${
              status === "true" 
                ? "bg-green-100 text-green-700 border-green-200" 
                : "bg-amber-100 text-amber-600 border-amber-200"
            }`}>
              {status === "true" ? "Ready to Publish" : "Draft"}
            </span>
          </div>
          <p className="text-brand-gray text-sm">Draft a new article for your blog</p>
        </div>
      </div>

      <Form method="post" action="/api/blog/create" className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Main Content Area */}
          <div className="space-y-4">
            <input
              type="text"
              name="title"
              placeholder="Post Title"
              className="w-full text-4xl font-black bg-transparent border-none focus:ring-0 placeholder:text-brand-gray/20 text-brand-dark"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
            
            <div className="flex items-center gap-2 text-sm text-brand-gray font-mono bg-brand-light/50 px-3 py-1.5 rounded-lg w-fit">
              <span className="font-bold opacity-40">slug:</span>
              <input 
                type="text" 
                name="slug" 
                className="bg-transparent border-none p-0 focus:ring-0 text-brand-gray w-auto min-w-[200px]"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-brand-gray uppercase tracking-widest px-1">Excerpt</label>
            <textarea
              name="excerpt"
              placeholder="Brief summary of the post..."
              className="w-full h-24 p-4 rounded-xl border border-brand-border focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all resize-none text-sm bg-white"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-brand-gray uppercase tracking-widest px-1">Content</label>
            <input type="hidden" name="content" value={content} />
            <BlogEditor content={content} onChange={setContent} />
          </div>
        </div>

        <div className="space-y-6">
          {/* Sidebar Settings */}
          <div className="bg-white border border-brand-border rounded-2xl p-6 space-y-6 shadow-sm">
            <h3 className="text-sm font-black text-brand-dark uppercase tracking-widest border-b border-brand-border pb-3">Publish Settings</h3>
            
            <div className="space-y-4 text-sm font-bold text-brand-gray">
              <div className="flex items-center justify-between p-3 bg-brand-light/30 rounded-xl">
                <span>Status</span>
                <select 
                  name="published" 
                  value={status} 
                  onChange={(e) => setStatus(e.target.value)}
                  className="bg-transparent border-none focus:ring-0 text-primary font-black cursor-pointer"
                >
                  <option value="false">Draft</option>
                  <option value="true">Published</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-brand-gray uppercase tracking-widest flex items-center gap-2">
                   <ImageIcon className="w-3 h-3" /> Cover Image URL
                </label>
                <input
                  type="text"
                  name="coverImage"
                  placeholder="https://example.com/image.jpg"
                  className="w-full px-4 py-2.5 rounded-xl border border-brand-border focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all text-xs font-medium"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-brand-gray uppercase tracking-widest">Tags (comma separated)</label>
                <input
                  type="text"
                  name="tags"
                  placeholder="marketing, updates, tech"
                  className="w-full px-4 py-2.5 rounded-xl border border-brand-border focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all text-xs font-medium"
                />
              </div>
            </div>
          </div>

          <div className="bg-white border border-brand-border rounded-2xl p-6 space-y-6 shadow-sm">
            <h3 className="text-sm font-black text-brand-dark uppercase tracking-widest border-b border-brand-border pb-3">SEO Details</h3>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-brand-gray uppercase tracking-widest px-1">Meta Title</label>
                <input
                   type="text"
                   name="metaTitle"
                   placeholder="Meta Title"
                   className="w-full px-4 py-2.5 rounded-xl border border-brand-border focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all text-xs font-medium"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-brand-gray uppercase tracking-widest px-1">SEO Title</label>
                <input
                  type="text"
                  name="seoTitle"
                  placeholder="Focus SEO Title"
                  className="w-full px-4 py-2.5 rounded-xl border border-brand-border focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all text-xs font-medium"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-brand-gray uppercase tracking-widest px-1">Meta Description</label>
                <textarea
                  name="metaDescription"
                  placeholder="Meta Description"
                  className="w-full h-20 p-3 rounded-xl border border-brand-border focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all resize-none text-xs font-medium"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-brand-gray uppercase tracking-widest px-1">SEO Description</label>
                <textarea
                  name="seoDescription"
                  placeholder="Extended SEO Description"
                  className="w-full h-20 p-3 rounded-xl border border-brand-border focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all resize-none text-xs font-medium"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
             <button
              type="submit"
              disabled={isSubmitting}
              onClick={() => setStatus("true")}
              className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-4 bg-primary text-white font-black rounded-xl hover:bg-primary/90 transition-all shadow-xl shadow-primary/20 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {isSubmitting ? "Publishing..." : "Publish Post"}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              onClick={() => setStatus("false")}
              className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-4 bg-brand-light text-brand-gray font-black rounded-xl hover:bg-zinc-200 transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSubmitting ? "Saving..." : "Save as Draft"}
            </button>
          </div>
        </div>
      </Form>
    </div>
  );
}
