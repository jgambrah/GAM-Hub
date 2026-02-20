'use client';

import * as React from 'react';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, orderBy, query } from 'firebase/firestore';
import type { Campus } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { MapPin } from 'lucide-react';
import dynamicImport from 'next/dynamic';

const SafeZoneManager = dynamicImport(() => import('@/components/admin/SafeZoneManager'), {
    ssr: false,
    loading: () => (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Skeleton className="h-[600px] w-full" />
            <Skeleton className="h-[600px] w-full lg:col-span-2" />
        </div>
    )
});


export const dynamic = 'force-dynamic';

export default function AdminPickupPointsPage() {
    const { firestore } = useFirebase();
    const [selectedCampus, setSelectedCampus] = React.useState<Campus | null>(null);

    const campusesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'campuses'), orderBy('name', 'asc'));
    }, [firestore]);

    const { data: campuses, isLoading: isLoadingCampuses } = useCollection<Campus>(campusesQuery);

    const handleValueChange = (campusId: string) => {
        const campus = campuses?.find(c => c.id === campusId);
        setSelectedCampus(campus || null);
    };
    
    // Set default selection once campuses load
    React.useEffect(() => {
        if (!selectedCampus && campuses && campuses.length > 0) {
            setSelectedCampus(campuses[0]);
        }
    }, [campuses, selectedCampus]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="space-y-2">
                    <h1 className="font-headline text-3xl font-bold tracking-tight">Pickup Point Management</h1>
                    <p className="text-muted-foreground">Designate official "Safe Zones" for order handoffs on each campus.</p>
                </div>
                {isLoadingCampuses ? (
                     <Skeleton className="h-10 w-[240px]" />
                ) : (
                    <Select onValueChange={handleValueChange} value={selectedCampus?.id}>
                        <SelectTrigger className="w-auto md:w-[240px]">
                            <MapPin className="h-4 w-4" />
                            <SelectValue placeholder="Select a campus" />
                        </SelectTrigger>
                        <SelectContent>
                            {campuses?.map((campus) => (
                                <SelectItem key={campus.id} value={campus.id}>
                                    {campus.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
            </div>

            {selectedCampus ? (
                <SafeZoneManager selectedCampus={selectedCampus} />
            ) : (
                <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 py-24 text-center">
                    <h2 className="text-xl font-semibold tracking-tight">Select a Campus</h2>
                    <p className="text-sm text-muted-foreground">
                        Choose a campus from the dropdown to start managing its pickup points.
                    </p>
                </div>
            )}
        </div>
    );
}
