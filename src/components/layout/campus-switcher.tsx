'use client';

import * as React from 'react';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, orderBy, query } from 'firebase/firestore';
import type { Campus } from '@/lib/types';
import { useCampusView } from '@/hooks/use-campus-view';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '../ui/skeleton';
import { Globe } from 'lucide-react';

export function CampusSwitcher() {
    const { firestore } = useFirebase();
    const { viewAsCampus, setViewAsCampus } = useCampusView();

    const campusesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'campuses'), orderBy('name', 'asc'));
    }, [firestore]);

    const { data: campuses, isLoading } = useCollection<Campus>(campusesQuery);

    const handleValueChange = (campusId: string) => {
        if (campusId === 'gam-hub-default') {
            setViewAsCampus(null);
        } else {
            const selectedCampus = campuses?.find(c => c.id === campusId);
            setViewAsCampus(selectedCampus || null);
        }
    };

    if (isLoading) {
        return <Skeleton className="h-9 w-[220px]" />;
    }

    return (
        <Select onValueChange={handleValueChange} value={viewAsCampus?.id ?? 'gam-hub-default'}>
            <SelectTrigger className="w-auto md:w-[240px] border-0 bg-primary/20 text-primary-foreground shadow-none ring-offset-0 hover:bg-primary/30 focus:ring-0 focus:ring-offset-0 data-[state=open]:bg-primary/30">
                <Globe className="h-4 w-4" />
                <div className="hidden md:block">
                  <SelectValue placeholder="Switch Campus View" />
                </div>
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="gam-hub-default">
                    <div className="font-semibold">GAM Hub (Global View)</div>
                </SelectItem>
                {campuses?.map((campus) => (
                    <SelectItem key={campus.id} value={campus.id}>
                        {campus.name}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
