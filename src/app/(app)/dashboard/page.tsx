'use client';

import React, { useEffect } from 'react';
import { useView } from '@/context/ViewContext';
import { useAuth } from '@/hooks/use-auth';
import { Loader2, ArrowRight, MessageSquare, Sparkles } from 'lucide-react';
import { getAuth } from 'firebase/auth';
import Link from 'next/link';

// Restored Components
import CampusSpotlight from '@/components/spotlight/campus-spotlight';
import { CampusBulletin } from '@/components/spotlight/CampusBulletin';
import UrgentRegistryAlert from '@/components/spotlight/UrgentRegistryAlert';
import BuyerOrdersPulse from '@/components/orders/BuyerOrdersPulse';
import MajorMatch from '@/components/connections/major-match';
import StaffLounge from '@/components/dashboard/staff-lounge';
import SuperAdminDashboard from '@/components/admin/SuperAdminDashboard';
import RegistryDashboard from '@/components/management/RegistryDashboard';
import SRCDashboard from '@/components/src/SRCDashboard';
import VendorDashboard from '@/components/dashboard/vendor-dashboard';
import YardStrength from '@/components/social/YardStrength';
import CampusRadio from '@/components/social/CampusRadio';
import CampusMoodCard from '@/components/social/CampusMoodCard';

export default function HomePage() {
  const { viewMode } = useView();
  const { user, isUserLoading } = useAuth();

  /**
   * 🔍 LIAISON TOKEN AUDIT
   * Verification of Custom Claims in the browser console.
   */
  useEffect(() => {
    const auth = getAuth();
    if (auth.currentUser) {
      auth.currentUser.getIdToken(true).then(token => {
        try {
          const claims = JSON.parse(atob(token.split('.')[1]));
          console.log('🔑 LIVE TOKEN CLAIMS:', claims);
        } catch (e) {
          console.error('Failed to parse token:', e);
        }
      });
    }
  }, []);

  if (isUserLoading || !user) {
    return (
        <div className="flex h-full flex-1 items-center justify-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
    );
  }

  // 1. TELEPORTATION LOGIC: Switch view based on Liaison's choice
  switch (viewMode) {
    case 'admin': return <SuperAdminDashboard />;
    case 'management': return <RegistryDashboard userProfile={user} />;
    case 'src': return <SRCDashboard userProfile={user} />;
    case 'vendor': return <VendorDashboard />;
    default: break; // Continue to Student/Staff view
  }

  // 2. STUDENT & STAFF EXPERIENCE (THE YARD)
  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* A. OFFICIAL URGENT ALERTS */}
      <UrgentRegistryAlert />

      {/* B. OFFICIAL NEWS TICKER (SRC) */}
      <CampusBulletin />

      <div className="max-w-4xl mx-auto pt-6 space-y-8">
        
        {/* C. STAFF LOUNGE (Privilege Mode) */}
        {viewMode === 'staff' && (
          <div className="px-4 animate-in slide-in-from-top-4 duration-500">
            <StaffLounge user={user} />
          </div>
        )}

        {/* D. LIVE CAMPUS RADIO (Voice of the Yard) */}
        {(viewMode === 'student' || viewMode === 'staff') && user.campusId && (
          <CampusRadio campusId={user.campusId} />
        )}

        {/* E. AI CAMPUS MOOD (REAL-TIME TREND ANALYSIS) */}
        <CampusMoodCard />

        {/* F. NATIONAL YARD STRENGTH (Productivity GDP) */}
        <YardStrength />

        {/* G. PULSE ENTRY GATEWAY */}
        <div className="px-4">
          <Link href="/pulse">
            <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-8 rounded-[3rem] text-white shadow-xl relative overflow-hidden group hover:scale-[1.02] transition-all active:scale-95">
              <div className="absolute right-0 top-0 p-8 opacity-10 group-hover:rotate-12 transition-transform">
                <MessageSquare size={120} />
              </div>
              <div className="relative z-10 flex justify-between items-center">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="text-amber-400" size={16} />
                    <span className="text-[10px] font-black uppercase tracking-[0.3em]">Live Social Stream</span>
                  </div>
                  <h2 className="text-3xl font-black italic tracking-tighter uppercase">Enter Campus Pulse</h2>
                  <p className="text-indigo-100 text-sm mt-2 font-medium">Join the social vibration of your Yard.</p>
                </div>
                <div className="p-4 bg-white/10 rounded-2xl backdrop-blur-md border border-white/20">
                  <ArrowRight size={24} />
                </div>
              </div>
            </div>
          </Link>
        </div>

        {/* H. DAILY SPOTLIGHT (Top Performers) */}
        <CampusSpotlight />

        {/* I. MY ORDER PULSE (Escrow Tracking) */}
        <BuyerOrdersPulse />

        {/* J. MAJOR-MATCH (Networking) */}
        <MajorMatch />
      </div>
    </div>
  );
}
