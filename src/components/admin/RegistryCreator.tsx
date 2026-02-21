
'use client';

import React, { useState, useRef } from 'react';
import { Landmark, Send, ShieldAlert, Loader2, Upload, X, Users, Globe, Briefcase, GraduationCap, Paperclip, FileText } from 'lucide-react';
import { collection, serverTimestamp, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useFirebase, addDocumentNonBlocking } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { useCampusView } from '@/hooks/use-campus-view';
import { useAuth } from '@/hooks/use-auth';
import type { User, RegistryPost } from '@/lib/types';
import { cn } from '@/lib/utils';

/**
 * RegistryCreator Component
 * 
 * Allows Registry/Management users to publish official directives 
 * directly to the /registry_posts collection path.
 * Updated for Multimedia support and Audience targeting.
 */
export default function RegistryCreator({ userProfile }: { userProfile: User }) {
  const { firestore, storage } = useFirebase();
  const { toast } = useToast();
  const { viewAsCampus } = useCampusView();
  const { isTokenReady } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    isUrgent: false,
    targetAudience: 'all' as 'all' | 'staff' | 'student',
  });
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !storage || !userProfile || !isTokenReady) return;

    if (!formData.title || !formData.content) {
        toast({ variant: 'destructive', title: 'Missing Info', description: 'Headline and content are required.' });
        return;
    }
    
    setLoading(true);
    try {
      const campusId = viewAsCampus?.id || userProfile.campusId || 'all';

      // 1. Upload Attachments
      const attachmentUrls: string[] = [];
      for (const file of files) {
        const filePath = `registry_attachments/${campusId}/${Date.now()}_${file.name}`;
        const storageRef = ref(storage, filePath);
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);
        attachmentUrls.push(url);
      }

      // 2. Prepare Payload
      const postData: Partial<RegistryPost> = {
        title: formData.title,
        content: formData.content,
        isUrgent: formData.isUrgent,
        targetAudience: formData.targetAudience,
        attachments: attachmentUrls,
        campusId,
        authorId: userProfile.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // 3. Mutation (Non-Blocking Pattern)
      const colRef = collection(firestore, 'registry_posts');
      addDocumentNonBlocking(colRef, postData)
        .catch(async (serverError) => {
          // contextual error handled by emitter internally
        });
      
      toast({ title: "Directive Published!", description: "The notice is now active in the Registry Hub." });
      setFormData({ title: '', content: '', isUrgent: false, targetAudience: 'all' });
      setFiles([]);
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: "Error", description: "Could not publish notice." });
    } finally {
      setLoading(false);
    }
  };

  const campusContext = viewAsCampus?.acronym || userProfile.campusAcronym || 'National';

  return (
    <div className="bg-card rounded-[3rem] border border-border shadow-2xl p-10 max-w-3xl mx-auto">
      <div className="flex items-center gap-4 mb-10">
        <div className="p-4 bg-slate-900 text-white rounded-3xl shadow-lg">
          <Landmark size={28} />
        </div>
        <div>
          <h2 className="text-2xl font-black text-foreground tracking-tight">Registry Directive Creator</h2>
          <p className="text-sm text-muted-foreground font-medium italic">Official Management Portal for {campusContext}</p>
        </div>
      </div>

      <form onSubmit={handlePublish} className="space-y-6">
        {/* Headline */}
        <div className="space-y-2">
          <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-2">Headline</label>
          <input 
            required 
            placeholder="e.g., Mandatory Hall Registration Deadline" 
            className="w-full p-5 rounded-2xl bg-muted border-none font-black text-lg text-foreground outline-none focus:ring-2 focus:ring-primary transition-all shadow-inner" 
            value={formData.title} 
            onChange={e => setFormData({...formData, title: e.target.value})} 
          />
        </div>

        {/* Target Audience Selector */}
        <div className="space-y-2">
          <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-2">Target Audience</label>
          <div className="flex gap-2 bg-muted p-1.5 rounded-2xl">
            {[
              { id: 'all', label: 'Everyone', icon: Globe },
              { id: 'student', label: 'Students', icon: GraduationCap },
              { id: 'staff', label: 'Staff Only', icon: Briefcase }
            ].map(audience => (
              <button
                key={audience.id}
                type="button"
                onClick={() => setFormData({ ...formData, targetAudience: audience.id as any })}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase transition-all",
                  formData.targetAudience === audience.id ? "bg-background shadow-md text-primary" : "text-muted-foreground hover:bg-white/50"
                )}
              >
                <audience.icon size={14} /> {audience.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="space-y-2">
          <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-2">Directive Content</label>
          <textarea 
            required 
            placeholder="Specify instructions clearly..." 
            className="w-full p-6 rounded-2xl bg-muted border-none h-48 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary transition-all resize-none shadow-inner" 
            value={formData.content} 
            onChange={e => setFormData({...formData, content: e.target.value})} 
          />
        </div>

        {/* Multimedia Attachments */}
        <div className="space-y-2">
          <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-2">Attachments (PDF / Memos)</label>
          <div className="p-6 border-2 border-dashed border-border rounded-[2rem] bg-muted/30 flex flex-col items-center justify-center gap-4">
            <input 
              type="file" 
              multiple 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleFileChange}
            />
            {files.length > 0 ? (
              <div className="w-full grid grid-cols-1 gap-2">
                {files.map((file, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-background rounded-xl border animate-in slide-in-from-top-2">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <Paperclip size={14} className="text-primary shrink-0" />
                      <span className="text-xs font-bold truncate">{file.name}</span>
                    </div>
                    <button type="button" onClick={() => removeFile(idx)} className="p-1 hover:bg-muted rounded-lg text-destructive transition-colors">
                      <X size={14} />
                    </button>
                  </div>
                ))}
                <button 
                  type="button" 
                  onClick={() => fileInputRef.current?.click()}
                  className="text-[10px] font-black text-primary uppercase mt-2 hover:underline w-fit mx-auto"
                >
                  + Add More Files
                </button>
              </div>
            ) : (
              <button 
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center gap-2 group"
              >
                <div className="p-4 bg-white dark:bg-card rounded-2xl shadow-sm group-hover:scale-110 transition-transform">
                  <Upload className="text-primary" size={24} />
                </div>
                <span className="text-xs font-black text-slate-500 uppercase">Attach Official Memo</span>
              </button>
            )}
          </div>
        </div>

        {/* Urgent Switch */}
        <div className="flex items-center justify-between p-5 bg-red-50 dark:bg-red-900/20 rounded-2xl border border-red-100 dark:border-red-900/30 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 rounded-lg">
              <ShieldAlert size={18} />
            </div>
            <p className="text-xs font-black text-red-700 dark:text-red-300 uppercase tracking-tight">Mark as Urgent Requirement</p>
          </div>
          <input 
            type="checkbox" 
            className="w-6 h-6 accent-red-600 rounded-lg cursor-pointer" 
            checked={formData.isUrgent} 
            onChange={(e) => setFormData({...formData, isUrgent: e.target.checked})} 
          />
        </div>

        <button 
          type="submit" 
          disabled={loading || !isTokenReady} 
          className="w-full py-5 bg-slate-900 text-white dark:bg-primary dark:text-primary-foreground rounded-[2rem] font-black text-lg flex items-center justify-center gap-3 shadow-xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
        >
          {loading ? <Loader2 className="animate-spin" /> : <><Send size={20} /> Broadcast Directive</>}
        </button>
      </form>
    </div>
  );
}
