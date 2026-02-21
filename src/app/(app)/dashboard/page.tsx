'use client';

import React, { useState, useEffect } from 'react';
import { useView } from '@/context/ViewContext';
import { useAuth } from '@/hooks/use-auth';
import { Plus, Video, Sparkles, Camera, Type, MessageSquare, Loader2 } from 'lucide-react';
import { getAuth } from 'firebase/auth';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';

// Restored Components
import CampusPulseFeed from '@/components/social/CampusPulseFeed';
import ShareVibeModal from '@/components/social/ShareVibeModal';
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
import { VictoryTakeover } from '@/components/politics/VictoryTakeover';

/**
 * ElectionWinnerWatcher Component
 * 
 * Listens for the most recent 'election_winner' post type for the user's campus.
 * Triggers the Victory Takeover overlay if the result hasn't been dismissed locally.
 */
function ElectionWinnerWatcher() {
  const { user, isTokenReady } = useAuth();
  const { firestore } = useFirebase();
  const [winner, setWinner] = useState<any>(null);

  const winnerQuery = useMemoFirebase(() => {
    if (!firestore || !user?.campusId || !isTokenReady) return null;
    return query(
      collection(firestore, 'social_posts'),
      where('campusId', '==', user.campusId),
      where('type', '==', 'election_winner'),
      orderBy('createdAt', 'desc'),
      limit(1)
    );
  }, [firestore, user?.campusId, isTokenReady]);

  const { data } = useCollection(winnerQuery);

  useEffect(() => {
    if (data && data.length > 0) {
      const post = data[0];
      // Liaison Security: Check local storage to prevent duplicate takeovers
      const dismissed = localStorage.getItem(`dismissed_winner_${post.id}`);
      if (!dismissed) {
        setWinner({
          id: post.id,
          name: post.winnerName,
          image: post.winnerPhoto,
          position: post.position,
          campusId: post.campusId.toUpperCase(),
          victoryMessage: post.content
        });
      }
    }
  }, [data]);

  if (!winner) return null;

  return (
    <VictoryTakeover 
      winner={winner} 
      onDismiss={() => {
        localStorage.setItem(`dismissed_winner_${winner.id}`, 'true');
        setWinner(null);
      }} 
    />
  );
}

export default function HomePage() {
  const { viewMode } = useView();
  const { user, isUserLoading } = useAuth();
  const [isVibeModalOpen, setVibeModalOpen] = useState(false);

  /**
   * 🔍 LIAISON TOKEN AUDIT
   * Temporary debug block to verify Custom Claims in the browser console.
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
      {/* THE VICTORY OVERLAY WATCHER */}
      <ElectionWinnerWatcher />

      {/* A. OFFICIAL URGENT ALERTS */}
      <UrgentRegistryAlert />

      {/* B. OFFICIAL NEWS TICKER (SRC) */}
      <CampusBulletin />

      <div className="max-w-4xl mx-auto pt-6 space-y-8">
        
        {/* C. STAFF LOUNGE (Conditional Privilege) */}
        {viewMode === 'staff' && (
          <div className="px-4 animate-in slide-in-from-top-4 duration-500">
            <StaffLounge user={user} />
          </div>
        )}

        {/* D. LIVE CAMPUS RADIO (The Voice of the Yard) */}
        {(viewMode === 'student' || viewMode === 'staff') && user.campusId && (
          <CampusRadio campusId={user.campusId} />
        )}

        {/* E. NATIONAL YARD STRENGTH (Economic/Productivity Prestige) */}
        <YardStrength />

        {/* F. DAILY SPOTLIGHT (The Winners) */}
        <CampusSpotlight />

        {/* G. MY ORDER PULSE (Real-time tracking of GHS) */}
        <BuyerOrdersPulse />

        {/* H. MAJOR-MATCH (Academic Networking) */}
        <MajorMatch />

        {/* I. THE MULTIMEDIA ACTION BAR (Share Vibe) */}
        <div className="px-6 mt-12 mb-6 flex justify-between items-center bg-white p-6 mx-4 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="flex items-center gap-4">
            <div className="flex -space-x-2">
              <div className="p-2 bg-red-100 text-red-600 rounded-lg border-2 border-white relative z-30"><Video size={18} /></div>
              <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg border-2 border-white relative z-20"><Camera size={18} /></div>
              <div className="p-2 bg-blue-100 text-blue-600 rounded-lg border-2 border-white relative z-10"><Type size={18} /></div>
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 leading-tight">Campus Pulse</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Broadcast to the Yard</p>
            </div>
          </div>
          
          <button 
            onClick={() => setVibeModalOpen(true)}
            className="bg-gradient-to-r from-red-600 to-pink-600 text-white px-6 py-3 rounded-2xl font-black text-xs shadow-lg shadow-red-100 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
          >
            <Plus size={16} />
            Share Vibe
          </button>
        </div>

        {/* J. THE LIVE VIBE GRID */}
        <div className="px-2">
          <CampusPulseFeed activeCampusId={user?.campusId || 'all'} />
        </div>
      </div>

      {/* MODAL LAYER */}
      {isVibeModalOpen && (
        <ShareVibeModal 
          userProfile={user} 
          onClose={() => setVibeModalOpen(false)} 
        />
      )}
    </div>
  );
}
