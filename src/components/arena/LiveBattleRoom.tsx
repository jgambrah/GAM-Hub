
'use client';

/**
 * LiveBattleRoom Component
 * -----------------------
 * Elite National Arena Stage.
 * Orchestrates Engagement Spike Logging for Replay Highlights.
 * Implements Step 3: Cinematic Gift Animations & Support Leaderboard.
 * Now expanded with Step 7: SUBSCRIBER BADGE & PROMOTION PROTOCOL 💎
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  collection, query, orderBy, limitToLast, 
  serverTimestamp, addDoc, updateDoc, 
  increment, doc, getDoc, onSnapshot, writeBatch, limit, where, setDoc
} from 'firebase/firestore';
import { useFirebase, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { useAuth } from '@/hooks/use-auth';
import { useSound } from '@/context/SoundContext';
import type { ArenaBattle, BattleMessage, ArenaChallenger, HubWallet, ArenaGift, GiftLeaderboardEntry } from '@/lib/types';
import { 
  X, Swords, Users, Send, Zap, 
  Loader2, MessageSquare, Trophy, ShieldCheck, Target, Volume2, VolumeX, CheckCircle2, UserPlus, Star, Crown, AlertTriangle, Gift, Rocket, Medal, Sparkles, Building2, Megaphone, Gem
} from 'lucide-react';
import ReactPlayer from 'react-player';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import YouTube from 'react-youtube';
import { Button } from '@/components/ui/button';
import { JoinBattleModal } from './JoinBattleModal';
import { spendCoins } from '@/lib/monetization';
import { motion, AnimatePresence } from 'framer-motion';
import { ScrollArea, ScrollBar } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import { Label } from '../ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { CreatorSubscribeDialog } from '../social/CreatorSubscribeDialog';

const POWER_UPS = [
    { type: 'fire', label: 'Fire Boost', emoji: '🔥', weight: 5, cost: 10 },
    { type: 'mic_drop', label: 'Mic Drop', emoji: '🎤', weight: 10, cost: 25 },
    { type: 'crown', label: 'Crown Boost', emoji: '👑', weight: 20, cost: 50 },
    { type: 'knockout', label: 'Knockout', emoji: '⚡', weight: 50, cost: 120 },
];

const GIFTS = {
  fire: { id: 'fire', label: 'Fire', emoji: '🔥', cost: 10 },
  mic: { id: 'mic', label: 'Mic', emoji: '🎤', cost: 25 },
  crown: { id: 'crown', label: 'Crown', emoji: '👑', cost: 50 },
  rocket: { id: 'rocket', label: 'Rocket', emoji: '🚀', cost: 100 },
  dragon: { id: 'dragon', label: 'Dragon', emoji: '🐉', cost: 500 },
  throne: { id: 'throne', label: 'Arena Throne', emoji: '🏛️', cost: 1000 },
  elephant: { id: 'elephant', label: 'Giant Elephant', emoji: '🐘', cost: 2000 }
};

const MAX_BOOSTS_PER_USER = 5;

function SupportLeaderboard({ battleId }: { battleId: string }) {
    const { firestore } = useFirebase();
    
    const supportersQuery = useMemoFirebase(() => {
        if (!firestore || !battleId) return null;
        return query(
            collection(firestore, 'arena_battles', battleId, 'gift_leaderboard'),
            orderBy('coinsSent', 'desc'),
            limit(10)
        );
    }, [firestore, battleId]);

    const { data: supporters, isLoading } = useCollection<GiftLeaderboardEntry>(supportersQuery);

    if (isLoading) return <div className="flex gap-2 p-4 overflow-hidden opacity-50"><Skeleton className="h-10 w-10 rounded-full" /></div>;
    if (!supporters || supporters.length === 0) return null;

    return (
        <div className="bg-slate-900/50 border-b border-white/5 py-3 px-6 animate-in slide-in-from-top-2">
            <div className="flex items-center gap-3 mb-2">
                <Medal size={12} className="text-amber-500" />
                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Top Yard Supporters</span>
            </div>
            <ScrollArea className="w-full">
                <div className="flex gap-3 pb-2">
                    {supporters.map((s, i) => (
                        <div key={s.id} className="flex items-center gap-2 bg-white/5 pr-3 pl-1 py-1 rounded-full border border-white/5 group hover:bg-white/10 transition-all">
                            <div className="relative">
                                <Avatar className="h-7 w-7 border-2 border-slate-800">
                                    <AvatarImage src={s.avatarUrl} />
                                    <AvatarFallback className="text-[10px]">{s.userName[0]}</AvatarFallback>
                                </Avatar>
                                {i < 3 && (
                                    <div className={cn(
                                        "absolute -top-1 -right-1 p-0.5 rounded-full border border-slate-900 shadow-lg",
                                        i === 0 ? "bg-amber-500" : i === 1 ? "bg-slate-300" : "bg-orange-400"
                                    )}>
                                        <Crown size={8} className="text-white" />
                                    </div>
                                )}
                            </div>
                            <div className="min-w-0">
                                <p className="text-[9px] font-black text-white truncate max-w-[60px]">{s.userName.split(' ')[0]}</p>
                                <div className="flex items-center gap-0.5">
                                    <Zap size={8} className="text-amber-500" fill="currentColor" />
                                    <span className="text-[8px] font-bold text-slate-400">{s.coinsSent}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                <ScrollBar orientation="horizontal" />
            </ScrollArea>
        </div>
    );
}

export function LiveBattleRoom({ battleId, onClose }: { battleId: string, onClose: () => void }) {
  const { firestore, auth, storage } = useFirebase();
  const { user, campus } = useAuth();
  const { soundOn, toggleSound } = useSound();
  const { toast } = useToast();
  
  const [inputMode, setInputMode] = useState<'chat' | 'boost' | 'gift'>('chat');
  const [message, setMessage] = useState('');
  const [isVoting, setIsVoting] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [selectingOpponentId, setSelectingOpponentId] = useState<string | null>(null);
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);
  const [recentPowerUp, setRecentPowerUp] = useState<any>(null);
  const [recentGift, setRecentGift] = useState<ArenaGift | null>(null);
  
  // STEP 7: Subscription Promotion State
  const [subscribingTo, setSubscribingTo] = useState<any | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  const battleRef = useMemoFirebase(() => {
    if (!firestore || !battleId) return null;
    return doc(firestore, 'arena_battles', battleId);
  }, [firestore, battleId]);

  const { data: battle, isLoading: isLoadingBattle } = useDoc<ArenaBattle>(battleRef);

  const isCreator = user?.id === battle?.creatorId;
  const isWaiting = battle?.status === 'waiting';
  const isLive = battle?.status === 'live';
  const isEnded = battle?.status === 'ended';

  const walletRef = useMemoFirebase(() => {
    if (!firestore || !user?.id) return null;
    return doc(firestore, 'wallets', user.id);
  }, [firestore, user?.id]);
  const { data: wallet } = useDoc<HubWallet>(walletRef);

  const myBoostsQuery = useMemoFirebase(() => {
    if (!firestore || !battleId || !user?.id) return null;
    return query(
        collection(firestore, 'arena_battles', battleId, 'powerups'),
        where('userId', '==', user.id)
    );
  }, [firestore, battleId, user?.id]);
  const { data: myBoosts } = useCollection(myBoostsQuery);
  const boostsRemaining = Math.max(0, MAX_BOOSTS_PER_USER - (myBoosts?.length || 0));

  const challengersQuery = useMemoFirebase(() => {
    if (!firestore || !battleId) return null;
    return query(collection(firestore, 'arena_battles', battleId, 'challengers'), orderBy('createdAt', 'desc'));
  }, [firestore, battleId]);

  const { data: challengers } = useCollection<ArenaChallenger>(challengersQuery);

  const messagesQuery = useMemoFirebase(() => 
    firestore ? query(
      collection(firestore, "arena_battles", battleId, "messages"),
      orderBy("createdAt", "asc"),
      limitToLast(50)
    ) : null
  , [firestore, battleId]);
  
  const { data: messages } = useCollection<BattleMessage>(messagesQuery);

  useEffect(() => {
    if (!firestore || !battleId || !isLive) return;
    
    if (battle?.isSponsored) {
        setDoc(doc(firestore, 'sponsor_stats', battleId), { views: increment(1), updatedAt: serverTimestamp() }, { merge: true });
    }

    const qP = query(collection(firestore, 'arena_battles', battleId, 'powerups'), orderBy('createdAt', 'desc'), limit(1));
    const unsubP = onSnapshot(qP, (snap) => {
      if (!snap.empty) {
        const data = snap.docs[0].data();
        if (Date.now() - (data.createdAt?.toMillis?.() || 0) < 5000) {
          setRecentPowerUp({ id: snap.docs[0].id, ...data });
          const timer = setTimeout(() => setRecentPowerUp(null), 4500);
          return () => clearTimeout(timer);
        }
      }
    });

    const qG = query(collection(firestore, 'arena_battles', battleId, 'gifts'), orderBy('createdAt', 'desc'), limit(1));
    const unsubG = onSnapshot(qG, (snap) => {
      if (!snap.empty) {
        const data = snap.docs[0].data();
        if (Date.now() - (data.createdAt?.toMillis?.() || 0) < 5000) {
          setRecentGift({ id: snap.docs[0].id, ...data } as ArenaGift);
          const timer = setTimeout(() => setRecentGift(null), 4500);
          return () => clearTimeout(timer);
        }
      }
    });

    return () => { unsubP(); unsubG(); };
  }, [firestore, battleId, isLive, battle?.isSponsored]);

  useEffect(() => {
    if (!firestore || !user || !battleId) return;
    const voteRef = doc(firestore, 'arena_battles', battleId, 'user_votes', user.id);
    getDoc(voteRef).then(snap => { 
        if (snap.exists()) setHasVoted(true); 
    });
  }, [firestore, user?.id, battleId]);

  const handleSelectOpponent = async (challenger: ArenaChallenger) => {
    if (!firestore || !battle || !user || battle.creatorId !== user.id) return;
    setSelectingOpponentId(challenger.id);

    try {
        const batch = writeBatch(firestore);
        const bRef = doc(firestore, 'arena_battles', battleId);
        batch.update(bRef, {
            status: 'live',
            opponentB: { userId: challenger.userId, videoUrl: challenger.videoUrl, votes: 0 },
            participants: [battle.creatorId, challenger.userId],
            [`participantInfo.${challenger.userId}`]: {
                name: challenger.userName,
                avatarUrl: challenger.avatarUrl,
                campusAcronym: challenger.campusAcronym,
                primaryColor: '#ef4444' 
            },
            [`votes.${challenger.userId}`]: 0,
            createdAt: serverTimestamp(),
            endsAt: new Date(Date.now() + 15 * 60 * 1000).toISOString() 
        });
        await batch.commit();
        toast({ title: "Battle Activated! ⚔️" });
    } catch (err) { toast({ variant: 'destructive', title: 'Activation failed' }); }
    finally { setSelectingOpponentId(null); }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !firestore || !user || !battle || battle.status === 'ended') return;
    
    const isSubA = user.subscribedCreators?.includes(battle.opponentA.userId);
    const isSubB = battle.opponentB ? user.subscribedCreators?.includes(battle.opponentB.userId) : false;
    const isSubscriber = isSubA || isSubB;

    addDoc(collection(firestore, "arena_battles", battleId, "messages"), { 
        userId: user.id, 
        userName: user.name, 
        text: message.trim(), 
        isSubscriber, 
        createdAt: serverTimestamp() 
    });
    setMessage('');
  };

  const handleVote = async (target: 'A' | 'B') => {
    if (!firestore || !user || hasVoted || isVoting || !battle || battle.status !== 'live') return;
    setIsVoting(true);
    const targetUserId = target === 'A' ? battle.opponentA?.userId : battle.opponentB?.userId;
    if (!targetUserId) return;

    try {
      await setDoc(doc(firestore, 'arena_battles', battleId, 'user_votes', user.id), { 
          votedFor: targetUserId, targetSide: target, timestamp: serverTimestamp() 
      });
      await updateDoc(doc(firestore, 'arena_battles', battleId), { 
          [target === 'A' ? 'opponentA.votes' : 'opponentB.votes']: increment(1), 
          [`votes.${targetUserId}`]: increment(1) 
      });
      if (battle.isSponsored) {
          setDoc(doc(firestore, 'sponsor_stats', battleId), { votes: increment(1) }, { merge: true });
      }
      setHasVoted(true);
    } catch(err) { toast({ variant: 'destructive', title: 'Action Refused' }); }
    finally { setIsVoting(false); }
  };

  const handlePowerUp = async (powerup: typeof POWER_UPS[0], target: 'A' | 'B') => {
    if (!firestore || !user || !battle || battle.status !== 'live' || !wallet) return;
    
    if (boostsRemaining <= 0) {
        toast({ variant: 'destructive', title: 'Limit Reached', description: 'Maximum 5 boosts per battle. Conserve your artillery!' });
        return;
    }

    if (wallet.coins < powerup.cost) {
        toast({ variant: 'destructive', title: 'Insufficient Coins' });
        return;
    }

    const targetUserId = target === 'A' ? battle.opponentA?.userId : battle.opponentB?.userId;
    const isSubscriber = user.subscribedCreators?.includes(targetUserId);

    try {
        await spendCoins(firestore, user.id, powerup.cost, 'powerup_used', {
            battleId,
            targetSide: target,
            powerupType: powerup.type,
            targetCreatorId: targetUserId,
            userName: user.name,
            userAvatarUrl: user.avatarUrl
        });

        const bRef = doc(firestore, 'arena_battles', battleId);
        await updateDoc(bRef, { 
            [target === 'A' ? 'opponentA.votes' : 'opponentB.votes']: increment(powerup.weight), 
            [`votes.${targetUserId}`]: increment(powerup.weight) 
        });

        await addDoc(collection(firestore, 'arena_battles', battleId, 'powerups'), {
            userId: user.id,
            userName: user.name,
            target: target === 'A' ? 'opponentA' : 'opponentB',
            type: powerup.type,
            isSubscriber, 
            votesAdded: powerup.weight,
            coinsSpent: powerup.cost,
            createdAt: serverTimestamp()
        });

        if (battle.isSponsored) {
            setDoc(doc(firestore, 'sponsor_stats', battleId), { votes: increment(powerup.weight) }, { merge: true });
        }

        toast({ title: `${powerup.label} Deployed! ${powerup.emoji}` });

    } catch (err: any) { toast({ variant: 'destructive', title: 'Deployment Failed' }); }
  };

  const handleSendGift = async (gift: any, target: 'A' | 'B') => {
    if (!firestore || !user || !battle || battle.status !== 'live' || !wallet) return;
    
    if (wallet.coins < gift.cost) {
        toast({ variant: 'destructive', title: 'Insufficient Coins' });
        return;
    }

    const targetUserId = target === 'A' ? battle.opponentA?.userId : battle.opponentB?.userId;

    try {
        await spendCoins(firestore, user.id, gift.cost, 'gift_sent', {
            battleId,
            targetSide: target,
            giftType: gift.id,
            targetCreatorId: targetUserId,
            userName: user.name,
            userAvatarUrl: user.avatarUrl
        });

        await addDoc(collection(firestore, 'arena_battles', battleId, 'gifts'), {
            senderId: user.id,
            senderName: user.name,
            receiverId: targetUserId,
            giftType: gift.id,
            coinsSpent: gift.cost,
            createdAt: serverTimestamp()
        });

        if (battle.isSponsored) {
            setDoc(doc(firestore, 'sponsor_stats', battleId), { gifts: increment(1) }, { merge: true });
        }

        toast({ title: `${gift.label} Sent! ${gift.emoji}` });

    } catch (err: any) { toast({ variant: 'destructive', title: 'Gift Failed' }); }
  };

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  if (isLoadingBattle || !battle) {
    return <div className="fixed inset-0 z-[7000] bg-black flex items-center justify-center"><Loader2 className="animate-spin text-red-600" size={48} /></div>;
  }

  const p1 = battle.participantInfo[battle.opponentA.userId];
  const p2 = battle.opponentB ? battle.participantInfo[battle.opponentB.userId] : null;

  const totalVotes = (battle.opponentA.votes || 0) + (battle.opponentB?.votes || 0);
  const p1Pct = totalVotes > 0 ? ((battle.opponentA.votes || 0) / totalVotes) * 100 : 50;
  const p2Pct = 100 - p1Pct;

  const isSubscribedA = user?.subscribedCreators?.includes(battle.opponentA.userId);
  const isSubscribedB = battle.opponentB ? user?.subscribedCreators?.includes(battle.opponentB.userId) : false;

  return (
    <div className="fixed inset-0 z-[7000] bg-black flex flex-col md:flex-row overflow-hidden animate-in fade-in duration-500">
      
      {/* ── CINEMATIC OVERLAYS ────────────────────────────────────────────────── */}
      
      <AnimatePresence>
        {recentPowerUp && (
          <motion.div initial={{ opacity: 0, y: 100, scale: 0.5 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[10000] pointer-events-none w-full max-w-sm px-4">
            <div className="bg-slate-900/90 backdrop-blur-2xl border-4 border-amber-500 p-8 rounded-[3.5rem] shadow-[0_0_80px_rgba(245,158,11,0.6)] flex flex-col items-center text-center gap-4">
              <div className="text-7xl drop-shadow-[0_0_20px_rgba(245,158,11,0.8)]">{POWER_UPS.find(p => p.type === recentPowerUp.type)?.emoji}</div>
              <h4 className="text-2xl font-black text-white uppercase italic tracking-tighter">
                {recentPowerUp.userName} 
                {recentPowerUp.isSubscriber && <span className="ml-2 text-amber-500">(⭐ Subscriber)</span>} 
                sent {recentPowerUp.type.replace('_', ' ')}
              </h4>
              <div className="bg-amber-500 text-slate-950 px-6 py-2 rounded-2xl font-black text-lg">+{recentPowerUp.votesAdded} Energy</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {recentGift && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="fixed inset-0 z-[10001] pointer-events-none flex items-center justify-center bg-black/40 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.5, rotate: -10, y: 200 }} 
              animate={{ scale: [0.5, 1.2, 1], rotate: 0, y: 0 }} 
              transition={{ duration: 0.8, type: 'spring' }}
              className={cn(
                "p-12 rounded-[4rem] shadow-[0_0_100px_rgba(0,0,0,0.5)] flex flex-col items-center text-center gap-6 border-8 border-white/20 relative overflow-hidden",
                recentGift.giftType === 'elephant' ? "bg-gradient-to-br from-slate-700 via-slate-500 to-slate-800" :
                recentGift.giftType === 'throne' ? "bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600 shadow-[0_0_100px_rgba(245,158,11,0.6)]" :
                recentGift.giftType === 'dragon' ? "bg-gradient-to-br from-red-600 to-orange-600" : 
                recentGift.giftType === 'rocket' ? "bg-gradient-to-br from-indigo-600 to-blue-600" : "bg-slate-900/90"
              )}
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.2),transparent)] animate-pulse" />
              <div className="text-[12rem] drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-10">
                {(GIFTS as any)[recentGift.giftType]?.emoji}
              </div>
              <div className="z-10">
                <h4 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tighter italic leading-none mb-2">{recentGift.senderName}</h4>
                <p className="text-xl font-black text-white/80 uppercase tracking-widest italic">SENT A {(GIFTS as any)[recentGift.giftType]?.label.toUpperCase()}!</p>
              </div>
              <div className="bg-white/20 backdrop-blur-md px-8 py-3 rounded-2xl border border-white/30 z-10">
                <p className="text-xs font-black text-white uppercase tracking-[0.4em]">Creator Reward Dispatched 💰</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-[3] relative bg-slate-950 flex flex-col border-r border-white/5">
        
        {battle.isSponsored && (
            <div className="absolute top-0 left-0 right-0 z-[100] px-8 pt-4 pb-12 bg-gradient-to-b from-slate-950/90 to-transparent pointer-events-none">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4 animate-in slide-in-from-left-4 duration-1000">
                        <div className="relative w-12 h-12 rounded-2xl overflow-hidden border-2 border-amber-500/50 bg-white shadow-lg">
                            <img src={battle.sponsorLogo} alt="sponsor" className="w-full h-full object-contain p-1" />
                        </div>
                        <div>
                            <p className="text-[8px] font-black text-amber-500 uppercase tracking-[0.3em]">Sponsored by</p>
                            <h4 className="text-lg font-black text-white leading-none">{battle.sponsorName}</h4>
                        </div>
                    </div>

                    <div className="text-right animate-in slide-in-from-right-4 duration-1000">
                        <div className="bg-amber-500 text-slate-950 px-6 py-2 rounded-2xl font-black shadow-[0_0_30px_rgba(245,158,11,0.4)] border-2 border-white/20 flex flex-col items-end">
                            <span className="text-[8px] uppercase tracking-widest leading-none mb-1">Prize Pool</span>
                            <span className="text-xl italic tracking-tighter leading-none">GHS {battle.prizeAmount?.toLocaleString()}</span>
                        </div>
                    </div>
                </div>
            </div>
        )}

        <div className="absolute top-6 left-6 right-6 z-50 flex justify-between items-center mt-12 sm:mt-0">
          <button onClick={onClose} className="p-3 bg-black/40 backdrop-blur-md rounded-full text-white border border-white/10 hover:bg-black/60 shadow-xl transition-all pointer-events-auto"><X size={24}/></button>
          <div className={cn("px-6 py-2 rounded-2xl text-[10px] font-black text-white uppercase tracking-[0.3em] backdrop-blur-md border border-white/10", isWaiting ? "bg-indigo-600" : isLive ? "bg-red-600 animate-pulse" : "bg-amber-500")}>
            {isWaiting ? "DEPLOYMENT OPEN" : isLive ? "LIVE SHOWDOWN" : "CONCLUDED"}
          </div>
          <button onClick={toggleSound} className="p-3 bg-black/40 backdrop-blur-md rounded-full text-white border border-white/10 hover:bg-black/60 transition-all pointer-events-auto">
            {soundOn ? <Volume2 size={24} /> : <VolumeX size={24} />}
          </button>
        </div>

        {isWaiting && (
            <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-900 overflow-y-auto no-scrollbar pt-24">
                <div className="max-w-2xl w-full space-y-8 py-20">
                    <div className="relative aspect-video rounded-[2.5rem] overflow-hidden border-4 border-white/10 shadow-2xl bg-black group">
                        <ReactPlayer url={previewVideoUrl || battle.opponentA.videoUrl} playing={!isEnded} muted={!soundOn} width="100%" height="100%" />
                        <div className="absolute bottom-6 left-6 z-20 bg-black/40 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 text-white">
                            <p className="text-xs font-black">{p1?.name}</p>
                        </div>
                    </div>
                    <div className="text-center space-y-4">
                        <h2 className="text-3xl font-black italic text-white uppercase tracking-tighter">"{battle.title}"</h2>
                        {battle.subscriberOnly && (
                            <div className="bg-indigo-600 text-white px-6 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-2 shadow-lg">
                                <Gem size={14} /> EXCLUSIVE SUBSCRIBER BATTLE
                            </div>
                        )}
                        <div className="pt-4 flex flex-col items-center gap-4">
                            <Button onClick={() => setIsJoinModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-50 text-white px-12 py-8 rounded-[2rem] font-black text-lg shadow-2xl active:scale-95 transition-all w-full max-w-sm">JOIN CHALLENGE <UserPlus className="ml-2" /></Button>
                            
                            {/* STEP 7: PROMOTION IN WAITING ROOM */}
                            {!isSubscribedA && !isCreator && (
                                <button 
                                    onClick={() => setSubscribingTo({ id: battle.opponentA.userId, name: p1.name, avatarUrl: p1.avatarUrl, campusAcronym: p1.campusAcronym })}
                                    className="flex items-center gap-2 text-[10px] font-black text-amber-500 uppercase tracking-widest hover:underline"
                                >
                                    <Gem size={12} /> Subscribe to {p1.name} for Benefits
                                </button>
                            )}
                        </div>
                    </div>
                    {isCreator && (
                        <div className="space-y-4 pt-10">
                            <h3 className="text-white font-black uppercase text-xs tracking-widest flex items-center gap-2"><Swords size={16} className="text-indigo-500" /> Rival Queue ({challengers?.length || 0})</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {challengers?.map(c => (
                                    <div key={c.id} className="p-4 bg-white/5 border border-white/10 rounded-3xl flex items-center justify-between group hover:border-indigo-500/50 transition-all">
                                        <div className="flex items-center gap-3">
                                            <Avatar className="border-2 border-white/20"><AvatarImage src={c.avatarUrl}/></Avatar>
                                            <p className="text-sm font-black text-white">{c.userName}</p>
                                        </div>
                                        <Button size="sm" disabled={!!selectingOpponentId} onClick={() => handleSelectOpponent(c)} className="rounded-xl bg-indigo-600 text-white font-black text-[10px] uppercase shadow-lg">FIGHT</Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        )}

        {isLive && (
            <div className="flex-1 flex flex-col pt-24">
                <div className="absolute top-32 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4">
                    <div className="bg-black/60 backdrop-blur-xl p-4 rounded-[2rem] border border-white/10 shadow-2xl flex items-center justify-between gap-8">
                        <div className="text-center flex-1 flex flex-col items-center">
                            <p className="text-[8px] font-black text-blue-400 uppercase">{p1?.campusAcronym}</p>
                            <p className="text-2xl font-black text-white tabular-nums">{battle.opponentA.votes || 0}</p>
                            
                            {/* STEP 7: PROMOTION IN LIVE HUD (A) */}
                            {!isSubscribedA && user?.id !== battle.opponentA.userId && (
                                <button onClick={() => setSubscribingTo({ id: battle.opponentA.userId, name: p1.name, avatarUrl: p1.avatarUrl, campusAcronym: p1.campusAcronym })} className="mt-1 bg-amber-500 text-slate-950 px-2 py-0.5 rounded-md text-[7px] font-black uppercase tracking-tighter shadow-lg hover:scale-105 transition-transform">
                                    Subscribe
                                </button>
                            )}
                        </div>
                        <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center shadow-lg border-2 border-white/20"><Swords size={18} className="text-white" /></div>
                        <div className="text-center flex-1 flex flex-col items-center">
                            <p className="text-[8px] font-black text-amber-400 uppercase">{p2?.campusAcronym}</p>
                            <p className="text-2xl font-black text-white tabular-nums">{battle.opponentB?.votes || 0}</p>
                            
                            {/* STEP 7: PROMOTION IN LIVE HUD (B) */}
                            {!isSubscribedB && p2 && user?.id !== battle.opponentB?.userId && (
                                <button onClick={() => setSubscribingTo({ id: battle.opponentB!.userId, name: p2.name, avatarUrl: p2.avatarUrl, campusAcronym: p2.campusAcronym })} className="mt-1 bg-amber-500 text-slate-950 px-2 py-0.5 rounded-md text-[7px] font-black uppercase tracking-tighter shadow-lg hover:scale-105 transition-transform">
                                    Subscribe
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-1 md:gap-4 p-1 md:p-4 bg-slate-900">
                    <div className="relative rounded-[2.5rem] overflow-hidden border-4 border-white/5 bg-black">
                        <ReactPlayer url={battle.opponentA.videoUrl} playing={isLive} muted={!soundOn} width="100%" height="100%" />
                    </div>
                    <div className="relative rounded-[2.5rem] overflow-hidden border-4 border-white/5 bg-black">
                        <ReactPlayer url={battle.opponentB?.videoUrl} playing={isLive} muted={!soundOn} width="100%" height="100%" />
                    </div>
                </div>

                <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-full max-w-2xl px-6 z-50">
                    <div className="bg-slate-950/80 backdrop-blur-xl p-8 rounded-[3.5rem] border border-white/10 shadow-2xl">
                        <div className="h-5 bg-white/5 rounded-full overflow-hidden flex p-1 border border-white/10 mb-8 shadow-inner relative">
                            <div className="h-full bg-blue-600 transition-all duration-1000 ease-out rounded-full shadow-[0_0_15px_rgba(37,99,235,0.5)]" style={{ width: `${p1Pct}%` }} />
                            <div className="h-full bg-amber-500 transition-all duration-1000 ease-out rounded-full shadow-[0_0_15px_rgba(245,158,11,0.5)]" style={{ width: `${p2Pct}%` }} />
                        </div>
                        {!hasVoted ? (
                            <div className="grid grid-cols-2 gap-4">
                                <button onClick={() => handleVote('A')} disabled={isVoting} className="py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl transition-all active:scale-95">VOTE {p1?.campusAcronym}</button>
                                <button onClick={() => handleVote('B')} disabled={isVoting} className="py-5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl transition-all active:scale-95">VOTE {p2?.campusAcronym}</button>
                            </div>
                        ) : (
                            <div className="text-center py-5 bg-white/5 rounded-2xl border border-white/5">
                                <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.3em] flex items-center justify-center gap-2"><CheckCircle2 size={14} /> National Vote Logged</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}

        {isEnded && (
            <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-950 pt-24">
                <Trophy size={100} className="text-amber-500 mb-8 animate-bounce" />
                <h1 className="text-5xl font-black text-white italic uppercase tracking-tighter mb-10">Concluded</h1>
                {battle.aiVerdict && (
                    <div className="max-w-xl p-10 bg-slate-900 border-4 border-amber-500/30 rounded-[3rem] text-center shadow-[0_0_100px_rgba(245,158,11,0.1)]">
                        <p className="text-xl font-black italic text-indigo-50 mb-8 leading-relaxed">"{battle.aiVerdict.verdict}"</p>
                        <Button onClick={onClose} className="w-full bg-white hover:bg-slate-100 text-slate-900 font-black rounded-2xl h-16 shadow-xl active:scale-95 transition-all">Return to Arena</Button>
                    </div>
                )}
            </div>
        )}
      </div>

      <div className="flex-1 bg-slate-900 flex flex-col shadow-2xl max-h-screen">
        <div className="p-6 border-b border-white/5 bg-slate-950/50 flex justify-between items-center">
          <h3 className="text-white font-black italic uppercase truncate max-w-[120px]">{battle.title}</h3>
          <div className="flex gap-1.5 bg-black/20 p-1 rounded-2xl border border-white/5">
            <button onClick={() => setInputMode('chat')} className={cn("p-2.5 rounded-xl transition-all", inputMode === 'chat' ? "bg-blue-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300")} title="Chat"><MessageSquare size={18}/></button>
            <button onClick={() => setInputMode('boost')} className={cn("p-2.5 rounded-xl transition-all", inputMode === 'boost' ? "bg-amber-500 text-slate-950 shadow-lg" : "text-slate-500 hover:text-slate-300")} title="Power-Ups"><Zap size={18}/></button>
            <button onClick={() => setInputMode('gift')} className={cn("p-2.5 rounded-xl transition-all", inputMode === 'gift' ? "bg-pink-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300")} title="Gifts"><Gift size={18}/></button>
          </div>
        </div>

        {isLive && <SupportLeaderboard battleId={battleId} />}

        <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar bg-slate-900/50">
          {messages?.map((m) => (
            <div key={m.id} className="animate-in slide-in-from-bottom-2">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-[9px] font-black uppercase text-slate-500">{m.userName}</p>
                {m.isSubscriber && <span className="text-[8px] font-black text-amber-500 uppercase flex items-center gap-1"><Star size={8} fill="currentColor" /> Subscriber</span>}
              </div>
              <div className={cn(
                  "p-3 rounded-2xl text-slate-300 text-sm shadow-sm border",
                  m.isSubscriber ? "bg-indigo-950/30 border-indigo-500/20" : "bg-white/5 border-white/5"
              )}>
                {m.text}
              </div>
            </div>
          ))}
          <div ref={scrollRef} />
        </div>

        <div className="p-6 bg-slate-950 border-t border-white/5 flex-shrink-0">
            {inputMode === 'chat' && (
                <form onSubmit={handleSendMessage} className="flex gap-2">
                    <input value={message} onChange={e => setMessage(e.target.value)} placeholder="Drop a shade..." className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-600 font-bold transition-all shadow-inner" />
                    <button type="submit" disabled={!message.trim()} className="p-4 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-500 active:scale-90 transition-all disabled:opacity-30"><Send size={20} /></button>
                </form>
            )}

            {inputMode === 'boost' && (
                <div className="flex flex-col gap-4 animate-in slide-in-from-bottom-4">
                    <div className="flex justify-between items-center px-2">
                        <div className="flex items-center gap-2">
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Deploy Artillery</p>
                            {boostsRemaining <= 2 && (
                                <Badge variant="destructive" className="text-[8px] font-black animate-pulse">
                                    {boostsRemaining} LEFT
                                </Badge>
                            )}
                        </div>
                        <div className="flex items-center gap-1.5 bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/20">
                            <Zap size={10} className="text-amber-500" fill="currentColor" />
                            <span className="text-[10px] font-black text-amber-500">{wallet?.coins || 0}</span>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        {POWER_UPS.map(up => (
                            <button 
                                key={up.type} 
                                onClick={() => { handlePowerUp(up, 'A'); }} 
                                disabled={boostsRemaining <= 0}
                                className={cn(
                                    "flex flex-col items-center gap-1 p-3 bg-white/5 border border-white/10 rounded-2xl transition-all active:scale-95 group",
                                    boostsRemaining <= 0 ? "opacity-30 grayscale cursor-not-allowed" : "hover:bg-white/10 hover:border-amber-500/30"
                                )}
                            >
                                <span className="text-2xl group-active:scale-150 transition-transform inline-block drop-shadow-[0_0_10px_rgba(245,158,11,0.3)]">{up.emoji}</span>
                                <div className="text-center">
                                    <p className="text-[8px] font-black text-white uppercase">{up.label}</p>
                                    <div className="mt-1 flex items-center justify-center gap-1">
                                        <Zap size={8} className="text-amber-500" fill="currentColor" />
                                        <span className="text-[8px] font-black text-slate-400">{up.cost}</span>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {inputMode === 'gift' && (
                <div className="flex flex-col gap-4 animate-in slide-in-from-bottom-4">
                    <div className="flex justify-between items-center px-2">
                        <p className="text-[10px] font-black text-pink-500 uppercase tracking-widest">Send Appreciation</p>
                        <div className="flex items-center gap-1.5 bg-pink-500/10 px-2 py-1 rounded-lg border border-pink-500/20">
                            <Zap size={10} className="text-pink-500" fill="currentColor" />
                            <span className="text-[10px] font-black text-pink-500">{wallet?.coins || 0}</span>
                        </div>
                    </div>
                    <ScrollArea className="w-full">
                        <div className="flex flex-col gap-4 pb-2">
                            <div className="flex gap-2">
                                {Object.values(GIFTS).slice(0, 5).map(gift => (
                                    <button 
                                        key={gift.id} 
                                        onClick={() => handleSendGift(gift, 'A')}
                                        className="flex-shrink-0 flex flex-col items-center gap-1 p-4 bg-white/5 border border-white/10 rounded-3xl hover:bg-pink-500/10 hover:border-pink-500/30 transition-all active:scale-90 group"
                                    >
                                        <span className="text-3xl group-hover:scale-125 transition-transform drop-shadow-[0_0_15px_rgba(236,72,153,0.3)]">{gift.emoji}</span>
                                        <p className="text-[8px] font-black text-white uppercase mt-1">{gift.label}</p>
                                        <div className="mt-1 flex items-center gap-1">
                                            <Zap size={8} className="text-amber-500" fill="currentColor" />
                                            <span className="text-[8px] font-black text-slate-400">{gift.cost}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>

                            <div className="p-4 bg-gradient-to-br from-amber-500/10 to-purple-600/10 rounded-3xl border-2 border-dashed border-amber-500/30">
                                <div className="flex items-center gap-2 mb-3">
                                    <Sparkles size={12} className="text-amber-500" />
                                    <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest">Tournament Tier</span>
                                </div>
                                <div className="flex gap-3">
                                    {Object.values(GIFTS).slice(5).map(gift => (
                                        <button 
                                            key={gift.id} 
                                            onClick={() => handleSendGift(gift, 'A')}
                                            className="flex-1 flex flex-col items-center gap-1 p-4 bg-slate-900 border-2 border-amber-500/50 rounded-[2rem] hover:bg-slate-800 transition-all active:scale-95 group shadow-xl"
                                        >
                                            <span className="text-5xl group-hover:scale-110 transition-transform drop-shadow-[0_0_20px_rgba(245,158,11,0.4)]">{gift.emoji}</span>
                                            <p className="text-[9px] font-black text-amber-400 uppercase mt-2">{gift.label}</p>
                                            <div className="mt-1 flex items-center gap-1">
                                                <Zap size={10} className="text-amber-500" fill="currentColor" />
                                                <span className="text-sm font-black text-white">{gift.cost}</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                </div>
            )}
        </div>
      </div>

      <JoinBattleModal battle={battle} isOpen={isJoinModalOpen} onClose={() => setIsJoinModalOpen(false)} />
      
      {/* STEP 7: LIVE PROMOTION DIALOG */}
      {subscribingTo && (
          <CreatorSubscribeDialog 
            creator={subscribingTo}
            isOpen={!!subscribingTo}
            onClose={() => setSubscribingTo(null)}
          />
      )}
    </div>
  );
}
