'use client';

import React, { useState } from 'react';
import { Sparkles, Megaphone, Type, Save, Zap, Wand2, Loader2, Users, Globe } from 'lucide-react';
import { doc, collection, query, where } from 'firebase/firestore';
import { useFirebase, updateDocumentNonBlocking, useCollection, useMemoFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { optimizeAdCreative } from '@/ai/flows/optimize-ad-creative';
import type { Product, Group } from '@/lib/types';

interface AdCreativeManagerProps {
  product: Product;
}

export default function AdCreativeManager({ product }: AdCreativeManagerProps) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  
  // 1. LIAISON TARGET FETCHER: Fetch real groups from the database
  const groupsQuery = useMemoFirebase(() => {
    if (!firestore || !product.campusId) return null;
    return query(collection(firestore, 'groups'), where('campusId', '==', product.campusId));
  }, [firestore, product.campusId]);

  const { data: activeGroups, isLoading: isLoadingGroups } = useCollection<Group>(groupsQuery);

  const [formData, setFormData] = useState({
    adHeadline: product.adHeadline || '',
    adSlogan: product.adSlogan || '',
    targetGroupId: product.targetGroupId || 'all',
  });

  const handleSaveCreative = async () => {
    if (!firestore) return;
    setLoading(true);
    try {
      const productRef = doc(firestore, 'products', product.id);
      
      // Map targeting logic for backwards compatibility and new group targeting
      const targetingUpdate = {
        targetGroupId: formData.targetGroupId,
        targetType: formData.targetGroupId === 'all' ? 'all' : 'group',
        targetValue: formData.targetGroupId,
        isSponsored: true,
        adStatus: 'active',
      };

      updateDocumentNonBlocking(productRef, {
        ...formData,
        ...targetingUpdate,
        hasCustomCreative: true,
        lastCreativeUpdate: new Date().toISOString()
      });

      toast({
        title: "Campaign Deployed! 🚀",
        description: "Your ad creative and targeting have been updated in the Yard.",
      });
    } catch (err) {
      console.error(err);
      toast({
        variant: 'destructive',
        title: "Update Failed",
        description: "Could not save your campaign changes."
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAIVibe = async () => {
    if (!formData.adHeadline) {
        toast({
            variant: 'destructive',
            title: "Need Input",
            description: "Write a basic headline first so the AI has something to 'vibe-check'."
        });
        return;
    }
    
    setAiLoading(true);
    try {
      // Find the target name for better AI context
      const targetName = formData.targetGroupId === 'all' 
        ? "All Students" 
        : activeGroups?.find(g => g.id === formData.targetGroupId)?.name || "Students";

      const result = await optimizeAdCreative({
        productName: product.name,
        targetMajor: targetName,
        rawHeadline: formData.adHeadline,
        rawSlogan: formData.adSlogan || "Best deals on campus."
      });
      
      setFormData(prev => ({
        ...prev,
        adHeadline: result.vibeHeadline,
        adSlogan: result.vibeSlogan
      }));
      
      toast({
        title: "Vibe-Checked! 🔥",
        description: "Liaison AI has optimized your copy for this specific community.",
      });
    } catch (err) {
      console.error(err);
      toast({
        variant: 'destructive',
        title: "AI Error",
        description: "The Creative Lab is currently busy. Try again in a moment."
      });
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-card rounded-[3rem] p-8 border border-slate-100 dark:border-border shadow-xl">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-slate-900 dark:bg-primary text-white rounded-2xl shadow-lg">
            <Megaphone size={20} />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-900 dark:text-foreground">Ad Creative Lab</h3>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Campaign Command Center</p>
          </div>
        </div>
        <button 
          onClick={handleAIVibe}
          disabled={aiLoading}
          className="flex items-center gap-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-4 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-all disabled:opacity-50 shadow-sm"
        >
          {aiLoading ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
          AI Vibe-Check
        </button>
      </div>

      <div className="space-y-6">
        {/* 1. DYNAMIC TARGET SELECTOR */}
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">
            Select Target Community
          </label>
          <div className="relative group">
            <select 
              value={formData.targetGroupId}
              className="w-full p-4 pr-10 rounded-2xl bg-slate-50 dark:bg-muted border border-slate-100 dark:border-border font-bold text-sm outline-none focus:ring-2 focus:ring-primary transition-all appearance-none"
              onChange={(e) => setFormData({...formData, targetGroupId: e.target.value})}
            >
              <option value="all">🌍 Global Campus (Reach Everyone)</option>
              
              {/* DYNAMIC LIST FROM YOUR DATABASE */}
              {isLoadingGroups ? (
                <option disabled>Scanning communities...</option>
              ) : activeGroups?.map((group) => (
                <option key={group.id} value={group.id}>
                  👥 {group.name} ({group.type})
                </option>
              ))}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
               {formData.targetGroupId === 'all' ? <Globe size={16} /> : <Users size={16} />}
            </div>
          </div>
          <p className="text-[9px] text-muted-foreground px-2 italic">
            *Liaison Hint: Targeting a specific group increases engagement by up to 40%.
          </p>
        </div>

        {/* 2. CREATIVE FIELDS */}
        <div className="space-y-2">
          <div className="flex justify-between items-center px-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ad Headline (The Hook)</label>
            <span className="text-[8px] font-bold text-slate-400">Catchy & Short</span>
          </div>
          <input 
            value={formData.adHeadline}
            onChange={(e) => setFormData({...formData, adHeadline: e.target.value})}
            placeholder="e.g. Level 400 Survival Kit"
            className="w-full p-4 rounded-2xl bg-white dark:bg-slate-950 border border-slate-100 dark:border-border outline-none font-bold text-slate-900 dark:text-foreground focus:ring-2 focus:ring-blue-500 shadow-sm"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase px-2">Ad Slogan (The Vibe)</label>
          <textarea 
            value={formData.adSlogan}
            onChange={(e) => setFormData({...formData, adSlogan: e.target.value})}
            placeholder="e.g. Don't let a broken screen slow down your GPA. 🔥"
            className="w-full p-4 rounded-2xl bg-white dark:bg-slate-950 border border-slate-100 dark:border-border outline-none h-24 text-sm font-medium shadow-sm resize-none"
          />
        </div>

        <button 
          onClick={handleSaveCreative}
          disabled={loading || !formData.adHeadline}
          className="w-full py-5 bg-slate-900 dark:bg-primary text-white rounded-2xl font-black shadow-xl shadow-slate-200 dark:shadow-none hover:bg-slate-800 dark:hover:bg-primary/90 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
        >
          {loading ? <Loader2 className="animate-spin" /> : <><Zap size={18} fill="currentColor"/> Launch Campaign</>}
        </button>
      </div>
    </div>
  );
}
