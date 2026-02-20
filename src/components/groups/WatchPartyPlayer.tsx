
'use client';

import React, { useRef, useEffect, useState } from 'react';
import YouTube, { type YouTubePlayer, type YouTubeProps } from 'react-youtube';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import type { WatchParty } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { Loader2, Play, Pause, Volume2, VolumeX, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

// Helper to extract YouTube video ID
const getYouTubeId = (url: string): string | null => {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);

  if (match && match[2].length === 11) {
    return match[2];
  }
  return null;
};

export default function WatchPartyPlayer({ party, isHost }: { party: WatchParty, isHost: boolean }) {
  const { firestore } = useFirebase();
  const playerRef = useRef<YouTubePlayer | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isPlayerPlaying, setIsPlayerPlaying] = useState(false);
  const [syncing, setSyncing] = useState(true);
  
  const videoId = getYouTubeId(party.videoUrl);

  // Firestore listener effect
  useEffect(() => {
    if (!firestore || !party.id || !playerRef.current || !isReady) return;
    
    // This is the sync logic. We are not the host, so we just listen.
    if (!isHost) {
        const unsub = onSnapshot(doc(firestore, 'watch_parties', party.id), (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data() as WatchParty;
                const player = playerRef.current;
                const serverTime = data.currentTime;
                const clientTime = player.getCurrentTime();

                // Only seek if the time difference is significant to avoid jitter
                if (Math.abs(serverTime - clientTime) > 2) {
                    player.seekTo(serverTime, true);
                }

                if (data.isPlaying && player.getPlayerState() !== 1) {
                    player.playVideo();
                } else if (!data.isPlaying && player.getPlayerState() === 1) {
                    player.pauseVideo();
                }
            }
        });
        return unsub;
    }
  }, [firestore, party.id, isHost, isReady]);

  // Host effect to update Firestore
  useEffect(() => {
    if (!isHost || !isReady || !playerRef.current) return;
    
    const interval = setInterval(() => {
        const player = playerRef.current;
        if (player && typeof player.getCurrentTime === 'function' && player.getPlayerState() === 1) {
            const currentTime = player.getCurrentTime();
            updateDoc(doc(firestore, 'watch_parties', party.id), { currentTime });
        }
    }, 2000); // Update every 2 seconds

    return () => clearInterval(interval);
  }, [isHost, isReady, firestore, party.id]);

  const onPlayerReady: YouTubeProps['onReady'] = (event) => {
    playerRef.current = event.target;
    setIsReady(true);
    setSyncing(false);
  };
  
  const handleHostStateChange: YouTubeProps['onStateChange'] = (event) => {
    if (!isHost || !firestore) return;
    const playerState = event.data;
    let isPlaying = false;
    if (playerState === 1) { // Playing
        isPlaying = true;
    } else if (playerState === 2) { // Paused
        isPlaying = false;
    } else {
        return; // Ignore other states like buffering, ended, etc.
    }
    
    if (party.isPlaying !== isPlaying) {
      updateDoc(doc(firestore, 'watch_parties', party.id), { isPlaying });
    }
  };
  
  const opts: YouTubeProps['opts'] = {
    height: '100%',
    width: '100%',
    playerVars: {
      autoplay: 0,
      controls: isHost ? 1 : 0, // Only host sees controls
      rel: 0,
      modestbranding: 1,
    },
  };

  if (!videoId) {
    return <div className="p-8 text-center bg-red-50 text-red-700 rounded-2xl flex items-center gap-3"><AlertTriangle /> Invalid YouTube URL provided.</div>;
  }

  return (
    <div className="w-full aspect-video bg-black rounded-2xl overflow-hidden relative">
      {syncing && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20">
              <Loader2 className="h-8 w-8 animate-spin text-white"/>
              <p className="ml-2 text-white">Syncing with host...</p>
          </div>
      )}
      <YouTube
        videoId={videoId}
        opts={opts}
        onReady={onPlayerReady}
        onStateChange={handleHostStateChange}
        className="w-full h-full"
      />
    </div>
  );
}
