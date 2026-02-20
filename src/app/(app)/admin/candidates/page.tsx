'use client';

import * as React from 'react';
import { CandidatesTable } from "@/components/admin/candidates-table";
import type { CandidateApplication } from "@/lib/types"; // Changed type
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore'; // Added orderBy

export const dynamic = 'force-dynamic';

export default function AdminCandidatesPage() {
    const { firestore } = useFirebase();

    // Query the new candidate_applications collection
    const candidatesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(
            collection(firestore, 'candidate_applications'),
            orderBy('createdAt', 'desc')
        );
    }, [firestore]);

    const { data: applications, isLoading } = useCollection<CandidateApplication>(candidatesQuery);

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <h1 className="font-headline text-3xl font-bold tracking-tight">Candidate Management</h1>
                <p className="text-muted-foreground">Approve or reject student applications for SRC elections.</p>
            </div>
            <CandidatesTable data={applications || []} isLoading={isLoading} />
        </div>
    )
}
