'use client';

import React from 'react';
import AdManager from '@/components/vendor/AdManager';
import { useAuth } from '@/hooks/use-auth';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import type { Product } from '@/lib/types';
import { Target, Zap } from 'lucide-react';

export default function VendorBoostPage() {
    const { user, isUserLoading } = useAuth();
    const { firestore } = useFirebase();

    // 1. Fetch all products owned by this vendor
    const productsQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(
            collection(firestore, 'products'),
            where('vendorId', '==', user.id)
        );
    }, [firestore, user]);

    const { data: products, isLoading: isLoadingProducts } = useCollection<Product>(productsQuery);

    const isLoading = isUserLoading || isLoadingProducts;

    if (isLoading) {
        return (
            <div className="space-y-8">
                <div className="flex justify-between items-end">
                    <div className="space-y-2">
                        <Skeleton className="h-10 w-64" />
                        <Skeleton className="h-5 w-80" />
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Skeleton className="h-40 w-full rounded-[2.5rem]" />
                    <Skeleton className="h-40 w-full rounded-[2.5rem]" />
                    <Skeleton className="h-40 w-full rounded-[2.5rem]" />
                </div>
                <Skeleton className="h-96 w-full rounded-[3rem]" />
            </div>
        );
    }

    if (!user) return null;

    return (
        <div className="space-y-10 pb-20">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-black text-foreground flex items-center gap-3 tracking-tighter">
                        <Target className="text-primary" /> Major Boost
                    </h1>
                    <p className="text-muted-foreground font-medium mt-1">Laser-targeted campus advertising for your business</p>
                </div>
                
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 px-6 py-3 rounded-2xl flex items-center gap-3">
                    <div className="p-2 bg-amber-500 rounded-xl text-white shadow-lg shadow-amber-200/50"><Zap size={18} fill="currentColor" /></div>
                    <div>
                        <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Global Ad Status</p>
                        <p className="text-sm font-black text-foreground">{user.lead_credits && user.lead_credits > 0 ? 'ACTIVE' : 'INACTIVE'}</p>
                    </div>
                </div>
            </header>

            <AdManager 
                vendorProducts={products || []} 
                fuelBalance={user.lead_credits || 0} 
            />
        </div>
    );
}