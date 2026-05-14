import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, useLoaderData, useSubmit } from "@remix-run/react";
import { prisma } from "~/database/db.server";
import { requireOwner } from "~/backend/auth.server";
import { Plus, Edit2, Trash2, Eye, Calendar, MoreHorizontal } from "lucide-react";
import { format } from "date-fns";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireOwner(request);
  const posts = await prisma.blogPost.findMany({
    orderBy: { createdAt: "desc" },
    include: { author: true }
  });
  return json({ posts });
}

export default function BlogList() {
  const { posts } = useLoaderData<typeof loader>();
  const submit = useSubmit();

  const handleDelete = (id: string, title: string) => {
    if (confirm(`Are you sure you want to delete "${title}"?`)) {
      const formData = new FormData();
      formData.append("intent", "delete");
      formData.append("id", id);
      submit(formData, { method: "post", action: "/api/blog/delete" });
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-brand-dark tracking-tight">Blog Manager</h1>
          <p className="text-brand-gray text-sm">Create and manage your blog posts</p>
        </div>
        <Link 
          to="new"
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
        >
          <Plus className="w-4 h-4" />
          New Post
        </Link>
      </div>

      <div className="bg-white border border-brand-border rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-brand-light/50 border-b border-brand-border">
                <th className="px-6 py-4 text-xs font-black text-brand-gray uppercase tracking-widest">Title</th>
                <th className="px-6 py-4 text-xs font-black text-brand-gray uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-xs font-black text-brand-gray uppercase tracking-widest text-right">Published Date</th>
                <th className="px-6 py-4 text-xs font-black text-brand-gray uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border text-sm">
              {posts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-brand-gray italic">
                    No blog posts found. Create your first post!
                  </td>
                </tr>
              ) : (
                posts.map((post) => (
                  <tr key={post.id} className="hover:bg-brand-light/20 transition-colors">
                    <td className="px-6 py-4 font-bold text-brand-dark">
                      <div className="flex flex-col">
                        <span>{post.title}</span>
                        <span className="text-xs font-medium text-brand-gray/60 italic font-mono">{post.slug}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        post.published 
                          ? "bg-green-100 text-green-700 border border-green-200" 
                          : "bg-brand-light text-brand-gray border border-brand-border"
                      }`}>
                        {post.published ? "Published" : "Draft"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-brand-gray font-medium">
                      <div className="flex flex-col items-end">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-brand-gray/40" />
                          {format(new Date(post.createdAt), "MMM d, yyyy")}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link 
                          to={`/blog/${post.slug}`} 
                          target="_blank"
                          className="p-2 text-brand-gray hover:text-brand-dark hover:bg-brand-light rounded-lg transition-all"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        <Link 
                          to={post.id} 
                          className="p-2 text-brand-gray hover:text-primary hover:bg-brand-light rounded-lg transition-all"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Link>
                        <button 
                          onClick={() => handleDelete(post.id, post.title)}
                          className="p-2 text-brand-gray hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
