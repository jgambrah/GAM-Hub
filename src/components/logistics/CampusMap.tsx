'use client';

import React, { useRef, useEffect } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ShieldCheck, Navigation } from 'lucide-react';
import type { PickupPoint } from '@/lib/types';

// FIX: Leaflet default icon path issue in Next.js
const customIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/9131/9131546.png', // A cool blue shield/pin icon
  iconSize: [35, 35],
  iconAnchor: [17, 35],
});

interface CampusMapProps {
    pickupPoints: PickupPoint[];
    center: { lat: number; lng: number; };
    onSelectPoint: (point: PickupPoint) => void;
}

export default function CampusMap({ pickupPoints, center, onSelectPoint }: CampusMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Ensure the container is ready and the map is not already initialized.
    if (!containerRef.current || mapRef.current) return;

    // Initialize the map
    const map = L.map(containerRef.current, { scrollWheelZoom: false }).setView([center.lat, center.lng], 16);
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    
    // Add markers for existing points
    pickupPoints.forEach((point) => {
        // THE FIX: Only try to create a marker if BOTH coordinates exist
        if (point.latitude !== undefined && point.longitude !== undefined) {
          const marker = L.marker([point.latitude, point.longitude], { icon: customIcon }).addTo(map);
          
          // Using a more robust way to handle clicks inside popups
          const popupContent = document.createElement('div');
          popupContent.innerHTML = `
              <div class="p-1 font-sans">
                <h4 class="font-black text-slate-900 text-sm">${point.name}</h4>
                <p class="text-xs text-gray-500 mt-1">${point.description}</p>
                <button id="select-point-btn" class="mt-3 w-full bg-blue-600 text-white py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 hover:bg-blue-700 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"></path><path d="M2 17l10 5 10-5"></path><path d="M2 12l10 5 10-5"></path></svg>
                  Set as Meeting Point
                </button>
              </div>
          `;
          popupContent.querySelector('#select-point-btn')?.addEventListener('click', () => {
              onSelectPoint(point);
              map.closePopup();
          });
  
          marker.bindPopup(popupContent);
        } else {
            // This allows the app to stay alive while telling you which point is broken
            console.warn(`Liaison Alert: Pickup point "${point.name}" (${point.id}) is missing coordinates.`);
        }
    });

    // Cleanup function to run when the component unmounts
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [center.lat, center.lng, onSelectPoint, pickupPoints]); 


  return (
    <div className="w-full h-[300px] rounded-[2rem] overflow-hidden border-4 border-card shadow-lg relative">
      <div className="absolute top-3 left-3 z-[1000] bg-slate-900/80 backdrop-blur-md text-white px-3 py-1.5 rounded-xl flex items-center gap-2 border border-white/20">
        <ShieldCheck size={14} className="text-blue-400" />
        <span className="text-[10px] font-black uppercase tracking-widest">Liaison Verified Safe Zones</span>
      </div>
      <div ref={containerRef} style={{ height: '100%', width: '100%' }} />
    </div>
  );
}
