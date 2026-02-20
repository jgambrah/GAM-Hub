'use client';

import React, { useState } from 'react';
import { collection, query, where, doc, serverTimestamp } from 'firebase/firestore';
import { useFirebase, useCollection, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { ShieldCheck, XCircle, FileCheck, Loader2 } from 'lucide-react';
import type { User } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function IDApprovalQueue() {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [selectedVendor, setSelectedVendor] = useState<User | null>(null);
  const [loadingDecision, setLoadingDecision] = useState(false);

  // 1. Listen for users with 'pending' verification status
  const pendingQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'users'), where('idVerificationStatus', '==', 'pending'));
  }, [firestore]);

  const { data: pendingVendors, isLoading } = useCollection<User>(pendingQuery);

  const handleVerification = async (decision: 'approved' | 'unverified') => {
    if (!selectedVendor || !firestore) return;
    setLoadingDecision(true);
    try {
      const userRef = doc(firestore, 'users', selectedVendor.id);
      updateDocumentNonBlocking(userRef, {
        idVerificationStatus: decision,
        isFullyVerified: decision === 'approved', // Unlocks high-value listings
        verifiedAt: serverTimestamp(),
        verifiedBy: 'National Liaison'
      });
      
      toast({
        title: decision === 'approved' ? "Vendor Verified" : "Verification Rejected",
        description: `${selectedVendor.name} status updated.`,
        variant: decision === 'approved' ? 'default' : 'destructive'
      });
      setSelectedVendor(null);
    } catch (err) { 
        console.error(err); 
        toast({ variant: 'destructive', title: 'Update failed' });
    } finally { 
        setLoadingDecision(false); 
    }
  };

  return (
    <div className="flex h-[calc(100vh-theme(spacing.32))] bg-slate-50 dark:bg-background rounded-[3rem] overflow-hidden border border-slate-100 dark:border-border shadow-2xl">
      
      {/* SIDEBAR: PENDING LIST */}
      <div className="w-80 bg-white dark:bg-card border-r border-slate-100 dark:border-border flex flex-col">
        <div className="p-6 border-b bg-slate-50/50 dark:bg-muted/20">
          <h2 className="text-xl font-black flex items-center gap-2">
            <ShieldCheck className="text-blue-600" /> Vetting Queue
          </h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">
            {pendingVendors?.length || 0} Documents Pending
          </p>
        </div>
        <div className="flex-1 overflow-y-auto no-scrollbar">
          {isLoading ? (
              <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-blue-600"/></div>
          ) : pendingVendors && pendingVendors.length > 0 ? (
            pendingVendors.map(vendor => (
                <div 
                  key={vendor.id} 
                  onClick={() => setSelectedVendor(vendor)}
                  className={cn(
                      'p-5 cursor-pointer border-b border-slate-50 dark:border-border transition-all', 
                      selectedVendor?.id === vendor.id ? 'bg-blue-50 dark:bg-blue-950/20 border-l-4 border-blue-600' : 'hover:bg-slate-50 dark:hover:bg-muted/50'
                  )}
                >
                  <p className="font-bold text-slate-800 dark:text-foreground text-sm truncate">{vendor.businessName || vendor.name}</p>
                  <p className="text-[10px] font-black text-blue-500 uppercase mt-1">{vendor.campusAcronym || 'National'}</p>
                </div>
              ))
          ) : (
            <div className="p-10 text-center text-slate-300 text-xs font-bold uppercase italic">Queue is clear!</div>
          )}
        </div>
      </div>

      {/* MAIN VIEW: DOCUMENT INSPECTION */}
      <div className="flex-1 bg-white dark:bg-card p-10 overflow-y-auto no-scrollbar">
        {selectedVendor ? (
          <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start mb-10 gap-4">
              <div>
                <h1 className="text-3xl font-black text-slate-900 dark:text-foreground">{selectedVendor.businessName || selectedVendor.name}</h1>
                <p className="text-slate-500 font-medium">ID Audit for {selectedVendor.campusAcronym} Vendor</p>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => handleVerification('unverified')}
                  disabled={loadingDecision}
                  className="p-4 bg-red-50 text-red-600 rounded-2xl hover:bg-red-100 transition-all active:scale-95 disabled:opacity-50"
                >
                  <XCircle size={24} />
                </button>
                <button 
                  onClick={() => handleVerification('approved')}
                  disabled={loadingDecision}
                  className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-black flex items-center gap-2 shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50"
                >
                  {loadingDecision ? <Loader2 className="animate-spin" /> : <FileCheck size={20} />}
                  Verify Identity
                </button>
              </div>
            </div>

            {/* THE GHANA CARD VIEW */}
            <div className="space-y-6">
               <div className="bg-slate-900 p-2 rounded-[2.5rem] shadow-2xl relative group">
                  <div className="bg-white dark:bg-slate-800 rounded-[2.2rem] overflow-hidden border-4 border-slate-900 relative aspect-[1.6/1]">
                     {selectedVendor.ghanaCardUrl ? (
                         <img 
                            src={selectedVendor.ghanaCardUrl} 
                            className="w-full h-full object-contain bg-slate-50 dark:bg-slate-900" 
                            alt="Ghana Card" 
                        />
                     ) : (
                         <div className="w-full h-full flex items-center justify-center text-slate-400">No Image Provided</div>
                     )}
                     <div className="absolute top-4 right-4 bg-blue-600 text-white px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest shadow-lg">
                        Confidential Audit
                     </div>
                  </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-6 bg-slate-50 dark:bg-muted/30 rounded-3xl border border-slate-100 dark:border-border">
                     <p className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Business Detail</p>
                     <p className="text-sm font-bold text-slate-800 dark:text-foreground">Email: {selectedVendor.email}</p>
                     <p className="text-sm font-bold text-slate-800 dark:text-foreground mt-1">Phone: {selectedVendor.contactPhone || 'N/A'}</p>
                  </div>
                  <div className="p-6 bg-slate-50 dark:bg-muted/30 rounded-3xl border border-slate-100 dark:border-border">
                     <p className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Liaison Check</p>
                     <p className="text-[10px] text-slate-500 leading-relaxed italic">
                       Confirm the name on the ID matches the Business Name: <b>{selectedVendor.businessName || selectedVendor.name}</b>
                     </p>
                  </div>
               </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-200 dark:text-slate-800">
            <ShieldCheck size={100} className="mb-4 opacity-10" />
            <p className="font-black uppercase tracking-[0.4em] text-xs">Awaiting Selection</p>
          </div>
        )}
      </div>
    </div>
  );
}
