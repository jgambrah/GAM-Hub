"use client"

import { FileText, Eye, ShieldCheck, Calendar, GraduationCap, Briefcase, Globe } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { RegistryViewerModal } from "./RegistryViewerModal";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { RegistryPost } from "@/lib/types";

/**
 * CircularCard Component
 * 
 * Displays official university directives in the Registry Hub.
 * Features content-type detection and Focus Mode activation.
 */
export function CircularCard({ post }: { post: RegistryPost }) {
  const [isOpen, setIsOpen] = useState(false);
  const attachment = post.attachments && post.attachments.length > 0 ? post.attachments[0] : null;
  const isPDF = attachment?.toLowerCase().includes(".pdf");

  const TargetIcon = post.targetAudience === 'staff' ? Briefcase : post.targetAudience === 'student' ? GraduationCap : Globe;

  return (
    <div className={cn(
        "group relative bg-white dark:bg-card border-2 rounded-[2.5rem] p-8 transition-all duration-500 hover:shadow-2xl border-l-8 overflow-hidden",
        post.isUrgent ? 'border-red-200 dark:border-red-900 border-l-red-600 ring-4 ring-red-50 dark:ring-red-900/10' : 'border-slate-100 dark:border-slate-800 border-l-slate-900'
    )}>
      {/* Background Graphic */}
      <div className="absolute right-0 top-0 p-8 opacity-5 -mr-4 -mt-4 pointer-events-none group-hover:rotate-12 transition-transform duration-700">
        <ShieldCheck size={120} className={post.isUrgent ? 'text-red-600' : 'text-slate-900'} />
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className={cn(
              "p-3 rounded-2xl shadow-sm transition-transform group-hover:scale-110",
              post.isUrgent ? "bg-red-50 text-red-600 dark:bg-red-900/20" : "bg-slate-100 text-slate-900 dark:bg-slate-800"
          )}>
            {isPDF ? <FileText size={20} /> : <ShieldCheck size={20} />}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest border-2 flex items-center gap-1.5">
                    <TargetIcon size={10} /> {post.targetAudience || 'ALL'}
                </Badge>
                {post.isUrgent && (
                    <Badge className="bg-red-600 text-white border-none animate-pulse text-[10px] font-black uppercase">Urgent</Badge>
                )}
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <Calendar size={12}/> {format(new Date(post.createdAt), "PPP")}
            </p>
          </div>
        </div>
        <div className="text-[10px] font-mono text-slate-300 dark:text-slate-700">
            REF: UR-{post.id.slice(-8).toUpperCase()}
        </div>
      </div>

      <h3 className={cn(
          "font-black text-2xl leading-tight mb-4 group-hover:translate-x-1 transition-transform",
          post.isUrgent ? "text-red-900 dark:text-red-400" : "text-slate-900 dark:text-white"
      )}>
        {post.title}
      </h3>
      
      <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-[1.8rem] border border-slate-100 dark:border-slate-800 mb-6 shadow-inner">
        <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed line-clamp-3 font-medium">
            {post.content}
        </p>
      </div>

      {attachment && (
        <button 
          onClick={() => setIsOpen(true)}
          className={cn(
              "w-full flex items-center justify-center gap-3 py-4 rounded-2xl text-sm font-black uppercase tracking-widest transition-all shadow-lg active:scale-95",
              post.isUrgent ? "bg-red-600 text-white hover:bg-red-700" : "bg-slate-900 text-white hover:bg-slate-800"
          )}
        >
          <Eye size={18} />
          Enter Focus Mode
        </button>
      )}

      {attachment && (
        <RegistryViewerModal 
            isOpen={isOpen} 
            setIsOpen={setIsOpen} 
            fileUrl={attachment} 
            title={post.title}
        />
      )}
    </div>
  );
}
