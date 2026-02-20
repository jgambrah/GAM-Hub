'use client';

import { useEffect, useRef } from 'react';
import L, { type LatLng } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { PickupPoint } from '@/lib/types';

interface LeafletMapProps {
  center: [number, number];
  existingPoints: PickupPoint[];
  liaisonIcon: any;
  onMapClick: (latlng: LatLng) => void;
  newPoint: LatLng | null;
}

export default function LeafletMap({ center, existingPoints, liaisonIcon, onMapClick, newPoint }: LeafletMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.Marker[]>([]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Initialize map only once
    const map = L.map(containerRef.current).setView(center, 16);
    mapRef.current = map;

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    // Add click handler
    map.on('click', (e) => {
      onMapClick(e.latlng);
    });

    // Cleanup
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []); // Only run once on mount

  // Update map center when it changes
  useEffect(() => {
    if (mapRef.current && center) {
      mapRef.current.setView(center, 16);
    }
  }, [center]);

  // Update markers when points change
  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current;
    
    // Clear existing markers
    markersRef.current.forEach(marker => {
      map.removeLayer(marker);
    });
    markersRef.current = [];

    // Add existing points with validation
    existingPoints.forEach((point) => {
      // Validate coordinates
      if (
        point && 
        typeof point.latitude === 'number' && 
        typeof point.longitude === 'number' &&
        !isNaN(point.latitude) && 
        !isNaN(point.longitude) &&
        point.latitude >= -90 && 
        point.latitude <= 90 &&
        point.longitude >= -180 && 
        point.longitude <= 180
      ) {
        const marker = L.marker([point.latitude, point.longitude], { icon: liaisonIcon })
          .bindPopup(`
            <div class="p-2 font-sans">
              <p class="font-black text-blue-600 text-xs uppercase mb-1">Active Safe Zone</p>
              <p class="font-bold text-slate-800">${point.name || 'Unnamed Point'}</p>
            </div>
          `)
          .addTo(map);
        
        markersRef.current.push(marker);
      } else {
        console.warn('Invalid pickup point coordinates:', point);
      }
    });

    // Add new point marker if valid
    if (newPoint && typeof newPoint.lat === 'number' && typeof newPoint.lng === 'number') {
      const tempMarker = L.marker([newPoint.lat, newPoint.lng])
        .bindPopup('New pickup point location')
        .addTo(map);
      
      markersRef.current.push(tempMarker);
    }
  }, [existingPoints, liaisonIcon, newPoint]);

  return <div ref={containerRef} style={{ height: '100%', width: '100%' }} />;
}
