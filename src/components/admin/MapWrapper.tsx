'use client';

import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import type { LatLng, LatLngExpression } from 'leaflet';
import type { PickupPoint } from '@/lib/types';

interface MapWrapperProps {
  mapCenter: LatLngExpression;
  existingPoints: PickupPoint[];
  liaisonIcon: any;
  newPoint: LatLng | null;
  setNewPoint: (pos: LatLng) => void;
}

function MapClickHandler({ setNewPoint, newPoint }: { setNewPoint: (pos: LatLng) => void, newPoint: LatLng | null }) {
  useMapEvents({
    click: (e) => {
      setNewPoint(e.latlng);
    },
  });

  if (!newPoint) return null;
  return <Marker position={newPoint} />;
}

export default function MapWrapper({ mapCenter, existingPoints, liaisonIcon, newPoint, setNewPoint }: MapWrapperProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      // Cleanup: remove all leaflet-specific classes and data
      if (containerRef.current) {
        const mapDiv = containerRef.current.querySelector('.leaflet-container');
        if (mapDiv) {
          (mapDiv as any)._leaflet_id = undefined;
        }
      }
    };
  }, []);

  return (
    <div ref={containerRef} className="h-full w-full">
      <MapContainer
        center={mapCenter}
        zoom={16}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        <TileLayer 
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        
        <MapClickHandler setNewPoint={setNewPoint} newPoint={newPoint} />

        {existingPoints.map((point: PickupPoint) => (
          <Marker 
            key={point.id} 
            position={[point.latitude, point.longitude]} 
            icon={liaisonIcon}
          >
            <Popup>
              <div className="p-2 font-sans">
                <p className="font-black text-blue-600 text-xs uppercase mb-1">Active Safe Zone</p>
                <p className="font-bold text-slate-800">{point.name}</p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
