import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { 
  Bold, 
  Italic, 
  List, 
  ListOrdered, 
  Quote, 
  Undo, 
  Redo, 
  Link as LinkIcon,
  Image as ImageIcon,
  Heading1,
  Heading2,
  Code
} from 'lucide-react';

interface BlogEditorProps {
  content: string;
  onChange: (content: string) => void;
}

export function BlogEditor({ content, onChange }: BlogEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
      }),
      Image,
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  if (!editor) {
    return null;
  }

  const addLink = () => {
    const url = window.prompt('URL');
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  const addImage = () => {
    const url = window.prompt('Image URL');
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  };

  return (
    <div className="border border-brand-border rounded-xl overflow-hidden bg-white">
      {/* Tool bar */}
      <div className="flex flex-wrap items-center gap-1 p-2 border-b border-brand-border bg-brand-light/30">
        <MenuButton 
          onClick={() => editor.chain().focus().toggleBold().run()} 
          active={editor.isActive('bold')}
        >
          <Bold className="w-4 h-4" />
        </MenuButton>
        <MenuButton 
          onClick={() => editor.chain().focus().toggleItalic().run()} 
          active={editor.isActive('italic')}
        >
          <Italic className="w-4 h-4" />
        </MenuButton>
        <MenuButton 
          onClick={() => editor.chain().focus().toggleCode().run()} 
          active={editor.isActive('code')}
        >
          <Code className="w-4 h-4" />
        </MenuButton>
        
        <div className="w-[1px] h-6 bg-brand-border mx-1" />
        
        <MenuButton 
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} 
          active={editor.isActive('heading', { level: 1 })}
        >
          <Heading1 className="w-4 h-4" />
        </MenuButton>
        <MenuButton 
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} 
          active={editor.isActive('heading', { level: 2 })}
        >
          <Heading2 className="w-4 h-4" />
        </MenuButton>
        
        <div className="w-[1px] h-6 bg-brand-border mx-1" />
        
        <MenuButton 
          onClick={() => editor.chain().focus().toggleBulletList().run()} 
          active={editor.isActive('bulletList')}
        >
          <List className="w-4 h-4" />
        </MenuButton>
        <MenuButton 
          onClick={() => editor.chain().focus().toggleOrderedList().run()} 
          active={editor.isActive('orderedList')}
        >
          <ListOrdered className="w-4 h-4" />
        </MenuButton>
        <MenuButton 
          onClick={() => editor.chain().focus().toggleBlockquote().run()} 
          active={editor.isActive('blockquote')}
        >
          <Quote className="w-4 h-4" />
        </MenuButton>
        
        <div className="w-[1px] h-6 bg-brand-border mx-1" />
        
        <MenuButton onClick={addLink} active={editor.isActive('link')}>
          <LinkIcon className="w-4 h-4" />
        </MenuButton>
        <MenuButton onClick={addImage}>
          <ImageIcon className="w-4 h-4" />
        </MenuButton>
        
        <div className="w-[1px] h-6 bg-brand-border mx-1" />
        
        <MenuButton onClick={() => editor.chain().focus().undo().run()}>
          <Undo className="w-4 h-4" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().redo().run()}>
          <Redo className="w-4 h-4" />
        </MenuButton>
      </div>

      <div className="p-4 min-h-[400px]">
        <EditorContent editor={editor} className="prose prose-brand max-w-none focus:outline-none" />
      </div>
    </div>
  );
}

function MenuButton({ onClick, active = false, children }: { onClick: () => void; active?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`p-2 rounded-lg transition-colors ${
        active 
          ? 'bg-primary text-white' 
          : 'text-brand-gray hover:bg-brand-light hover:text-brand-dark'
      }`}
    >
      {children}
    </button>
  );
}
