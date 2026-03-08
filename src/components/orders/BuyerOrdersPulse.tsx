'use client';

import React from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { useAuth } from '@/hooks/use-auth';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import { Clock, ShieldCheck, CreditCard, PackageSearch, ArrowRight, ShoppingBag, Lock } from 'lucide-react';
import Link from 'next/link';
import type { Order } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import { cn } from '@/lib/utils';

// Helper to show the status "Vibe"
function getStatusBadge(status: Order['status']) {
  switch (status) {
    case 'awaiting_confirmation':
      return <span className="flex items-center gap-1 text-[10px] font-black text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-3 py-1 rounded-full uppercase tracking-tighter border border-amber-100">
        <PackageSearch size={10} /> Auditing Stock
      </span>;
    case 'confirmed':
      return <span className="flex items-center gap-1 text-[10px] font-black text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-3 py-1 rounded-full uppercase tracking-tighter border border-blue-100">
        <CreditCard size={10} /> Ready to Pay
      </span>;
    case 'paid':
      return <span className="flex items-center gap-1 text-[10px] font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 px-3 py-1 rounded-full uppercase tracking-tighter border border-emerald-200 animate-pulse">
        <Lock size={10} /> Secured in Escrow
      </span>;
    case 'disputed':
      return <span className="flex items-center gap-1 text-[10px] font-black text-red-600 bg-red-50 dark:bg-red-950/20 px-3 py-1 rounded-full uppercase tracking-tighter border border-red-100">
        <ShieldCheck size={10} /> Under Review
      </span>;
    default:
      return <span className="text-[10px] text-slate-400 font-bold uppercase">{status.replace(/_/g, ' ')}</span>;
  }
}


export default function BuyerOrdersPulse() {
  const { user, isUserLoading: isAuthLoading } = useAuth();
  const { firestore } = useFirebase();

  const ordersQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, 'orders'),
      where('buyerId', '==', user.id),
      orderBy('createdAt', 'desc'),
      limit(3)
    );
  }, [firestore, user]);


  const { data: orders, isLoading: isOrdersLoading } = useCollection<Order>(ordersQuery);
  const isLoading = isAuthLoading || isOrdersLoading;


  if (isLoading) return <div className="h-32 bg-muted animate-pulse rounded-[2.5rem] mx-4" />;
  if (!orders || orders.length === 0) return null; // Hide if no active orders

  return (
    <section className="px-4 mt-8">
      <div className="flex justify-between items-center mb-4 px-2">
        <h2 className="text-xl font-black text-foreground flex items-center gap-2">
          <Clock className="text-primary" size={20} /> My Order Pulse
        </h2>
        <Link href="/orders" className="text-[10px] font-black text-primary uppercase tracking-[0.2em] hover:underline">View Active Vaults</Link>
      </div>

      <div className="space-y-3">
        {orders.map((order) => (
          <Link 
            href={`/orders/${order.id}`} 
            key={order.id}
            className={cn(
                "block p-6 rounded-[2.5rem] border transition-all active:scale-[0.98] group",
                order.status === 'paid' ? 'bg-slate-900 border-emerald-500/30 text-white shadow-xl shadow-emerald-500/5' : 'bg-white border-slate-100 shadow-sm hover:shadow-md'
            )}
          >
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className={cn(
                    "w-14 h-14 rounded-2xl flex items-center justify-center overflow-hidden border transition-transform group-hover:scale-105",
                    order.status === 'paid' ? 'bg-white/10 border-white/10' : 'bg-slate-50 border-slate-100'
                )}>
                  <ShoppingBag className={order.status === 'paid' ? 'text-emerald-400' : 'text-slate-400'} size={24} />
                </div>
                <div>
                  <h3 className="font-black text-base leading-tight">{order.productName}</h3>
                  <div className="flex items-center gap-2 mt-1.5">
                    {getStatusBadge(order.status)}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="font-black text-lg">GHS {order.amount.toFixed(2)}</p>
                <div className="flex items-center justify-end gap-1 text-[10px] font-bold text-primary uppercase mt-1">
                    Trace <ArrowRight size={12} />
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
