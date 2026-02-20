'use client';

import React from 'react';
import { useDoc, useFirebase, useMemoFirebase } from '@/firebase';
import { useAuth } from '@/hooks/use-auth';
import { doc } from 'firebase/firestore';
import CommunityPaymentButton from '@/components/market/StudentPaymentButton';
import { Clock, ShieldCheck, CreditCard, PackageCheck, QrCode } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { ScanReceiptDialog } from '@/components/orders/ScanReceiptDialog';
import { ManualReleaseButton } from '@/components/orders/ManualReleaseButton';
import type { Order } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { useParams } from 'next/navigation';

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
     return <p className="p-10 text-center">You do not have permission to view this order.</p>;
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      
      {/* 1. STATE: WAITING FOR VENDOR */}
      {order.status === 'awaiting_confirmation' && (
        <div className="bg-amber-50 dark:bg-amber-900/20 p-8 rounded-[2.5rem] border border-amber-100 text-center">
          <Clock className="mx-auto text-amber-500 mb-4" size={48} />
          <h2 className="text-xl font-black text-amber-900 dark:text-amber-200">Waiting for Vendor</h2>
          <p className="text-sm text-amber-700 dark:text-amber-300 mt-2">
            The vendor is currently checking their stock. We will notify you once they confirm.
          </p>
        </div>
      )}

      {/* 2. STATE: STOCK CONFIRMED -> SHOW PAY BUTTON */}
      {order.status === 'confirmed' && (
        <div className="bg-blue-50 dark:bg-blue-900/20 p-8 rounded-[2.5rem] border border-blue-100 shadow-xl shadow-blue-100/50">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-blue-600 text-white rounded-2xl">
              <ShieldCheck size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-blue-900 dark:text-blue-200">Stock Confirmed!</h2>
              <p className="text-xs text-blue-600 dark:text-blue-400 font-bold uppercase tracking-widest">Liaison Escrow Ready</p>
            </div>
          </div>
          
          <p className="text-sm text-blue-800 dark:text-blue-300 mb-8 leading-relaxed">
            The vendor has confirmed they have the <b>{order.productName}</b>. 
            Pay now to secure the item in our secure Escrow.
          </p>

          <CommunityPaymentButton 
            order={order} 
            userProfile={userProfile} 
          />
        </div>
      )}

      {/* 3. STATE: PAID -> WAITING FOR DELIVERY */}
      {order.status === 'paid' && (
        <div className="space-y-6">
          <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-2xl">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h2 className="text-2xl font-black">Money in Escrow</h2>
                <p className="text-blue-400 text-xs font-bold uppercase mt-1">Order Secured</p>
              </div>
              <div className="p-3 bg-white/10 rounded-2xl text-blue-400">
                <CreditCard size={24} />
              </div>
            </div>
            
            <p className="text-sm text-slate-400 leading-relaxed mb-8">
              Meeting Point: <span className="text-white font-bold">{order.deliveryLocation.pointName || 'Office Delivery'}</span>
            </p>

            <ScanReceiptDialog order={order}>
                <Button className="w-full py-6 bg-blue-600 hover:bg-blue-700 rounded-2xl font-black text-sm flex items-center justify-center gap-2">
                    <QrCode size={20} /> I'm with the Vendor (Scan QR)
                </Button>
            </ScanReceiptDialog>
          </div>
          
          <div className="mt-4 p-6 bg-amber-50 dark:bg-amber-900/20 rounded-3xl border border-amber-100 dark:border-amber-900/50">
            <p className="text-xs text-amber-700 dark:text-amber-300 mb-4 italic">
              Cannot scan the QR code? You can manually release the funds if you have the item.
            </p>
            <ManualReleaseButton order={order} />
          </div>
        </div>
      )}
      
       {/* 4. STATE: PICKED UP / DISPUTED / COMPLETED etc. */}
       {(order.status === 'picked-up' || order.status === 'disputed' || order.status === 'completed' || order.status === 'refunded' || order.status === 'archived') && (
        <div className="bg-card p-8 rounded-[2.5rem] border text-center">
           <PackageCheck className="mx-auto text-green-500 mb-4" size={48} />
           <h2 className="text-xl font-black text-foreground">Order {order.status.replace(/_/g, ' ')}</h2>
           <p className="text-sm text-muted-foreground mt-2">
              This order process is complete or under review.
           </p>
        </div>
       )}

    </div>
  );
}
