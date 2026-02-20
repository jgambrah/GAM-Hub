
'use client';

import * as React from 'react';
import { VendorsTable } from "@/components/admin/vendors-table";
import type { User } from "@/lib/types";
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';

export const dynamic = 'force-dynamic';

export default function AdminVendorsPage() {
    const { firestore } = useFirebase();

    const vendorsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'users'), where('role', '==', 'vendor'));
    }, [firestore]);

    const { data: vendors, isLoading } = useCollection<User>(vendorsQuery);

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <h1 className="font-headline text-3xl font-bold tracking-tight">Vendor Management</h1>
                <p className="text-muted-foreground">Approve or reject new vendor applications.</p>
            </div>
            <VendorsTable data={vendors || []} isLoading={isLoading} />
        </div>
    )
}
