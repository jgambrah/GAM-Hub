'use client';

import React, { useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { Campus } from '@/lib/types';

interface VibrationMapProps {
  campuses: Campus[];
  vibrationScores: Map<string, number>;
}

/**
 * VibrationMap Component
 * 
 * A high-fidelity geographic visualization for the Liaison.
 * Displays campuses as dynamic "Pulse" markers based on their activity scores.
 */
export default function VibrationMap({ campuses, vibrationScores }: VibrationMapProps) {
  // Center of Ghana
  const mapCenter: [number, number] = [7.9465, -1.0232]; 

  const sortedCampuses = useMemo(() => {
      return campuses.filter(c => c.latitude && c.longitude);
  }, [campuses]);

  const maxScore = useMemo(() => {
      let max = 1;
      vibrationScores.forEach(s => { if(s > max) max = s; });
      return max;
  }, [vibrationScores]);

  return (
    <div className="h-full w-full bg-slate-900 relative">
      <MapContainer 
        center={mapCenter} 
        zoom={7} 
        style={{ height: '100%', width: '100%', background: '#020617' }}
        scrollWheelZoom={false}
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; GAM Hub Liaison Intelligence'
        />
        
        {sortedCampuses.map(campus => {
            const score = vibrationScores.get(campus.id) || 0;
            // Scale radius between 8 and 40 based on performance
            const radius = 8 + (score / maxScore) * 32; 
            const opacity = 0.3 + (score / maxScore) * 0.5;

            return (
                <CircleMarker 
                    key={campus.id}
                    center={[campus.latitude!, campus.longitude!]}
                    radius={radius}
                    pathOptions={{
                        fillColor: campus.primaryColor || '#3b82f6',
                        color: '#fff',
                        weight: 1,
                        opacity: 0.5,
                        fillOpacity: opacity
                    }}
                >
                    <Tooltip direction="top" offset={[0, -10]} opacity={1} permanent={false}>
                        <div className="p-3 font-sans bg-slate-950 text-white rounded-2xl border border-white/10 shadow-2xl min-w-[160px]">
                            <div className="flex justify-between items-start mb-2">
                                <span className="bg-white/10 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest text-blue-400">
                                    {campus.acronym}
                                </span>
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            </div>
                            <p className="font-black text-sm leading-tight mb-3">{campus.name}</p>
                            <div className="pt-2 border-t border-white/5 flex justify-between items-center">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Activity Score</span>
                                <span className="text-sm font-black text-blue-400">{score.toLocaleString()}</span>
                            </div>
                        </div>
                    </Tooltip>
                </CircleMarker>
            );
        })}
      </MapContainer>

      {/* Map Legend Overlay */}
      <div className="absolute bottom-6 right-6 z-[1000] bg-slate-950/80 backdrop-blur-md p-4 rounded-2xl border border-white/10 shadow-2xl">
         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Vibration Intensity</p>
         <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-blue-500 opacity-80" />
                <span className="text-[9px] font-bold text-slate-300">High Frequency</span>
            </div>
            <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-blue-500 opacity-30" />
                <span className="text-[9px] font-bold text-slate-300">Emerging Signal</span>
            </div>
         </div>
      </div>
    </div>
  );
}
