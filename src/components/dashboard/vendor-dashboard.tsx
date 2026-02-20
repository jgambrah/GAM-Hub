'use client';

import * as React from 'react';
import { AlertCircle } from 'lucide-react';
import { Card, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { useAuth } from '@/hooks/use-auth';
import { Skeleton } from '../ui/skeleton';
import { VendorOnboardingForm } from '../auth/vendor-onboarding-form';
import VendorWallet from './vendor-wallet';

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
    // Default to showing the onboarding form if status is 'needs_submission' or not set
    return <VendorOnboardingForm />;
  }

  // Verified vendor, show the wallet as their main dashboard
  return <VendorWallet vendorData={user} />;
}
