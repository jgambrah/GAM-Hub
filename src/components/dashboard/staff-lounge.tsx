'use client';

import React, { useState } from 'react';
import { Landmark, ShieldCheck, ArrowRight, Loader2, Sparkles, Info } from 'lucide-react';
import type { User, Product } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { OrderConfirmationDialog } from '../orders/OrderConfirmationDialog';
import { cn } from '@/lib/utils';

export default function StaffLounge({ user }: { user: User }) {
  const { firestore } = useFirebase();
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // 1. DYNAMIC QUERY: Fetch live staff-only products
  const staffQuery = useMemoFirebase(() => {
    if (!firestore || !user?.campusId) return null;
    return query(
      collection(firestore, 'products'),
      where('campusId', '==', user.campusId),
      where('targetAudience', '==', 'staff'),
      orderBy('createdAt', 'desc'),
      limit(3)
    );
  }, [firestore, user?.campusId]);

  const { data: staffDeals, isLoading } = useCollection<Product>(staffQuery);

  // If the user is not staff, we return nothing. 
  if (user.role !== 'staff') {
    return null;
  }

  return (
    <section className="mt-8 p-8 bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 rounded-[3rem] text-white shadow-2xl relative overflow-hidden">
      {/* Visual Decoration */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -mr-20 -mt-20" />
      
      <div className="relative z-10">
        <div className="flex justify-between items-center mb-8">
          <div>
            <div className="flex items-center gap-2 text-blue-400 mb-1">
              <ShieldCheck size={18} />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">Verified Staff Exclusive</span>
            </div>
            <h2 className="text-3xl font-black">The Staff Lounge</h2>
          </div>
          <button className="bg-white/10 hover:bg-white/20 px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border border-white/10 h-auto">
            View All Deals
          </button>
        </div>

        {/* DYNAMIC GRID */}
        {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[...Array(3)].map((_, i) => (
                    <div key={i} className="bg-white/5 p-6 rounded-[2rem] border border-white/5 space-y-4">
                        <Skeleton className="h-10 w-10 rounded-xl bg-white/10" />
                        <Skeleton className="h-6 w-3/4 bg-white/10" />
                        <Skeleton className="h-4 w-full bg-white/10" />
                        <Skeleton className="h-10 w-full bg-white/10 rounded-xl" />
                    </div>
                ))}
            </div>
        ) : staffDeals && staffDeals.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {staffDeals.map((deal) => (
                    <div key={deal.id} className="bg-white/10 backdrop-blur-md p-6 rounded-[2rem] border border-white/10 hover:bg-white/15 transition-all flex flex-col justify-between group">
                        <div>
                            <div className="p-3 bg-blue-600 rounded-2xl w-fit mb-4 shadow-lg group-hover:scale-110 transition-transform">
                                {deal.category === 'Bank' || deal.category === 'Loans' ? <Landmark size={20} /> : <Sparkles size={20} />}
                            </div>
                            <h4 className="font-bold text-lg leading-tight">{deal.name}</h4>
                            <p className="text-sm text-slate-300 mt-2 line-clamp-2 leading-relaxed">
                                {deal.description}
                            </p>
                        </div>
                        
                        <button 
                            onClick={() => setSelectedProduct(deal)}
                            className="mt-6 w-full py-3 bg-white text-slate-900 rounded-xl font-black text-xs flex items-center justify-center gap-2 hover:scale-105 active:scale-95 transition-all shadow-xl"
                        >
                            {deal.productType === 'service' ? 'Apply Now' : 'Buy Now'}
                            <ArrowRight size={14} />
                        </button>
                    </div>
                ))}
            </div>
        ) : (
            // Empty State
            <div className="p-16 text-center bg-white/5 rounded-[2.5rem] border-2 border-dashed border-white/10 flex flex-col items-center">
                <Info className="text-blue-400/30 mb-4" size={48} />
                <h3 className="text-xl font-bold italic text-slate-400">No exclusive faculty deals available today.</h3>
                <p className="text-sm text-slate-500 mt-2 max-w-sm">We are negotiating new institutional deals for your campus. Check back soon!</p>
            </div>
        )}
      </div>

      {/* MODAL LAYER FOR STAFF ORDERS/INQUIRIES */}
      {selectedProduct && (
          <OrderConfirmationDialog 
            product={selectedProduct}
            open={!!selectedProduct}
            onOpenChange={(open) => !open && setSelectedProduct(null)}
          />
      )}
    </section>
  );
}
