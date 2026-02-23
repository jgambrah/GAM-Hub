'use client';

import React, { useState, useRef } from 'react';
import { Landmark, Send, ShieldAlert, Loader2, Upload, X, Globe, Briefcase, GraduationCap, Paperclip, FileText } from 'lucide-react';
import { collection, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useFirebase, addDocumentNonBlocking } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { useCampusView } from '@/hooks/use-campus-view';
import { useAuth } from '@/hooks/use-auth';
import type { RegistryPost } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

/**
 * RegistryCreator Component: The "Safe-Broadcast" Hub
 * 
 * Implements high-trust URO broadcasting for official university directives.
 * Uses the Multimedia Handshake (Storage -> Firestore) with non-blocking writes.
 */
export default function RegistryCreator({ userProfile }: { userProfile: any }) {
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
        toast({ variant: 'destructive', title: 'Information Required', description: 'Please provide a title and content for the circular.' });
        return;
    }
    
    setLoading(true);
    try {
      const campusId = viewAsCampus?.id || userProfile.campusId || 'all';

      // 1. MULTIMEDIA HANDSHAKE: Upload Attachments first
      const attachmentUrls: string[] = [];
      for (const file of files) {
        const filePath = `registry_attachments/${campusId}/${Date.now()}_${file.name}`;
        const storageRef = ref(storage, filePath);
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);
        attachmentUrls.push(url);
      }

      // 2. Prepare Payload for Root Collection (Safe-Path)
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

      // 3. SAFE-BROADCAST: Firestore Mutation (Pattern 1: Non-Blocking)
      // Writing to /registry_posts root avoids the nested path permission hurdles
      const colRef = collection(firestore, 'registry_posts');
      addDocumentNonBlocking(colRef, postData);
      
      toast({ title: "Circular Released!", description: "The official directive has been broadcasted to the Yard." });
      setFormData({ title: '', content: '', isUrgent: false, targetAudience: 'all' });
      setFiles([]);
    } catch (err) {
      console.error("Liaison Broadcast Error:", err);
      toast({ variant: 'destructive', title: "Broadcast Failed", description: "Could not release the circular at this time." });
    } finally {
      setLoading(false);
    }
  };

  const campusContext = viewAsCampus?.acronym || userProfile.campusAcronym || 'National';

  return (
    <div className="bg-white dark:bg-card rounded-[2.5rem] border-l-8 border-blue-900 shadow-2xl p-10 max-w-3xl mx-auto animate-in fade-in duration-500">
      <div className="flex items-center gap-4 mb-10">
        <div className="p-4 bg-blue-900 text-white rounded-3xl shadow-lg">
          <Landmark size={28} />
        </div>
        <div>
          <h2 className="text-2xl font-black text-blue-900 dark:text-blue-400 tracking-tight">Official Registry Broadcast</h2>
          <p className="text-sm text-muted-foreground font-medium italic">Office of the Registrar: {campusContext} Hub</p>
        </div>
      </div>

      <form onSubmit={handlePublish} className="space-y-6">
        <div className="space-y-2">
          <Label className="text-[10px] font-black text-blue-900 dark:text-blue-400 uppercase tracking-widest px-2">Circular Title</Label>
          <Input 
            required 
            placeholder="e.g., Examination Protocol 2026" 
            className="w-full p-6 h-auto rounded-2xl bg-slate-50 dark:bg-muted border-none font-bold text-lg text-foreground focus:ring-2 focus:ring-blue-900 transition-all shadow-inner" 
            value={formData.title} 
            onChange={e => setFormData({...formData, title: e.target.value})} 
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
                <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-2">Target Audience</Label>
                <Select value={formData.targetAudience} onValueChange={(val: any) => setFormData({...formData, targetAudience: val})}>
                    <SelectTrigger className="rounded-2xl border-none bg-slate-50 dark:bg-muted h-14 font-bold shadow-inner text-foreground">
                        <SelectValue placeholder="Select Audience" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-none shadow-2xl">
                        <SelectItem value="all"><div className="flex items-center gap-2"><Globe size={14}/> Campus Wide</div></SelectItem>
                        <SelectItem value="staff"><div className="flex items-center gap-2"><Briefcase size={14}/> Staff Only</div></SelectItem>
                        <SelectItem value="student"><div className="flex items-center gap-2"><GraduationCap size={14}/> Students Only</div></SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-2">
                <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-2">Priority Level</Label>
                <div className={cn(
                    "flex items-center justify-between p-3.5 h-14 rounded-2xl border-2 transition-all cursor-pointer",
                    formData.isUrgent ? "bg-red-50 border-red-200 text-red-600" : "bg-slate-50 border-transparent text-slate-400"
                )} onClick={() => setFormData({...formData, isUrgent: !formData.isUrgent})}>
                    <div className="flex items-center gap-2">
                        <ShieldAlert size={18} />
                        <span className="text-xs font-black uppercase">Urgent Notice</span>
                    </div>
                    <div className={cn("w-4 h-4 rounded-full border-2", formData.isUrgent ? "bg-red-600 border-red-600 shadow-[0_0_10px_rgba(220,38,38,0.3)]" : "border-slate-300")} />
                </div>
            </div>
        </div>

        <div className="space-y-2">
          <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-2">Official Message</Label>
          <Textarea 
            required 
            placeholder="Details of the directive..." 
            className="w-full p-6 rounded-2xl bg-slate-50 dark:bg-muted border-none h-48 text-sm text-foreground outline-none focus:ring-2 focus:ring-blue-900 transition-all resize-none shadow-inner no-scrollbar" 
            value={formData.content} 
            onChange={e => setFormData({...formData, content: e.target.value})} 
          />
        </div>

        <div className="space-y-2">
          <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-2">Multimedia Attachments</Label>
          <div className="p-6 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[2rem] bg-slate-50/50 dark:bg-muted/30 flex flex-col items-center justify-center gap-4">
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
                  <div key={idx} className="flex items-center justify-between p-3 bg-white dark:bg-card rounded-xl border border-slate-100 shadow-sm animate-in slide-in-from-top-2">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <Paperclip size={14} className="text-blue-900" />
                      <span className="text-xs font-bold truncate">{file.name}</span>
                    </div>
                    <button type="button" onClick={() => removeFile(idx)} className="p-1 hover:bg-red-50 rounded-lg text-red-600 transition-colors">
                      <X size={14} />
                    </button>
                  </div>
                ))}
                <button 
                  type="button" 
                  onClick={() => fileInputRef.current?.click()}
                  className="text-[10px] font-black text-blue-900 uppercase mt-2 hover:underline w-fit mx-auto"
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
                  <Upload className="text-blue-900" size={24} />
                </div>
                <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Attach Official Memo</span>
              </button>
            )}
          </div>
        </div>

        <Button 
          type="submit" 
          disabled={loading || !isTokenReady} 
          className="w-full py-8 bg-blue-900 text-white rounded-[2rem] font-black text-lg flex items-center justify-center gap-3 shadow-xl hover:bg-blue-800 hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-50"
        >
          {loading ? <Loader2 className="animate-spin" /> : <><Send size={20} /> Safe-Broadcast to Yard</>}
        </Button>
      </form>
    </div>
  );
}