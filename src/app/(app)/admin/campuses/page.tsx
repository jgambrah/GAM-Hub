'use client';

import * as React from 'react';
import { CampusesTable } from "@/components/admin/campuses-table";
import type { Campus } from "@/lib/types";
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { PlusCircle, Landmark } from 'lucide-react';
import CampusManager from '@/components/admin/CampusManager';

export const dynamic = 'force-dynamic';

export default function AdminCampusesPage() {
    const { firestore } = useFirebase();
    const [view, setView] = React.useState<'list' | 'manage'>('list');
    const [selectedCampus, setSelectedCampus] = React.useState<Campus | null>(null);

    const campusesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'campuses'), orderBy('acronym', 'asc'));
    }, [firestore]);

    const { data: campuses, isLoading } = useCollection<Campus>(campusesQuery);

    const handleEdit = (campus: Campus) => {
        setSelectedCampus(campus);
        setView('manage');
    };

    const handleCreateNew = () => {
        setSelectedCampus(null);
        setView('manage');
    };

    return (
        <div className="space-y-8">
            {view === 'list' ? (
                <>
                    <div className="flex items-center justify-between">
                        <div className="space-y-2">
                            <h1 className="font-headline text-3xl font-bold tracking-tight">Campus Management</h1>
                            <p className="text-muted-foreground">Add new institutions, update colors, or manage email domains.</p>
                        </div>
                        <button 
                            onClick={handleCreateNew}
                            className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-slate-800 transition-all active:scale-95 shadow-lg"
                        >
                            <PlusCircle size={18} />
                            Add Campus
                        </button>
                    </div>
                    <CampusesTable data={campuses || []} isLoading={isLoading} onEdit={handleEdit} />
                </>
            ) : (
                <div className="animate-in slide-in-from-bottom-4 duration-500">
                    <CampusManager 
                        selectedCampus={selectedCampus} 
                        onCancel={() => setView('list')} 
                    />
                </div>
            )}
        </div>
    )
}
