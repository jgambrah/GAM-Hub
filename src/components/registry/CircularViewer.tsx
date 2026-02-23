'use client';

import React from 'react';
import { FileText, ShieldCheck, ExternalLink, Calendar, Briefcase, GraduationCap, Globe } from 'lucide-react';
import type { RegistryPost } from '@/lib/types';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';

interface CircularViewerProps {
  post: RegistryPost;
}

/**
 * CircularViewer Component
 * 
 * Implements the "Multimedia UI" pattern for direct circular rendering.
 * Uses a high-compatibility PDF wrapper and glassmorphic styling to keep
 * students inside the academic Fortress.
 */
export function CircularViewer({ post }: CircularViewerProps) {
  const attachment = post.attachments && post.attachments.length > 0 ? post.attachments[0] : null;
  const isPDF = attachment?.toLowerCase().includes('.pdf');

  const TargetIcon = post.targetAudience === 'staff' ? Briefcase : post.targetAudience === 'student' ? GraduationCap : Globe;

  return (
    <div className={cn(
        "bg-white/40 dark:bg-card/40 backdrop-blur-md border-2 rounded-[2.5rem] p-8 shadow-xl relative overflow-hidden group transition-all duration-500 hover:shadow-2xl border-l-8",
        post.isUrgent ? 'border-red-200 dark:border-red-900 border-l-red-600 ring-4 ring-red-50 dark:ring-red-900/10' : 'border-slate-100 dark:border-slate-800 border-l-slate-900'
    )}>
      {/* Background Graphic Watermark */}
      <div className="absolute right-0 top-0 p-8 opacity-5 -mr-4 -mt-4 pointer-events-none group-hover:rotate-12 transition-transform duration-700">
        <ShieldCheck size={120} className={post.isUrgent ? 'text-red-600' : 'text-slate-900 dark:text-white'} />
      </div>

      {/* HEADER: AUTHORITY & METADATA */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 relative z-10">
        <div className="flex items-center gap-3">
          <div className={cn(
              "p-3 rounded-2xl shadow-sm transition-transform group-hover:scale-110",
              post.isUrgent ? "bg-red-50 text-red-600 dark:bg-red-900/20" : "bg-slate-100 text-slate-900 dark:bg-slate-800"
          )}>
            {isPDF ? <FileText size={20} /> : <ShieldCheck size={20} />}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest border-2 flex items-center gap-1.5 bg-white/50 dark:bg-slate-950/50">
                    <TargetIcon size={10} /> Official: {post.targetAudience?.toUpperCase() || 'ALL'}
                </Badge>
                {post.isUrgent && (
                    <Badge className="bg-red-600 text-white border-none animate-pulse text-[10px] font-black uppercase">Urgent Alert</Badge>
                )}
            </div>
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
              <Calendar size={12}/> {format(new Date(post.createdAt), "PPP")}
            </p>
          </div>
        </div>
        
        {attachment && (
          <a 
            href={attachment} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-white/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-700 rounded-xl transition-all shadow-sm text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300"
          >
            <ExternalLink size={14} /> Open Original
          </a>
        )}
      </div>

      {/* CONTENT: THE MESSAGE */}
      <div className="relative z-10 mb-8">
        <h2 className={cn(
            "text-3xl font-black leading-tight mb-4 tracking-tight",
            post.isUrgent ? "text-red-900 dark:text-red-400" : "text-slate-900 dark:text-white"
        )}>
            {post.title}
        </h2>
        <div className="bg-white/30 dark:bg-slate-900/30 p-6 rounded-[2rem] border border-white/20 dark:border-slate-800/50 shadow-inner">
            <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed font-medium">
                {post.content}
            </p>
        </div>
      </div>

      {/* MEDIA: THE ATTACHMENT VIEWER */}
      {attachment && (
        <div className="relative z-10 mt-4 rounded-[2.5rem] overflow-hidden border-4 border-white/50 dark:border-slate-800/50 bg-slate-100 dark:bg-slate-950 shadow-2xl animate-in zoom-in duration-500">
          {isPDF ? (
            <iframe 
              src={`https://docs.google.com/viewer?url=${encodeURIComponent(attachment)}&embedded=true`}
              className="w-full h-[600px] border-none"
              title="Official Circular Content"
            />
          ) : (
            <div className="relative group/img">
                <img src={attachment} alt={post.title} className="w-full h-auto object-contain max-h-[800px] mx-auto" />
                <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/5 transition-all pointer-events-none" />
            </div>
          )}
        </div>
      )}
      
      <div className="mt-8 flex justify-center opacity-40 group-hover:opacity-100 transition-opacity">
         <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.4em]">
           Authenticated Registry Node • GH 🇬🇭
         </p>
      </div>
    </div>
  );
}
