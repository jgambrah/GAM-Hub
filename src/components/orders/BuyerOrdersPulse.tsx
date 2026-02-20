'use client';

import React from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { useAuth } from '@/hooks/use-auth';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import { Clock, ShieldCheck, CreditCard, PackageSearch, ArrowRight, ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import type { Order } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';

// Helper to show the status "Vibe"
function getStatusBadge(status: Order['status']) {
  switch (status) {
    case 'awaiting_confirmation':
      return <span className="flex items-center gap-1 text-[10px] font-black text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full uppercase tracking-tighter">
        <PackageSearch size={10} /> Waiting for Vendor
      </span>;
    case 'confirmed':
      return <span className="flex items-center gap-1 text-[10px] font-black text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-full uppercase tracking-tighter">
        <CreditCard size={10} /> Ready to Pay
      </span>;
    case 'paid':
      return <span className="flex items-center gap-1 text-[10px] font-black text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-full uppercase tracking-tighter">
        <ShieldCheck size={10} /> In Escrow
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
        <Link href="/orders" className="text-xs font-bold text-primary uppercase">View All</Link>
      </div>

      <div className="space-y-3">
        {orders.map((order) => (
          <Link 
            href={`/orders/${order.id}`} 
            key={order.id}
            className="block p-5 bg-card rounded-3xl border border-border shadow-sm hover:shadow-md transition-all active:scale-[0.98]"
          >
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center overflow-hidden border border-border">
                  <ShoppingBag className="text-muted-foreground" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-sm">{order.productName}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    {getStatusBadge(order.status)}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="font-black text-foreground">GHS {order.amount.toFixed(2)}</p>
                <ArrowRight size={14} className="text-muted-foreground ml-auto mt-2" />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
