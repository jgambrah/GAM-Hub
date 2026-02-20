'use client';

import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { FileText, Play, Save, ShieldCheck, Flag, Users, Loader2 } from 'lucide-react';
import type { User, Manifesto } from '@/lib/types';
import { campuses } from '@/lib/data';

export default function ManifestoEditor({ userProfile }: { userProfile: User }) {
  const { firestore, auth } = useFirebase();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    position: userProfile.candidatePosition || 'SRC Representative',
    hall: '',
    motto: '',
    fullManifesto: '',
    campaignVideoUrl: '',
    endorsements: 0,
  });

  useEffect(() => {
    async function loadManifesto() {
      if (!firestore || !auth.currentUser) return;
      const docSnap = await getDoc(doc(firestore, 'manifestos', auth.currentUser.uid));
      if (docSnap.exists()) {
        const data = docSnap.data() as Manifesto;
        setFormData({
            position: data.position || userProfile.candidatePosition || 'SRC Representative',
            hall: data.hall || '',
            motto: data.motto || '',
            fullManifesto: data.fullManifesto || '',
            campaignVideoUrl: data.campaignVideoUrl || '',
            endorsements: data.endorsements || 0,
        });
      }
    }
    loadManifesto();
  }, [firestore, auth.currentUser, userProfile.candidatePosition]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !auth.currentUser) return;
    setLoading(true);
    try {
      const campusAcronym = campuses.find(c => c.id === userProfile.campusId)?.acronym || userProfile.campusId;

      await setDoc(doc(firestore, 'manifestos', auth.currentUser.uid), {
        ...formData,
        candidateName: userProfile.name,
        candidateImage: userProfile.avatarUrl,
        campusId: userProfile.campusId,
        campusAcronym: campusAcronym,
        status: 'active',
        updatedAt: serverTimestamp(),
      }, { merge: true });

      toast({
        title: "Manifesto Published!",
        description: "Your vision is now live for the campus to see."
      });
    } catch (err) { 
        console.error(err); 
        toast({ variant: "destructive", title: "Error", description: "Failed to publish manifesto." });
    }
    finally { setLoading(false); }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 pb-24 animate-in fade-in">
      <div className="bg-slate-900 rounded-[3rem] p-10 text-white shadow-2xl relative overflow-hidden mb-10">
        <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12">
           <Flag size={120} />
        </div>
        <div className="relative z-10 flex items-center gap-6">
           <div className="p-5 bg-amber-500 rounded-[2rem] shadow-xl shadow-amber-500/20 text-white">
              <ShieldCheck size={32} />
           </div>
           <div>
              <p className="text-xs font-black uppercase tracking-[0.3em] text-amber-500">Official Candidate</p>
              <h1 className="text-3xl font-black mt-1">Campaign Headquarters</h1>
              <p className="text-slate-400 text-sm mt-2">Vetting Status: <span className="text-green-400 font-bold">CLEARED</span></p>
           </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        <div className="lg:col-span-1 space-y-6">
           <div className="bg-card p-6 rounded-[2.5rem] border shadow-sm">
              <h3 className="font-bold text-foreground mb-6 flex items-center gap-2">
                <Users size={18} className="text-primary" /> Identity
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-2">Position</label>
                  <input readOnly value={formData.position} className="w-full p-4 rounded-2xl bg-muted border-none text-muted-foreground font-bold text-sm cursor-not-allowed mt-1" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-2">Your Hall</label>
                  <input required placeholder="e.g. Unity Hall" className="w-full p-4 rounded-2xl bg-muted border-none font-bold text-sm mt-1 focus:ring-2 focus:ring-primary" 
                    value={formData.hall} onChange={(e) => setFormData({...formData, hall: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-2">Campaign Motto</label>
                  <input required placeholder="Short & Catchy" className="w-full p-4 rounded-2xl bg-muted border-none font-bold text-sm mt-1 focus:ring-2 focus:ring-primary" 
                    value={formData.motto} onChange={(e) => setFormData({...formData, motto: e.target.value})} />
                </div>
              </div>
           </div>

           <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-[2.5rem] border border-red-100 dark:border-red-900/40">
              <h3 className="font-bold text-red-800 dark:text-red-300 mb-4 flex items-center gap-2">
                <Play size={18} className="fill-current" /> Campaign Vlog
              </h3>
              <p className="text-xs text-red-600/70 dark:text-red-400/70 mb-4">Paste your YouTube/TikTok link to show your video in the Pulse.</p>
              <input 
                placeholder="Link here..."
                className="w-full p-4 rounded-2xl bg-white dark:bg-card border-none outline-none text-xs font-mono text-red-600 dark:text-red-300 focus:ring-2 focus:ring-red-500"
                value={formData.campaignVideoUrl} onChange={(e) => setFormData({...formData, campaignVideoUrl: e.target.value})}
              />
           </div>
        </div>

        <div className="lg:col-span-2">
           <div className="bg-card p-8 rounded-[3rem] border shadow-sm h-full flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-black text-foreground text-xl flex items-center gap-2">
                  <FileText size={20} className="text-primary" /> My Manifesto
                </h3>
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Rich Text Support</span>
              </div>

              <textarea 
                required
                placeholder="Fellow students, my vision for this university starts with..."
                className="flex-1 w-full p-6 rounded-[2rem] bg-muted border-none outline-none text-foreground leading-relaxed font-medium text-lg min-h-[400px] focus:bg-background focus:ring-2 focus:ring-primary transition-all"
                value={formData.fullManifesto} onChange={(e) => setFormData({...formData, fullManifesto: e.target.value})}
              />

              <button 
                type="submit"
                disabled={loading}
                className="w-full mt-8 py-5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-[2rem] font-black text-lg shadow-2xl shadow-primary/10 flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50"
              >
                {loading ? <Loader2 className="animate-spin" /> : <><Save size={20}/> Publish to Campus</>}
              </button>
           </div>
        </div>

      </form>
    </div>
  );
}
