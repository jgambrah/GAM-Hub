
'use client';
import { LiaisonFinanceCenter } from '@/components/admin/liaison-finance-center';
import { LeadPriceManager } from '@/components/admin/LeadPriceManager';

export const dynamic = 'force-dynamic';

export default function FinancePage() {
    return (
        <div className="space-y-12">
            <LiaisonFinanceCenter />
            <LeadPriceManager />
        </div>
    );
}
