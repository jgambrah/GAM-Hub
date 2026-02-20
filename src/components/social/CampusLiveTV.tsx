'use client';

import React, { useRef, useEffect } from 'react';
import ReactPlayer from 'react-player';
import { doc } from 'firebase/firestore';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import type { LiveBroadcast } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';

export function CampusLiveTV({ campusId }: { campusId: string }) {
  const { firestore } = useFirebase();
  const playerRef = React.useRef<any>(null);

  const broadcastDocRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'live_broadcasts', campusId);
  }, [firestore, campusId]);
  
  const { data: broadcast, isLoading } = useDoc<LiveBroadcast>(broadcastDocRef);

  useEffect(() => {
    if (broadcast?.status === 'live' && playerRef.current && playerRef.current.getInternalPlayer()) {
      const timeDiff = Math.abs(playerRef.current.getCurrentTime() - broadcast.currentTime);
      // Only sync if drift is more than 3 seconds to avoid jitter on small network delays
      if (timeDiff > 3) {
        playerRef.current.seekTo(broadcast.currentTime, 'seconds');
      }
    }
  }, [broadcast?.currentTime, broadcast?.status]);
  
  if (isLoading || !broadcast) {
      return (
          <div className="fixed inset-0 z-[6000] bg-black flex items-center justify-center">
              <Skeleton className="w-full h-full" />
          </div>
      )
  }

  return (
    <div className="fixed inset-0 z-[6000] bg-black flex flex-col md:flex-row animate-in fade-in">
      {/* THE PLAYER */}
      <div className="flex-[3] relative bg-black">
         <ReactPlayer 
            ref={playerRef}
            url={broadcast.videoUrl}
            playing={true}
            width="100%" height="100%"
            style={{ pointerEvents: 'none' }} // Students can't pause/scrub
         />
         <div className="absolute top-10 left-10 p-4 bg-red-600 text-white font-black rounded-xl shadow-2xl animate-pulse">
            LIVE: {broadcast.hostName}
         </div>
      </div>

      {/* THE LIVE CHAT SIDEBAR */}
      <div className="flex-1 bg-slate-900 border-l border-white/10 flex flex-col">
         <div className="p-6 border-b border-white/10">
            <h3 className="text-white font-bold">{broadcast.title || 'Live Broadcast'}</h3>
            <p className="text-slate-400 text-xs">{broadcast.viewerCount || 0} watching now</p>
         </div>
         <div className="flex-1 p-4 flex items-center justify-center text-center text-slate-500">
            {/* Integration with our existing Group Chat messages here */}
            <p className="text-xs">Live chat coming soon!</p>
         </div>
      </div>
    </div>
  );
}
