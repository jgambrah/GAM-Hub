'use client';

import { Wallet } from 'lucide-react';

export default function VendorWalletPage() {
    return (
        <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <Wallet className="w-16 h-16 text-muted-foreground mb-4" />
            <h1 className="text-2xl font-bold">MoMo Wallet</h1>
            <p className="text-muted-foreground max-w-md mx-auto">
                This is where you'll see your "Pending Escrow" and "Available Balance," view your MoMo payout history, and request withdrawals.
            </p>
        </div>
    );
}
