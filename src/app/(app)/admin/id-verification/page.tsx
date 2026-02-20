'use client';

import IDApprovalQueue from "@/components/admin/IDApprovalQueue";

export const dynamic = 'force-dynamic';

export default function IDVerificationPage() {
    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <h1 className="font-headline text-3xl font-bold tracking-tight">Security Desk: ID Vetting</h1>
                <p className="text-muted-foreground">Verify Ghana Cards to anchor trust and unlock high-value categories.</p>
            </div>
            <IDApprovalQueue />
        </div>
    );
}
