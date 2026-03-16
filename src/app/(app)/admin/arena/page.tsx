'use client';

import * as React from 'react';
import SponsoredBattleManager from '@/components/admin/SponsoredBattleManager';

export const dynamic = 'force-dynamic';

/**
 * AdminArenaPage
 * --------------
 * Command center for the National Liaison to manage Arena sponsorship and tournaments.
 */
export default function AdminArenaPage() {
    return (
        <div className="space-y-6">
            <SponsoredBattleManager />
        </div>
    );
}
