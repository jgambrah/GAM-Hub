
'use client';

import * as React from 'react';
import { AlertCircle } from 'lucide-react';
import { Card, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { useAuth } from '@/hooks/use-auth';
import { Skeleton } from '../ui/skeleton';
import { VendorOnboardingForm } from '../auth/vendor-onboarding-form';
import VendorWallet from './vendor-wallet';
import DemandFeed from '../vendor/DemandFeed';

export default function VendorDashboard() {
  const { user } = useAuth();
  
  if (!user) {
    return <Skeleton className="h-[600px] w-full"/>;
  }

  // User is a vendor, but needs to complete onboarding
  if (user.role === 'vendor' && !user.isVerified) {
    if (user.onboardingStatus === 'pending_review') {
      return (
        <Card className="max-w-2xl mx-auto">
            <CardHeader className="items-center text-center">
                <AlertCircle className="w-12 h-12 text-yellow-500" />
                <CardTitle>Verification Pending</CardTitle>
                <CardDescription>
                    Your documents have been submitted and are currently under review by the GAM Hub Liaison team.
                    You will be notified once the review is complete.
                </CardDescription>
            </CardHeader>
        </Card>
      );
    }
    return <VendorOnboardingForm />;
  }

  // Verified vendor dashboard
  return (
    <div className="space-y-12">
        <VendorWallet vendorData={user} />
        
        <div className="grid grid-cols-1 gap-10">
            <div className="space-y-4">
                <div className="px-2">
                    <h2 className="text-2xl font-black text-foreground tracking-tight">Market Intelligence</h2>
                    <p className="text-sm text-muted-foreground font-medium italic">Data-driven sourcing opportunities</p>
                </div>
                <DemandFeed campusId={user.campusId} />
            </div>
        </div>
    </div>
  );
}
