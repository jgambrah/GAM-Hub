'use client';

import { History } from 'lucide-react';

export default function VendorPayoutsPage() {
    return (
        <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <History className="w-16 h-16 text-muted-foreground mb-4" />
            <h1 className="text-2xl font-bold">Payout History</h1>
            <p className="text-muted-foreground max-w-md mx-auto">
                This is where you'll see a complete history of all MoMo payouts you have received from the platform.
            </p>
        </div>
    );
}
