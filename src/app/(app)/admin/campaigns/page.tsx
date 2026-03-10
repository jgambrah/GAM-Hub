
'use client';

import * as React from 'react';
import { CampaignManager } from "@/components/admin/CampaignManager";

export const dynamic = 'force-dynamic';

export default function AdminCampaignsPage() {
    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <h1 className="font-headline text-3xl font-bold tracking-tight">Ad Campaign Command</h1>
                <p className="text-muted-foreground">Manage sponsored vibes and native placements across the national hub.</p>
            </div>
            <CampaignManager />
        </div>
    );
}
