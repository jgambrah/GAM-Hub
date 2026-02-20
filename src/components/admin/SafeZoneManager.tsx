'use client';

import React, { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';
import { collection, query, where, doc } from 'firebase/firestore';
import { useFirebase, useCollection, useMemoFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { ShieldCheck, Info, Crosshair, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import type { Campus, PickupPoint } from '@/lib/types';
import L, { type LatLng, type LatLngExpression } from 'leaflet';
import { Skeleton } from '../ui/skeleton';

// --- STABLE COMPONENTS & ICONS ---
const liaisonIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/9131/9131546.png',
  iconSize: [40, 40],
  iconAnchor: [20, 40],
});

// Dynamically import the entire map wrapper to ensure clean unmounting
const LeafletMap = dynamic(() => import('./LeafletMap'), {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    ),
  });

// --- MAIN COMPONENT ---
export default function SafeZoneManager({ selectedCampus }: { selectedCampus: Campus }) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [newPoint, setNewPoint] = useState<LatLng | null>(null);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Reset map when campus changes with delay for cleanup
  useEffect(() => {
    if (isClient) {
      setShowMap(false);
      setNewPoint(null);
      
      const timer = setTimeout(() => {
        setShowMap(true);
      }, 100); // Small delay to ensure DOM cleanup

      return () => clearTimeout(timer);
    }
  }, [selectedCampus.id, isClient]);

  const existingPointsQuery = useMemoFirebase(() => {
    if (!firestore || !selectedCampus) return null;
    return query(collection(firestore, 'pickup_points'), where('campusId', '==', selectedCampus.id));
  }, [firestore, selectedCampus]);

  const { data: existingPoints, isLoading: isLoadingPoints } = useCollection<PickupPoint>(existingPointsQuery);

  const handleSavePoint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPoint) {
        toast({ variant: 'destructive', title: 'No location selected', description: 'Click on the map to place a pin first.' });
        return;
    }
    if (!name || !desc) {
         toast({ variant: 'destructive', title: 'Missing information', description: 'Please provide a name and description.' });
        return;
    }

    setLoading(true);
    try {
      await addDocumentNonBlocking(collection(firestore, 'pickup_points'), {
        name,
        description: desc,
        campusId: selectedCampus.id,
        latitude: newPoint.lat,
        longitude: newPoint.lng,
        isOfficial: true,
        status: 'active',
        createdAt: new Date().toISOString(),
      });
      toast({ title: "Safe Zone Established!", description: `${name} has been added to ${selectedCampus.name}.` });
      setNewPoint(null); setName(''); setDesc('');
    } catch (err) {
        console.error(err);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not save the Safe Zone.' });
    }
    finally { setLoading(false); }
  };

  const handleDeletePoint = (pointId: string) => {
      if (!firestore) return;
      if (confirm("Are you sure you want to delete this pickup point?")) {
        deleteDocumentNonBlocking(doc(firestore, 'pickup_points', pointId));
        toast({ variant: 'destructive', title: 'Safe Zone Removed' });
      }
  }

  const mapCenter: [number, number] = useMemo(() => {
    const lat = selectedCampus.latitude || 5.6506;
    const lng = selectedCampus.longitude || -0.1870;
    
    // Validate coordinates
    if (
      typeof lat === 'number' && 
      typeof lng === 'number' &&
      !isNaN(lat) && 
      !isNaN(lng) &&
      lat >= -90 && 
      lat <= 90 &&
      lng >= -180 && 
      lng <= 180
    ) {
      return [lat, lng];
    }
    
    // Fallback to Accra, Ghana coordinates
    return [5.6506, -0.1870];
  }, [selectedCampus.latitude, selectedCampus.longitude]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-1 space-y-6">
        <div className="bg-slate-900 text-white p-8 rounded-[3rem] shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-blue-500 rounded-2xl">
              <ShieldCheck size={24} />
            </div>
            <h2 className="text-xl font-black">Safe-Zone Architect</h2>
          </div>
          <p className="text-sm text-slate-400 mb-8 leading-relaxed">
            Click on the map to place a pin, then fill out the form to create a new <b>Verified Pickup Point</b> for {selectedCampus.acronym}.
          </p>
          <form onSubmit={handleSavePoint} className="space-y-4">
            <div className="space-y-1">
               <label className="text-[10px] font-black text-slate-500 uppercase px-2">Location Name</label>
               <Input
                 required value={name}
                 placeholder="e.g. Balme Library Gate"
                 className="w-full p-4 h-auto rounded-2xl bg-white/5 border border-white/10 outline-none focus:border-blue-500 transition-all text-sm text-white"
                 onChange={(e) => setName(e.target.value)}
               />
            </div>
            <div className="space-y-1">
               <label className="text-[10px] font-black text-slate-500 uppercase px-2">Description / Instructions</label>
               <Textarea
                 required value={desc}
                 placeholder="Where exactly should they stand?"
                 className="w-full p-4 rounded-2xl bg-white/5 border border-white/10 outline-none h-24 text-sm text-white"
                 onChange={(e) => setDesc(e.target.value)}
               />
            </div>
            {newPoint && (
              <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-center gap-3 text-blue-400">
                <Crosshair size={18} />
                <span className="text-xs font-bold font-mono">
                  {newPoint.lat.toFixed(4)}, {newPoint.lng.toFixed(4)}
                </span>
              </div>
            )}
            <Button
              type="submit" disabled={!newPoint || loading}
              className="w-full py-4 h-auto bg-blue-600 hover:bg-blue-500 disabled:opacity-30 text-white rounded-2xl font-black shadow-xl shadow-blue-900/20 transition-all active:scale-95"
            >
              {loading ? <Loader2 className="animate-spin" /> : "Save Safe Zone"}
            </Button>
          </form>
        </div>
        <div className="space-y-2">
            <h3 className="font-semibold text-sm px-2">Existing Points</h3>
            {isLoadingPoints ? <Skeleton className="h-24 w-full"/> :
             existingPoints && existingPoints.length > 0 ? (
              <ul className="space-y-2">
                {existingPoints.map((point) => (
                  <li key={point.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <p className="font-medium text-sm">{point.name}</p>
                    <Button variant="ghost" size="sm" onClick={() => handleDeletePoint(point.id)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted-foreground p-4 text-center border-2 border-dashed rounded-lg">No points yet.</p>}
          </div>
      </div>

      <div className="lg:col-span-2 relative h-[600px] rounded-[3.5rem] overflow-hidden border-8 border-card shadow-2xl">
        {showMap && (
          <LeafletMap
            key={selectedCampus.id}
            center={mapCenter}
            existingPoints={existingPoints || []}
            liaisonIcon={liaisonIcon}
            onMapClick={(latlng) => setNewPoint(latlng)}
            newPoint={newPoint}
          />
        )}
        
        {!showMap && (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        )}
        
        <div className="absolute bottom-6 left-6 z-[1000] bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-gray-100 flex items-center gap-3">
          <Info size={16} className="text-blue-500" />
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            Click anywhere on the map to drop a new pin
          </p>
        </div>
      </div>
    </div>
  );
}
