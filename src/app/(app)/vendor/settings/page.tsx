'use client';

import React from 'react';
import VendorMomoSettings from '@/components/vendor/VendorMomoSettings';
import VendorIDVerification from '@/components/vendor/VendorIDVerification';
import { useAuth } from '@/hooks/use-auth';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Settings, ShieldCheck } from 'lucide-react';

export default function VendorSettingsPage() {
  const { user, isUserLoading } = useAuth();

  if (isUserLoading || !user) {
    return (
      <div className="max-w-xl mx-auto space-y-6">
        <Skeleton className="h-12 w-48" />
        <Skeleton className="h-[500px] w-full rounded-[2.5rem]" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-20">
      <header>
        <h1 className="text-3xl font-black text-foreground flex items-center gap-3">
          <Settings className="text-primary" /> Business Settings
        </h1>
        <p className="text-muted-foreground font-medium mt-1">Manage your storefront and financial credentials</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* FINANCIAL SETUP & IDENTITY */}
        <div className="lg:col-span-2 space-y-8">
          <VendorMomoSettings vendorData={user} />
          <VendorIDVerification vendorData={user} />
        </div>

        {/* ACCOUNT STATUS */}
        <div className="space-y-6">
          <Card className="rounded-[2.5rem] border-primary/10 shadow-lg">
            <CardHeader>
              <div className="p-3 bg-primary/10 text-primary rounded-2xl w-fit mb-4">
                <ShieldCheck size={24} />
              </div>
              <CardTitle className="text-lg">Verification Status</CardTitle>
              <CardDescription>Status of your campus business</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 px-4 py-2 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-xl w-fit font-black text-[10px] uppercase tracking-widest">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                Verified Merchant
              </div>
              <p className="text-xs text-muted-foreground mt-4 leading-relaxed">
                Your business has been cleared by the National Liaison for university transactions.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
