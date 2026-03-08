'use client';

import React from 'react';
import { useDoc, useFirebase, useMemoFirebase } from '@/firebase';
import { useAuth } from '@/hooks/use-auth';
import { doc } from 'firebase/firestore';
import CommunityPaymentButton from '@/components/market/StudentPaymentButton';
import { Clock, ShieldCheck, CreditCard, PackageCheck, QrCode, Lock, ShieldAlert, CheckCircle2, ChevronRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { ScanReceiptDialog } from '@/components/orders/ScanReceiptDialog';
import { ManualReleaseButton } from '@/components/orders/ManualReleaseButton';
import type { Order } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { useParams } from 'next/navigation';
import { cn } from '@/lib/utils';

/**
 * OrderDetailsPage Component
 * 
 * Elite tracking interface for students. 
 * Features the "Liaison Secure Vault" for escrowed funds.
 */
export default function OrderDetailsPage() {
  const { firestore } = useFirebase();
  const { user: userProfile, isUserLoading: isAuthLoading } = useAuth();
  const params = useParams();
  const orderId = params.id as string;

  const orderDocRef = useMemoFirebase(() => {
    if (!firestore || !orderId) return null;
    return doc(firestore, 'orders', orderId);
  }, [firestore, orderId]);

  const { data: order, isLoading: isOrderLoading } = useDoc<Order>(orderDocRef);
  
  const isLoading = isAuthLoading || isOrderLoading;

  if (isLoading) {
    return (
        <div className="p-6 max-w-2xl mx-auto space-y-6">
            <Skeleton className="h-48 w-full rounded-[2.5rem]" />
            <Skeleton className="h-24 w-full rounded-[2.5rem]" />
        </div>
    );
  }

  if (!order || !userProfile) {
    return <p className="p-10 text-center">Order not found or you do not have permission to view it.</p>;
  }
  
  // Security check: ensure the current user is the buyer of this order.
  if (order.buyerId !== userProfile.id) {
     return <p className="p-10 text-center font-black text-red-500 uppercase tracking-widest">Access Denied: National Security Boundary</p>;
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-8 pb-32">
      
      {/* 1. STATE: WAITING FOR VENDOR */}
      {order.status === 'awaiting_confirmation' && (
        <div className="bg-amber-50 dark:bg-amber-950/20 p-10 rounded-[3rem] border-2 border-dashed border-amber-200 dark:border-amber-800 text-center animate-in fade-in duration-500">
          <div className="w-20 h-20 bg-amber-100 dark:bg-amber-900/40 rounded-full flex items-center justify-center mx-auto mb-6">
            <Clock className="text-amber-600 animate-pulse" size={40} />
          </div>
          <h2 className="text-2xl font-black text-amber-900 dark:text-amber-200 tracking-tight">Vetting Stock Availability</h2>
          <p className="text-sm text-amber-700 dark:text-amber-400 mt-3 font-medium leading-relaxed">
            The vendor is currently auditing their inventory. <br/>You will receive a notification the moment they confirm the <b>{order.productName}</b>.
          </p>
        </div>
      )}

      {/* 2. STATE: STOCK CONFIRMED -> SHOW PAY BUTTON */}
      {order.status === 'confirmed' && (
        <div className="bg-blue-600 text-white p-10 rounded-[3rem] shadow-2xl shadow-blue-200 dark:shadow-none animate-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-md border border-white/30">
              <ShieldCheck size={32} />
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tight">Security Clearance Granted</h2>
              <p className="text-xs text-blue-100 font-bold uppercase tracking-widest mt-1">Liaison Handshake Ready</p>
            </div>
          </div>
          
          <p className="text-lg font-medium text-blue-50 leading-relaxed mb-10">
            Stock is confirmed for <b>{order.productName}</b>. Proceed to payment to secure these funds in the National Escrow.
          </p>

          <CommunityPaymentButton 
            order={order} 
            userProfile={userProfile} 
          />
          
          <div className="mt-8 pt-8 border-t border-white/10 flex items-center gap-2 justify-center opacity-60">
             <Lock size={12} />
             <p className="text-[10px] font-black uppercase tracking-[0.2em]">National Hub Encryption Active</p>
          </div>
        </div>
      )}

      {/* 3. STATE: PAID -> THE ELITE ESCROW VAULT */}
      {order.status === 'paid' && (
        <div className="space-y-8 animate-in zoom-in duration-500">
          {/* THE VAULT CARD */}
          <div className="bg-slate-950 rounded-[3.5rem] p-10 text-white shadow-[0_20px_100px_rgba(16,185,129,0.15)] relative overflow-hidden border-t-8 border-emerald-500">
            {/* Visual Watermark */}
            <div className="absolute right-0 top-0 p-8 opacity-5 -mr-10 -mt-10 pointer-events-none rotate-12">
              <Lock size={250} />
            </div>

            <div className="relative z-10">
              <div className="flex justify-between items-start mb-10">
                <div className="flex items-center gap-4">
                  <div className="p-4 bg-emerald-500 rounded-3xl shadow-[0_0_30px_rgba(16,185,129,0.4)] text-slate-950 animate-pulse">
                    <Lock size={32} />
                  </div>
                  <div>
                    <h2 className="text-3xl font-black tracking-tighter uppercase italic">Escrow Vault</h2>
                    <div className="flex items-center gap-2 mt-1">
                       <div className="w-2 h-2 rounded-full bg-emerald-500" />
                       <p className="text-emerald-400 text-[10px] font-black uppercase tracking-[0.2em]">Funds Physically Secured</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white/5 border border-white/10 p-4 rounded-3xl text-center">
                   <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Vault Value</p>
                   <p className="text-xl font-black text-white">GHS {order.amount.toFixed(2)}</p>
                </div>
              </div>
              
              <div className="bg-white/5 rounded-[2rem] p-6 mb-10 border border-white/5">
                <div className="flex items-start gap-4">
                   <div className="p-3 bg-white/10 rounded-xl text-blue-400"><MapPin size={20}/></div>
                   <div>
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Meet Here</p>
                      <p className="text-sm font-bold text-white">
                        {order.deliveryLocation.pointName || 'Designated Office'}
                      </p>
                      {order.deliveryLocation.department && (
                        <p className="text-xs text-slate-400 mt-1">{order.deliveryLocation.department} • Room {order.deliveryLocation.roomNumber}</p>
                      )}
                   </div>
                </div>
              </div>

              <div className="space-y-4">
                <ScanReceiptDialog order={order}>
                    <Button className="w-full py-8 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-[2rem] font-black text-lg flex items-center justify-center gap-3 shadow-2xl active:scale-95 transition-all">
                        <QrCode size={24} /> Scan Handshake QR
                    </Button>
                </ScanReceiptDialog>
                <p className="text-[10px] text-slate-500 text-center font-bold italic">
                  "Only scan the vendor's code once you have physically inspected the item."
                </p>
              </div>
            </div>
          </div>
          
          {/* THE SECURITY EXPLAINER */}
          <div className="p-8 bg-emerald-50 dark:bg-emerald-950/20 rounded-[2.5rem] border-2 border-emerald-100 dark:border-emerald-900/50 flex items-start gap-5">
            <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl shadow-sm text-emerald-600">
              <ShieldAlert size={24} />
            </div>
            <div>
              <h4 className="font-black text-emerald-900 dark:text-emerald-200 uppercase tracking-widest text-xs">Liaison Protection Active</h4>
              <p className="text-xs text-emerald-800 dark:text-emerald-400 mt-2 leading-relaxed font-medium italic">
                Your money is currently held in a secure national account. It is <b>not</b> with the vendor. We will only release it when you perform the Digital Handshake above.
              </p>
              <div className="mt-6">
                <ManualReleaseButton order={order} />
              </div>
            </div>
          </div>
        </div>
      )}
      
       {/* 4. STATE: PICKED UP / COMPLETED etc. */}
       {(order.status === 'picked-up' || order.status === 'completed' || order.status === 'archived') && (
        <div className="bg-white dark:bg-card p-12 rounded-[3.5rem] border-2 border-slate-100 dark:border-border text-center shadow-xl">
           <div className="w-24 h-24 bg-green-50 dark:bg-green-900/20 text-green-600 rounded-full flex items-center justify-center mx-auto mb-8">
             <CheckCircle2 size={56} />
           </div>
           <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter uppercase italic">Success Handshake</h2>
           <p className="text-slate-500 dark:text-slate-400 mt-4 font-medium max-w-sm mx-auto leading-relaxed">
              This order phase is complete. The vibration has been successfully logged in the national trade record.
           </p>
           <Button 
             variant="outline" 
             onClick={() => window.history.back()}
             className="mt-10 rounded-2xl font-black px-10 py-6 h-auto"
           >
             Return to Dashboard
           </Button>
        </div>
       )}

       {/* 5. STATE: DISPUTED */}
       {order.status === 'disputed' && (
         <div className="bg-red-50 dark:bg-red-950/20 p-10 rounded-[3rem] border-2 border-red-100 dark:border-red-900 shadow-xl text-center">
            <ShieldAlert className="mx-auto text-red-600 mb-6" size={64} />
            <h2 className="text-2xl font-black text-red-900 dark:text-red-200 uppercase tracking-tighter">Arbitration Active</h2>
            <p className="text-sm text-red-700 dark:text-red-400 mt-4 leading-relaxed font-medium">
              You have flagged this transaction. The National Liaison is currently auditing the evidence and will reach a verdict within 24 hours. <b>Your funds remain frozen in the vault.</b>
            </p>
         </div>
       )}

    </div>
  );
}
