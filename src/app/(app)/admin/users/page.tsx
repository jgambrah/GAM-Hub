'use client';

import * as React from 'react';
import { UsersTable } from "@/components/admin/users-table";
import type { User } from "@/lib/types";
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query } from 'firebase/firestore';

export const dynamic = 'force-dynamic';

export default function AdminUsersPage() {
    const { firestore } = useFirebase();

    const usersQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'users'));
    }, [firestore]);

    const { data: users, isLoading } = useCollection<User>(usersQuery);

    return (
        <div className="space-y-6">
            <h1 className="font-headline text-3xl font-bold tracking-tight">User Management</h1>
            <UsersTable data={users || []} isLoading={isLoading} />
        </div>
    )
}
