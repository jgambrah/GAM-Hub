
'use client';

import React, { useState } from 'react';
import { ShieldCheck, UserPlus, Search, Landmark, Users, Zap, Key, Loader2 } from 'lucide-react';
import { collection, query, where, getDocs, doc, serverTimestamp } from 'firebase/firestore';
import { useFirebase, updateDocumentNonBlocking } from '@/firebase';
import type { User } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

export default function HandoverManager() {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [foundUser, setFoundUser] = useState<User | null>(null);
  const [searching, setSearching] = useState(false);
  const [installing, setInstalling] = useState(false);

  const handleSearch = async () => {
    if (!firestore || !email) return;
    setSearching(true);
    setFoundUser(null);
    const q = query(collection(firestore, 'users'), where('email', '==', email.toLowerCase()));
    const snap = await getDocs(q);
    if (!snap.empty) {
      setFoundUser({ id: snap.docs[0].id, ...snap.docs[0].data() } as User);
    } else {
      toast({
        variant: "destructive",
        title: "User not found",
        description: "Ensure they have signed up first.",
      });
    }
    setSearching(false);
  };

  const handleInstall = async (role: 'src' | 'management') => {
    if (!foundUser) return;
    setInstalling(true);

    try {
        const userDocRef = doc(firestore, 'users', foundUser.id);
        updateDocumentNonBlocking(userDocRef, {
            role: role,
            isAuthority: true,
            installedAt: serverTimestamp(),
            installedBy: 'National Liaison'
        });

        toast({
            title: "Installation Signal Sent!",
            description: `${foundUser.name} is being installed as ${role.toUpperCase()}. The system is updating their permissions.`,
        });

      setFoundUser(null);
      setEmail('');
    } catch (error: any) {
        console.error('Handover failed:', error);
        toast({
            variant: 'destructive',
            title: 'Handover Failed',
            description: error.message || 'An unexpected error occurred.',
        });
    } finally {
        setInstalling(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto bg-card rounded-[3rem] shadow-2xl border">
      <div className="flex items-center gap-4 mb-10">
        <div className="p-4 bg-primary text-primary-foreground rounded-3xl shadow-lg shadow-primary/20">
          <Key size={32} />
        </div>
        <div>
          <h2 className="text-3xl font-black text-foreground tracking-tight">Handshake & Handover</h2>
          <p className="text-sm text-muted-foreground font-medium italic">Install official campus leadership and management</p>
        </div>
      </div>

      {/* SEARCH SECTION */}
      <div className="relative mb-10">
        <input 
          placeholder="Enter leader's university email..." 
          className="w-full p-6 rounded-[2rem] bg-muted border-none outline-none font-bold text-lg pr-32"
          value={email} onChange={(e) => setEmail(e.target.value)}
        />
        <button 
          onClick={handleSearch}
          disabled={searching}
          className="absolute right-3 top-3 bottom-3 px-8 bg-foreground text-background rounded-2xl font-black text-xs flex items-center gap-2 hover:bg-primary transition-all"
        >
          {searching ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />}
          Find User
        </button>
      </div>

      {/* INSTALLATION PREVIEW */}
      {foundUser && (
        <div className="animate-in fade-in zoom-in-95 duration-300">
          <div className="p-8 bg-muted rounded-[2.5rem] border mb-8">
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 rounded-full bg-background border-4 border-background shadow-xl overflow-hidden">
                <img src={foundUser.avatarUrl} className="w-full h-full object-cover" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-foreground">{foundUser.name}</h3>
                <p className="text-sm text-primary font-bold uppercase tracking-widest">{foundUser.campusId} • {foundUser.role}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             {/* SRC BUTTON */}
             <button 
               onClick={() => handleInstall('src')}
               disabled={installing}
               className="group p-8 bg-card border-2 border-border rounded-[2.5rem] hover:border-orange-500 transition-all text-left relative overflow-hidden"
             >
                <div className="absolute -right-4 -bottom-4 text-orange-500/10 opacity-0 group-hover:opacity-100 transition-opacity"><Users size={100}/></div>
                <div className="p-3 bg-orange-100 text-orange-600 rounded-xl w-fit mb-4"><Users size={24}/></div>
                <h4 className="font-black text-foreground text-lg">Install SRC Leadership</h4>
                <p className="text-xs text-muted-foreground mt-2">Grants access to Student News, Radio, and Candidate Vetting.</p>
             </button>

             {/* MANAGEMENT BUTTON */}
             <button 
               onClick={() => handleInstall('management')}
               disabled={installing}
               className="group p-8 bg-card border-2 border-border rounded-[2.5rem] hover:border-blue-600 transition-all text-left relative overflow-hidden"
             >
                <div className="absolute -right-4 -bottom-4 text-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity"><Landmark size={100}/></div>
                <div className="p-3 bg-blue-100 text-blue-600 rounded-xl w-fit mb-4"><Landmark size={24}/></div>
                <h4 className="font-black text-foreground text-lg">Install Registry (URO)</h4>
                <p className="text-xs text-muted-foreground mt-2">Grants access to Official Notices, PDFs, and Staff Broadcasts.</p>
             </button>
          </div>
        </div>
      )}
    </div>
  );
}
