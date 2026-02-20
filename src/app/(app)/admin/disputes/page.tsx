'use client';

import { DisputeCenter } from '@/components/admin/dispute-center';

export const dynamic = 'force-dynamic';

export default function AdminDisputesPage() {
    // This page is designed to be full-screen, so we don't add padding here.
    return <DisputeCenter />;
}
