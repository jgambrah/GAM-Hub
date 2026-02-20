'use client';

import * as React from 'react';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { PickupPoint } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import dynamic from 'next/dynamic';

// Dynamically import the map to avoid SSR issues with Leaflet
const CampusMap = dynamic(() => import('../logistics/CampusMap'), { 
    ssr: false,
    loading: () => <Skeleton className="h-[300px] w-full rounded-[2rem]" /> 
});

interface PickupSelectorProps {
  campusId: string;
  onSelect: (point: PickupPoint) => void;
  selectedPointId?: string;
}

export function PickupSelector({ campusId, onSelect, selectedPointId }: PickupSelectorProps) {
  const { firestore } = useFirebase();

  const pointsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'pickup_points'), 
      where('campusId', '==', campusId),
      where('status', '==', 'active'),
      orderBy('name')
    );
  }, [firestore, campusId]);

  const { data: points, isLoading } = useCollection<PickupPoint>(pointsQuery);
  
  const mapCenter = React.useMemo(() => {
    if (points && points.length > 0) {
      const validPoints = points.filter(
        p => typeof p.latitude === 'number' && typeof p.longitude === 'number'
      );
      if (validPoints.length > 0) {
        const avgLat = validPoints.reduce((sum, p) => sum + p.latitude, 0) / validPoints.length;
        const avgLng = validPoints.reduce((sum, p) => sum + p.longitude, 0) / validPoints.length;
        return { lat: avgLat, lng: avgLng };
      }
    }
    // Default to UG if no points exist or no points have valid coordinates
    return { lat: 5.6506, lng: -0.1870 };
  }, [points]);


  if (isLoading) {
    return (
        <div className="space-y-3">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-[300px] w-full rounded-[2rem]" />
        </div>
    )
  }

  return (
    <div className="space-y-4">
      <label className="text-sm font-medium text-foreground px-1">
        Select a Safe Pickup Point
      </label>
      {points && points.length > 0 ? (
        <>
            <CampusMap 
                pickupPoints={points}
                center={mapCenter}
                onSelectPoint={onSelect}
            />
            {selectedPointId && (
                <div className="p-3 bg-primary/10 rounded-xl border border-primary/20 text-center">
                    <p className="text-xs font-bold text-primary/80 uppercase">Selected Point</p>
                    <p className="font-semibold text-foreground">{points.find(p => p.id === selectedPointId)?.name}</p>
                </div>
            )}
        </>
      ) : (
          <div className="text-center py-10 text-sm text-muted-foreground border-2 border-dashed rounded-lg">
              No official pickup points have been set for this campus yet.
          </div>
      )}
    </div>
  );
}
