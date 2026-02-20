'use client';

import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Using a professional pin icon for location selection
const pinIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/9131/9131546.png',
  iconSize: [35, 35],
  iconAnchor: [17, 35],
});

interface PreciseLocationMapProps {
  center: { lat: number; lng: number };
  onPinDropped: (coords: { lat: number; lng: number }) => void;
}

export default function PreciseLocationMap({ center, onPinDropped }: PreciseLocationMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    // Only initialize the map on the client
    if (typeof window === 'undefined' || !containerRef.current || mapRef.current) return;

    // Initialize Leaflet Map
    const map = L.map(containerRef.current, { scrollWheelZoom: true }).setView([center.lat, center.lng], 16);
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    // Event listener to handle pin dropping
    map.on('click', (e) => {
      const { lat, lng } = e.latlng;
      
      // Update or create the marker
      if (markerRef.current) {
        markerRef.current.setLatLng(e.latlng);
      } else {
        markerRef.current = L.marker(e.latlng, { icon: pinIcon }).addTo(map);
      }
      
      // Send coordinates back to the parent form
      onPinDropped({ lat, lng });
    });

    // Cleanup on unmount
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [center, onPinDropped]);

  return (
    <div className="w-full h-full relative group">
      <div ref={containerRef} style={{ height: '100%', width: '100%' }} />
      {/* Informational overlay */}
      <div className="absolute top-3 left-3 z-[1000] bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-xl border shadow-sm pointer-events-none border-blue-100">
        <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest text-center">
          Tap Map to Drop Pin
        </p>
      </div>
    </div>
  );
}
