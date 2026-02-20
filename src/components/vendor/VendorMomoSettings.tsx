'use client';

import React, { useState } from 'react';
import { doc } from 'firebase/firestore';
import { useFirebase, updateDocumentNonBlocking } from '@/firebase';
import { ShieldCheck, Landmark, Loader2, Phone, User as UserIcon } from 'lucide-react';
import type { User } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

export default function VendorMomoSettings({ vendorData }: { vendorData: User }) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    momoNumber: vendorData?.momoNumber || '',
    momoName: vendorData?.momoName || '',
    momoBankCode: vendorData?.momoBankCode || 'MTN'
  });

  const handleUpdateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore) return;
    setLoading(true);
    
    try {
      const userRef = doc(firestore, 'users', vendorData.id);
      updateDocumentNonBlocking(userRef, {
        ...formData,
        payoutAccountSetup: true, // Flag to unlock the withdrawal button
        updatedAt: new Date().toISOString()
      });
      
      toast({
        title: "Payout Account Updated",
        description: "Your MoMo details have been saved successfully.",
      });
    } catch (err) {
      console.error(err);
      toast({
        variant: 'destructive',
        title: "Liaison Error",
        description: "Could not save account details. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card rounded-[2.5rem] p-8 border border-border shadow-xl max-w-xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <div className="p-4 bg-primary text-primary-foreground rounded-3xl shadow-lg shadow-primary/20">
          <Landmark size={24} />
        </div>
        <div>
          <h3 className="text-xl font-black text-foreground">Payout Account</h3>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">Where you receive your GHS</p>
        </div>
      </div>

      <form onSubmit={handleUpdateAccount} className="space-y-6">
        {/* ACCOUNT NAME */}
        <div className="space-y-2">
          <label className="text-[10px] font-black text-muted-foreground uppercase px-2 flex items-center gap-1">
            <UserIcon size={10} /> Account Holder Name (As seen on MoMo)
          </label>
          <input 
            required
            className="w-full p-4 rounded-2xl bg-muted border-2 border-transparent focus:border-primary focus:bg-background outline-none font-bold text-sm transition-all"
            value={formData.momoName}
            onChange={(e) => setFormData({...formData, momoName: e.target.value})}
            placeholder="e.g. MAYGAM Ventures"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* MOMO NUMBER */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-muted-foreground uppercase px-2 flex items-center gap-1">
              <Phone size={10} /> MoMo Number
            </label>
            <input 
              required
              type="tel"
              className="w-full p-4 rounded-2xl bg-muted border-2 border-transparent focus:border-primary focus:bg-background outline-none font-bold text-sm transition-all"
              value={formData.momoNumber}
              onChange={(e) => setFormData({...formData, momoNumber: e.target.value})}
              placeholder="055XXXXXXX"
            />
          </div>

          {/* NETWORK */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-muted-foreground uppercase px-2">Network</label>
            <select 
              className="w-full p-4 rounded-2xl bg-muted border-2 border-transparent focus:border-primary focus:bg-background outline-none font-bold text-sm transition-all"
              value={formData.momoBankCode}
              onChange={(e) => setFormData({...formData, momoBankCode: e.target.value as any})}
            >
              <option value="MTN">MTN Mobile Money</option>
              <option value="VOD">Telecel Cash</option>
              <option value="ATL">AT Money</option>
            </select>
          </div>
        </div>

        <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 flex items-start gap-3">
           <ShieldCheck className="text-primary mt-1" size={18} />
           <p className="text-[10px] text-primary/80 leading-relaxed font-medium italic">
             Verification: Your MoMo payouts are released by the Liaison within 24 hours of a Withdrawal Request. Ensure the number is correct.
           </p>
        </div>

        <button 
          disabled={loading}
          className="w-full py-4 bg-foreground text-background rounded-2xl font-black shadow-xl hover:bg-primary hover:text-white transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? <Loader2 className="animate-spin" /> : "Save Payout Account"}
        </button>
      </form>
    </div>
  );
}
