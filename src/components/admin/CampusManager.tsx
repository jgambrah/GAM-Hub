'use client';

import React, { useState, useEffect } from 'react';
import { doc, setDoc, updateDoc, serverTimestamp, collection, addDoc } from 'firebase/firestore';
import { useFirebase, addDocumentNonBlocking } from '@/firebase';
import { Landmark, X, Save, Hash, Loader2, Globe, Palette, MapPin, Radio } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CampusManagerProps {
  selectedCampus?: any;
  onCancel: () => void;
}

export default function CampusManager({ selectedCampus, onCancel }: CampusManagerProps) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [customId, setCustomId] = useState(''); // FOR NEW CAMPUSES
  const [formData, setFormData] = useState({
    name: '',
    acronym: '',
    studentDomain: '',
    staffDomain: '',
    primaryColor: '#002147',
    secondaryColor: '#C8A870',
    location: '',
    category: 'Public' as 'Public' | 'Technical' | 'Private',
    radioName: '',
    radioStreamUrl: '',
    radioWebsite: '',
  });

  // Load existing data when editing
  useEffect(() => {
    if (selectedCampus) {
      setCustomId(selectedCampus.id); // Show existing ID
      setFormData({
        name: selectedCampus.name || '',
        acronym: selectedCampus.acronym || '',
        studentDomain: selectedCampus.studentDomain || '',
        staffDomain: selectedCampus.staffDomain || '',
        primaryColor: selectedCampus.primaryColor || '#002147',
        secondaryColor: selectedCampus.secondaryColor || '#C8A870',
        location: selectedCampus.location || '',
        category: selectedCampus.category || 'Public',
        radioName: selectedCampus.radioName || '',
        radioStreamUrl: selectedCampus.radioStreamUrl || '',
        radioWebsite: selectedCampus.radioWebsite || '',
      });
    }
  }, [selectedCampus]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore) return;
    if (!customId) {
        toast({ variant: 'destructive', title: 'Missing ID', description: 'Please set a Liaison Technical ID first.' });
        return;
    }
    setLoading(true);

    try {
      // Sanitize the ID (lowercase, no spaces, hyphens)
      const sanitizedId = customId.toLowerCase().trim().replace(/\s+/g, '-');

      if (selectedCampus?.id) {
        // UPDATE MODE: Technical ID is fixed
        const campusRef = doc(firestore, 'campuses', selectedCampus.id);
        await updateDoc(campusRef, {
          ...formData,
          updatedAt: serverTimestamp(),
        });
        toast({ title: "Fortress Updated", description: `${formData.acronym} configuration has been pushed to the network.` });
      } else {
        // CREATE MODE: Use setDoc with the custom sanitized ID
        const newCampusRef = doc(firestore, 'campuses', sanitizedId);
        await setDoc(newCampusRef, {
          ...formData,
          id: sanitizedId, // Store the ID inside the document too
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        // STRATEGIC MOVE: Automatically create the Main Lounge Group
        const groupsRef = collection(firestore, 'groups');
        await addDoc(groupsRef, {
            name: `${formData.acronym} Campus Lounge`,
            description: `The official "Main Room" for all students and staff at ${formData.acronym}. Welcome to the Yard!`,
            campusId: sanitizedId,
            createdBy: 'National Liaison',
            members: [], // Public groups allow anyone from the campus
            admins: [],
            type: 'social',
            isPrivate: false,
            isMainRoom: true, // Special flag for the main lounge
            createdAt: new Date().toISOString(),
        });

        toast({ title: "Gate Opened!", description: `${formData.name} is now active with its own Campus Lounge.` });
      }
      
      onCancel();
    } catch (err: any) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Liaison Error', description: err.message || "Failed to save campus. Check permissions or ID availability." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 bg-card rounded-[3rem] shadow-2xl border border-border max-w-3xl mx-auto animate-in zoom-in-95 duration-300">
      <div className="flex justify-between items-center mb-10">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-slate-900 text-white rounded-3xl shadow-xl">
            <Landmark size={28} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-foreground tracking-tight">
              {selectedCampus ? "Refine Campus" : "Architect New Campus"}
            </h2>
            <p className="text-sm text-muted-foreground font-medium">Liaison National Infrastructure</p>
          </div>
        </div>
        <button onClick={onCancel} className="p-2 hover:bg-muted rounded-full transition-colors">
          <X className="text-muted-foreground" />
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        
        {/* SECTION 1: TECHNICAL ID (THE LOCK) */}
        <div className="p-6 bg-slate-900 text-white rounded-[2.5rem] relative overflow-hidden">
           <div className="relative z-10">
              <div className="flex items-center gap-2 text-blue-400 mb-2">
                 <Hash size={14} />
                 <span className="text-[10px] font-black uppercase tracking-widest">Liaison Technical ID</span>
              </div>
              <input 
                required
                readOnly={!!selectedCampus} // ID is fixed after creation
                value={customId}
                onChange={(e) => setCustomId(e.target.value)}
                placeholder="e.g. knust-main"
                className={`w-full p-4 rounded-2xl bg-white/10 border-2 border-white/10 outline-none font-mono text-sm focus:border-blue-500 transition-all ${selectedCampus ? 'opacity-50 cursor-not-allowed' : ''}`}
              />
              <p className="text-[9px] text-slate-400 mt-2 italic px-2">
                {selectedCampus ? "*This Protected Key governs all database paths for this yard." : "*Lowercase and hyphens only. This defines the Firestore path."}
              </p>
           </div>
        </div>

        {/* SECTION 2: IDENTITY & DOMAINS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-muted-foreground uppercase px-2 tracking-widest">Full Institution Name</label>
            <input required className="w-full p-4 rounded-2xl bg-muted border-none outline-none font-bold text-foreground"
              value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="University of Ghana" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-muted-foreground uppercase px-2 tracking-widest">Acronym</label>
            <input required className="w-full p-4 rounded-2xl bg-muted border-none outline-none font-black text-foreground uppercase"
              value={formData.acronym} onChange={(e) => setFormData({...formData, acronym: e.target.value})} placeholder="UG" />
          </div>
        </div>

        <div className="p-6 bg-blue-50/50 dark:bg-blue-900/10 rounded-[2.5rem] border-2 border-blue-100 dark:border-blue-900/30 space-y-6">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-2">
             <Globe size={18} />
             <span className="text-[10px] font-black uppercase tracking-widest">Gatekeeper Domains</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-blue-400 uppercase px-2 tracking-widest">Student Email Domain</label>
              <input required className="w-full p-4 rounded-2xl bg-white dark:bg-card border-none outline-none font-mono text-xs text-foreground shadow-sm"
                value={formData.studentDomain} onChange={(e) => setFormData({...formData, studentDomain: e.target.value})} placeholder="st.ug.edu.gh" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-blue-400 uppercase px-2 tracking-widest">Staff Email Domain</label>
              <input required className="w-full p-4 rounded-2xl bg-white dark:bg-card border-none outline-none font-mono text-xs text-foreground shadow-sm"
                value={formData.staffDomain} onChange={(e) => setFormData({...formData, staffDomain: e.target.value})} placeholder="ug.edu.gh" />
            </div>
          </div>
        </div>

        {/* SECTION 3: RADIO COMMAND (NEW) */}
        <div className="p-6 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-[2.5rem] border-2 border-emerald-100 dark:border-emerald-900/30 space-y-6">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-2">
             <Radio size={18} />
             <span className="text-[10px] font-black uppercase tracking-widest">Campus Radio Direction</span>
          </div>
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-emerald-600 uppercase px-2 tracking-widest">Radio Station Name</label>
              <input className="w-full p-4 rounded-2xl bg-white dark:bg-card border-none outline-none font-bold text-sm text-foreground shadow-sm"
                value={formData.radioName} onChange={(e) => setFormData({...formData, radioName: e.target.value})} placeholder="e.g. Radio Univers 105.7" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-emerald-600 uppercase px-2 tracking-widest">Streaming URL (.mp3 / /stream)</label>
                <input className="w-full p-4 rounded-2xl bg-white dark:bg-card border-none outline-none font-mono text-xs text-foreground shadow-sm"
                  value={formData.radioStreamUrl} onChange={(e) => setFormData({...formData, radioStreamUrl: e.target.value})} placeholder="https://..." />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-emerald-600 uppercase px-2 tracking-widest">Official Website</label>
                <input className="w-full p-4 rounded-2xl bg-white dark:bg-card border-none outline-none font-mono text-xs text-foreground shadow-sm"
                  value={formData.radioWebsite} onChange={(e) => setFormData({...formData, radioWebsite: e.target.value})} placeholder="https://..." />
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 4: LOGISTICS & CATEGORY */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-muted-foreground uppercase px-2 tracking-widest">Location (City)</label>
            <div className="relative">
                <input className="w-full p-4 pl-12 rounded-2xl bg-muted border-none outline-none font-bold text-foreground"
                value={formData.location} onChange={(e) => setFormData({...formData, location: e.target.value})} placeholder="Accra" />
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50" size={18} />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-muted-foreground uppercase px-2 tracking-widest">Institution Category</label>
            <select 
                className="w-full p-4 rounded-2xl bg-muted border-none outline-none font-bold text-foreground"
                value={formData.category}
                onChange={(e) => setFormData({...formData, category: e.target.value as any})}
            >
                <option value="Public">Public University</option>
                <option value="Technical">Technical University</option>
                <option value="Private">Private University</option>
            </select>
          </div>
        </div>

        {/* SECTION 5: VIBE (COLORS) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-muted-foreground uppercase px-2 tracking-widest">Primary Brand Color</label>
            <div className="flex gap-2">
                <input type="color" className="w-12 h-12 rounded-xl border-none p-1 bg-muted cursor-pointer"
                    value={formData.primaryColor} onChange={(e) => setFormData({...formData, primaryColor: e.target.value})} />
                <input readOnly className="flex-1 p-4 rounded-2xl bg-muted border-none outline-none font-mono text-sm text-foreground"
                    value={formData.primaryColor} />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-muted-foreground uppercase px-2 tracking-widest">Accent / Secondary</label>
            <div className="flex gap-2">
                <input type="color" className="w-12 h-12 rounded-xl border-none p-1 bg-muted cursor-pointer"
                    value={formData.secondaryColor} onChange={(e) => setFormData({...formData, secondaryColor: e.target.value})} />
                <input readOnly className="flex-1 p-4 rounded-2xl bg-muted border-none outline-none font-mono text-sm text-foreground"
                    value={formData.secondaryColor} />
            </div>
          </div>
        </div>

        <button 
          disabled={loading}
          className="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-black text-lg shadow-xl hover:bg-slate-800 active:scale-95 transition-all flex items-center justify-center gap-3"
        >
          {loading ? <Loader2 className="animate-spin" /> : <><Save size={20}/> architect fortress</>}
        </button>
      </form>
    </div>
  );
}
