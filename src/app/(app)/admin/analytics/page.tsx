'use client';
import LiaisonAnalytics from '@/components/admin/LiaisonAnalytics';

export const dynamic = 'force-dynamic';

export default function AnalyticsPage() {
    // This page is designed to be full-screen, so we don't add padding here.
    return <LiaisonAnalytics />;
}
