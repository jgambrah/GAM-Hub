'use client';

import { MapPin } from 'lucide-react';

export default function VendorLocationsPage() {
    return (
        <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <MapPin className="w-16 h-16 text-muted-foreground mb-4" />
            <h1 className="text-2xl font-bold">Safe Zones Map</h1>
            <p className="text-muted-foreground max-w-md mx-auto">
                This is where you'll find a reference map of all the Verified Pickup Points the Liaison has set up, so you know where to meet students.
            </p>
        </div>
    );
}
