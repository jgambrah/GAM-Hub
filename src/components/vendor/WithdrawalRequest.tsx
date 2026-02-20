'use client';

import React, { useState } from 'react';
import { collection, addDoc, serverTimestamp, updateDoc, doc, increment } from 'firebase/firestore';
import { useFirebase, addDocumentNonBlocking } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Wallet, ArrowUpRight, CheckCircle2, Loader2 } from 'lucide-react';
import type { User } from '@/lib/types';

export default function WithdrawalRequest({ vendorData }: { vendorData: User }) {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const { firestore, auth } = useFirebase();
  const { toast } = useToast();

  const availableBalance = vendorData.balance_available || 0;

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !auth.currentUser) return;

    const withdrawAmount = parseFloat(amount);

    if (withdrawAmount > availableBalance) {
        toast({
            variant: "destructive",
            title: "Insufficient Balance",
            description: "Amount cannot exceed your available balance."
        });
        return;
    }
    if (withdrawAmount < 10) {
        toast({
            variant: "destructive",
            title: "Amount Too Low",
            description: "Minimum withdrawal is GHS 10.00"
        });
        return;
    }

    setLoading(true);
    try {
      // 1. Create the Request
      await addDoc(collection(firestore, 'payout_requests'), {
        vendorId: auth.currentUser?.uid,
        vendorName: vendorData.name,
        amount: withdrawAmount,
        momoNumber: vendorData.momoNumber,
        momoBankCode: vendorData.momoBankCode,
        status: 'pending',
        createdAt: serverTimestamp()
      });

      // 2. IMPORTANT: Lock the funds
      // We subtract from available and move to a 'withdrawing' field so they can't withdraw twice
      await updateDoc(doc(firestore, 'users', auth.currentUser!.uid), {
        balance_available: increment(-withdrawAmount),
        balance_withdrawing: increment(withdrawAmount)
      });

      toast({
          title: "Request Sent!",
          description: "Your withdrawal request has been sent to the Liaison for processing."
      });
      setAmount('');
    } catch (err: any) {
      console.error(err);
      toast({
          variant: "destructive",
          title: "Request Failed",
          description: err.message || "An error occurred while sending your request."
      })
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-card rounded-[3rem] p-8 border border-border shadow-xl relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
      
      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 bg-primary text-primary-foreground rounded-2xl shadow-lg shadow-primary/20">
            <Wallet size={24} />
          </div>
          <div>
            <h2 className="text-xl font-black text-foreground">Cash Out</h2>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Withdraw to MoMo</p>
          </div>
        </div>

        <div className="bg-muted p-6 rounded-3xl mb-8 border border-border">
           <p className="text-[10px] font-black text-muted-foreground uppercase mb-1">Total Available</p>
           <h3 className="text-3xl font-black text-foreground">GHS {availableBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
        </div>

        <form onSubmit={handleWithdraw} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-muted-foreground uppercase px-2">Amount to Withdraw (GHS)</label>
            <input 
              type="number" required
              value={amount}
              placeholder="e.g. 100"
              className="w-full p-5 rounded-2xl bg-muted border-none outline-none font-black text-2xl text-primary focus:bg-background focus:ring-2 focus:ring-ring transition-all"
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          {/* MoMo Preview */}
          <div className="flex items-center gap-3 p-4 bg-primary/10 rounded-2xl border border-primary/20">
             <div className="p-2 bg-primary text-primary-foreground rounded-lg"><CheckCircle2 size={16}/></div>
             <div>
                <p className="text-[10px] font-bold text-primary/80 uppercase tracking-tight">Destination Wallet</p>
                <p className="text-sm font-black text-foreground">{vendorData.momoNumber} ({vendorData.momoBankCode})</p>
             </div>
          </div>

          <button 
            disabled={loading || !amount}
            className="w-full py-5 bg-foreground text-background rounded-[2rem] font-black text-lg shadow-2xl shadow-muted flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-30"
          >
            {loading ? <Loader2 className="animate-spin" /> : <><ArrowUpRight size={20}/> Request Payout</>}
          </button>
        </form>
      </div>
    </div>
  );
}
