'use client';

import React, { useState, useEffect } from 'react';
import { doc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import { Tv, Play, Square } from 'lucide-react';
import ReactPlayer from 'react-player';
import type { User } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

export default function LiveDirector({ userProfile }: { userProfile: User }) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [isLive, setIsLive] = useState(false);
  
  const campusId = userProfile.campusId;

  // The Heartbeat: Send current video time to everyone every 3 seconds
  const syncProgress = async (state: any) => {
    if (!isLive || !firestore) return;
    const broadcastRef = doc(firestore, 'live_broadcasts', campusId);
    await updateDoc(broadcastRef, {
      currentTime: Math.floor(state.playedSeconds),
      updatedAt: serverTimestamp()
    });
  };

  const toggleLive = async () => {
    if (!firestore) return;
    if (!url || !title) {
        toast({
            variant: "destructive",
            title: "Missing Information",
            description: "Please provide a video URL and a title for the broadcast.",
        });
        return;
    }
    const broadcastRef = doc(firestore, 'live_broadcasts', campusId);
    
    // Using setDoc with merge:true is safer as it creates the doc if it doesn't exist.
    await setDoc(broadcastRef, {
      status: !isLive ? 'live' : 'off-air',
      videoUrl: url,
      hostName: userProfile.name,
      hostId: userProfile.id,
      title: title,
      viewerCount: 0,
      currentTime: 0,
      updatedAt: serverTimestamp()
    }, { merge: true });
    
    setIsLive(!isLive);
    toast({
        title: `Broadcast is now ${!isLive ? "LIVE" : "OFF-AIR"}`,
        description: `Campus TV for ${campusId.toUpperCase()} has been updated.`,
        variant: !isLive ? "default" : "destructive"
    });
  };

  return (
    <div className="p-8 bg-slate-950 text-white rounded-[3rem] shadow-2xl border-4 border-red-600/20">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-black flex items-center gap-3">
          <Tv className={isLive ? "text-red-500 animate-pulse" : "text-slate-500"} />
          Campus TV: Director's Booth
        </h2>
        {isLive && (
          <div className="bg-red-600 px-4 py-1 rounded-full text-[10px] font-black animate-bounce">ON AIR</div>
        )}
      </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <input 
                placeholder="Broadcast Title..." 
                className="w-full p-4 rounded-2xl bg-white/5 border border-white/10 text-sm font-bold"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
            />
            <input 
                placeholder="Paste YouTube Stream/Video URL..." 
                className="w-full p-4 rounded-2xl bg-white/5 border border-white/10 text-xs font-mono"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
            />
        </div>


      <div className="aspect-video bg-black rounded-3xl overflow-hidden mb-6 border border-white/5">
        <ReactPlayer 
          url={url} 
          controls 
          width="100%" height="100%"
          onProgress={syncProgress}
          progressInterval={3000}
        />
      </div>

      <button 
        onClick={toggleLive}
        className={`w-full py-4 rounded-2xl font-black transition-all flex items-center justify-center gap-2 ${isLive ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
      >
        {isLive ? <><Square size={18}/> Stop Broadcast</> : <><Play size={18}/> Go Live to the Yard</>}
      </button>
    </div>
  );
}
