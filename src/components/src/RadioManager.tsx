'use client';

import React, { useState, useEffect } from 'react';
import { Radio, Link2, Wifi, Loader2, Save, AlertTriangle } from 'lucide-react';
import { doc } from 'firebase/firestore';
import { useFirebase, updateDocumentNonBlocking, useDoc, useMemoFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import type { Campus, User } from '@/lib/types';

/**
 * RadioManager Component
 * 
 * Part of the SRC Portal. Allows student leadership to manage 
 * their campus radio station identity and digital stream link.
 * Includes security verification for HTTPS compliance.
 */
export default function RadioManager({ userProfile }: { userProfile: User }) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState({
    radioName: '',
    radioStreamUrl: ''
  });
  const [httpWarning, setHttpWarning] = useState(false);

  // 1. Liaison Handshake: Fetch current settings
  const campusRef = useMemoFirebase(() => {
    if (!firestore || !userProfile?.campusId) return null;
    return doc(firestore, 'campuses', userProfile.campusId);
  }, [firestore, userProfile?.campusId]);

  const { data: campusData, isLoading: isFetching } = useDoc<Campus>(campusRef);

  useEffect(() => {
    if (campusData) {
      setConfig({
        radioName: campusData.radioName || '',
        radioStreamUrl: campusData.radioStreamUrl || ''
      });
      // Initial check for existing URL
      if (campusData.radioStreamUrl?.startsWith('http://')) {
        setHttpWarning(true);
      }
    }
  }, [campusData]);

  const handleUrlChange = (val: string) => {
    setConfig({ ...config, radioStreamUrl: val });
    // LIAISON SECURITY CHECK: Warn about insecure HTTP streams
    if (val.toLowerCase().startsWith('http://') && !val.toLowerCase().startsWith('https://')) {
      setHttpWarning(true);
    } else {
      setHttpWarning(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !userProfile?.campusId) return;
    
    setLoading(true);
    try {
      const cRef = doc(firestore, 'campuses', userProfile.campusId);
      updateDocumentNonBlocking(cRef, {
        radioName: config.radioName,
        radioStreamUrl: config.radioStreamUrl,
        radioLastUpdated: new Date().toISOString(),
        radioUpdatedBy: userProfile.name || userProfile.email || 'Anonymous SRC Member'
      });
      
      toast({
        title: "Campus Frequency Updated!",
        description: "The Yard is now tuned into your new signal. 🔥",
      });
    } catch (err) {
      console.error(err);
      toast({
        variant: 'destructive',
        title: "Update Failed",
        description: "Could not push the signal to the network.",
      });
    } finally {
      setLoading(false);
    }
  };

  if (isFetching) {
    return (
      <div className="flex flex-col items-center justify-center p-20 bg-card rounded-[3rem] border border-dashed">
        <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
        <p className="text-sm font-black text-muted-foreground uppercase tracking-widest">Tuning Signal...</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-[3rem] p-10 shadow-xl border border-border max-w-2xl mx-auto animate-in fade-in duration-500">
      <div className="flex items-center gap-4 mb-8">
        <div className="p-4 bg-blue-600 text-white rounded-3xl shadow-lg shadow-blue-200 dark:shadow-none">
          <Radio size={28} />
        </div>
        <div>
          <h2 className="text-2xl font-black text-foreground tracking-tight">Radio Station Manager</h2>
          <p className="text-sm text-muted-foreground font-medium italic">Broadcast governance for {userProfile.campusAcronym || 'your campus'}</p>
        </div>
      </div>

      <form onSubmit={handleUpdate} className="space-y-6">
        <div className="space-y-2">
          <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-2">Station Name</label>
          <input 
            required
            value={config.radioName}
            placeholder="e.g. Focus FM 94.3"
            className="w-full p-5 rounded-2xl bg-muted border-2 border-transparent outline-none font-bold text-lg text-foreground focus:border-blue-500 focus:bg-background transition-all shadow-inner"
            onChange={(e) => setConfig({...config, radioName: e.target.value})}
          />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-2">Live Stream URL (.mp3 / /stream)</label>
          <div className="relative group">
            <input 
              required
              value={config.radioStreamUrl}
              placeholder="https://stream.zeno.fm/..."
              className="w-full p-5 rounded-2xl bg-muted border-2 border-transparent outline-none font-mono text-xs text-blue-600 dark:text-blue-400 pr-12 shadow-inner focus:border-blue-500 focus:bg-background transition-all"
              onChange={(e) => handleUrlChange(e.target.value)}
            />
            <Link2 className="absolute right-5 top-5 text-muted-foreground/50 group-focus-within:text-blue-500 transition-colors" size={18} />
          </div>
          
          {httpWarning && (
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800 mt-2 flex items-start gap-3">
              <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={16} />
              <p className="text-[10px] text-amber-700 dark:text-amber-300 font-bold leading-relaxed">
                ⚠️ Warning: Some browsers block insecure (HTTP) radio streams. Try to find an HTTPS version of your stream.
              </p>
            </div>
          )}

          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800 mt-2">
            <p className="text-[10px] text-blue-600 dark:text-blue-400 leading-relaxed font-bold">
              *Liaison Handshake: Ensure you use the direct streaming link from your provider. Students will join the LIVE broadcast instantly upon hitting play.
            </p>
          </div>
        </div>

        <button 
          disabled={loading}
          className="w-full py-5 bg-slate-900 dark:bg-blue-600 text-white rounded-[2rem] font-black text-lg shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3"
        >
          {loading ? <Loader2 className="animate-spin" /> : <><Wifi size={20} /> Update Campus Waves</>}
        </button>
      </form>
    </div>
  );
}
