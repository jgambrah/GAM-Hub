'use client';

import React, { useState } from 'react';
import { Landmark, Send, ShieldAlert, Loader2 } from 'lucide-react';
import { collection, serverTimestamp } from 'firebase/firestore';
import { useFirebase, addDocumentNonBlocking } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { useCampusView } from '@/hooks/use-campus-view';
import { useAuth } from '@/hooks/use-auth';
import type { User } from '@/lib/types';

/**
 * RegistryCreator Component
 * 
 * Allows Registry/Management users to publish official directives 
 * directly to the /registry_posts collection path.
 */
export default function RegistryCreator({ userProfile }: { userProfile: User }) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const { viewAsCampus } = useCampusView();
  const { isTokenReady } = useAuth();

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    isUrgent: false,
  });
  const [loading, setLoading] = useState(false);

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !userProfile || !isTokenReady) return;

    if (!formData.title || !formData.content) {
        toast({ variant: 'destructive', title: 'Missing Info', description: 'Headline and content are required.' });
        return;
    }
    
    setLoading(true);
    try {
      const campusId = viewAsCampus?.id || userProfile.campusId || 'all';

      // Saving to the official registry_posts collection
      const postData = {
        title: formData.title,
        content: formData.content,
        isUrgent: formData.isUrgent,
        campusId,
        authorId: userProfile.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await addDocumentNonBlocking(collection(firestore, 'registry_posts'), postData);
      
      toast({ title: "Directive Published!", description: "The notice is now active in the Registry Hub." });
      setFormData({ title: '', content: '', isUrgent: false });
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
          <h2 className="text-2xl font-black text-foreground">Registry Directive Creator</h2>
          <p className="text-sm text-muted-foreground font-medium italic">Official Management Portal for {campusContext}</p>
        </div>
      </div>

      <form onSubmit={handlePublish} className="space-y-6">
        <div className="space-y-2">
          <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-2">Headline</label>
          <input 
            required 
            placeholder="e.g., Mandatory Hall Registration Deadline" 
            className="w-full p-5 rounded-2xl bg-muted border-none font-black text-lg text-foreground outline-none focus:ring-2 focus:ring-primary transition-all" 
            value={formData.title} 
            onChange={e => setFormData({...formData, title: e.target.value})} 
          />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-2">Directive Content</label>
          <textarea 
            required 
            placeholder="Specify instructions clearly..." 
            className="w-full p-6 rounded-2xl bg-muted border-none h-48 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary transition-all resize-none" 
            value={formData.content} 
            onChange={e => setFormData({...formData, content: e.target.value})} 
          />
        </div>

        <div className="flex items-center justify-between p-5 bg-red-50 dark:bg-red-900/20 rounded-2xl border border-red-100 dark:border-red-900/30">
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