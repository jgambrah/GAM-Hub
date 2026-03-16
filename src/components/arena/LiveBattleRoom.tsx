
'use client';

/**
 * LiveBattleRoom Component
 * -----------------------
 * Elite National Arena Stage.
 * Now expanded with STEP 10: WIN STREAK PRESTIGE 👑🔥
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  collection, query, orderBy, limitToLast, 
  serverTimestamp, addDoc, updateDoc, 
  increment, doc, getDoc, onSnapshot, writeBatch, limit, where, setDoc
} from 'firebase/firestore';
import { useFirebase, useCollection, useMemoFirebase, useDoc, updateDocumentNonBlocking } from '@/firebase';
import { useAuth } from '@/hooks/use-auth';
import { useSound } from '@/context/SoundContext';
import type { ArenaBattle, BattleMessage, ArenaChallenger, HubWallet, ArenaGift, GiftLeaderboardEntry, ArenaLeaderboard } from '@/lib/types';
import { 
  X, Swords, Users, Send, Zap, 
  Loader2, MessageSquare, Trophy, ShieldCheck, Target, Volume2, VolumeX, CheckCircle2, UserPlus, Star, Crown, AlertTriangle, Gift, Rocket, Medal, Sparkles, Building2, Megaphone, Gem, ShieldAlert, Flame
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
import { ReportContentDialog } from '../social/ReportContentDialog';
import { registerUserDevice, logSuspiciousActivity, trackUserBehavior, isBotSuspicionCheck } from '@/lib/fraud-protection';

const POWER_UPS = [
    { type: 'fire', label: 'Fire Boost', emoji: '🔥', weight: 5, cost: 10 },
    { type: 'mic_drop', label: 'Mic Drop', emoji: '🎤', weight: 10, cost: 25 },
    { type: 'crown', label: 'Crown Boost', emoji: '👑', weight: 20, cost: 50 },
    { type: 'knockout', label: 'Knockout', emoji: '⚡', weight: 50, cost: 120 },
];

function StreakBadge({ streak, losses }: { streak: number, losses?: number }) {
    if (streak < 2 && (losses || 0) > 0) return null;
    
    return (
        <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={cn(
                "flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest shadow-xl border-2",
                streak >= 5 ? "bg-amber-500 text-slate-950 border-white/20 animate-pulse" : "bg-red-600 text-white border-white/10"
            )}
        >
            {streak >= 10 ? <Crown size={10} /> : streak > 0 ? <Flame size={10} fill="currentColor" /> : <ShieldCheck size={10} />}
            {streak >= 5 && losses === 0 ? "UNDEFEATED TODAY" : `${streak} WIN STREAK`}
        </motion.div>
    );
}

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
  const { user, campus, isAdmin } = useAuth();
  const { soundOn, toggleSound } = useSound();
  const { toast } = useToast();
  
  const [inputMode, setInputMode] = useState<'chat' | 'boost' | 'gift'>('chat');
  const [message, setMessage] = useState('');
  const [isVoting, setIsVoting] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [selectingOpponentId, setSelectingOpponentId] = useState<string | null>(null);
  const [recentPowerUp, setRecentPowerUp] = useState<any>(null);
  const [recentGift, setRecentGift] = useState<ArenaGift | null>(null);
  const [subscribingTo, setSubscribingTo] = useState<any | null>(null);
  const [showReport, setShowReport] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  const battleRef = useMemoFirebase(() => {
    if (!firestore || !battleId) return null;
    return doc(firestore, 'arena_battles', battleId);
  }, [firestore, battleId]);

  const { data: battle, isLoading: isLoadingBattle } = useDoc<ArenaBattle>(battleRef);

  // 📈 STEP 10: Participant Streaks Sync
  const p1StreakRef = useMemoFirebase(() => {
      if (!firestore || !battle?.opponentA.userId) return null;
      return doc(firestore, 'arena_leaderboard', battle.opponentA.userId);
  }, [firestore, battle?.opponentA.userId]);
  const p2StreakRef = useMemoFirebase(() => {
      if (!firestore || !battle?.opponentB?.userId) return null;
      return doc(firestore, 'arena_leaderboard', battle.opponentB.userId);
  }, [firestore, battle?.opponentB?.userId]);

  const { data: p1Stats } = useDoc<ArenaLeaderboard>(p1StreakRef);
  const { data: p2Stats } = useDoc<ArenaLeaderboard>(p2StreakRef);

  const isCreator = user?.id === battle?.creatorId;
  const isWaiting = battle?.status === 'waiting';
  const isLive = battle?.status === 'live';
  const isEnded = battle?.status === 'ended';
  const isUnderReview = battle?.status === 'under_review';

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
    if (firestore && user?.id) {
        registerUserDevice(firestore, user.id);
    }
  }, [firestore, user?.id]);

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

  // ⚖️ MODERATION: Auto-flagging logic
  useEffect(() => {
      if (!firestore || !battleId || !battle) return;
      if (battle.reportCount && battle.reportCount >= 5 && battle.status !== 'under_review') {
          updateDocumentNonBlocking(doc(firestore, 'arena_battles', battleId), { 
              status: 'under_review',
              flaggedAt: serverTimestamp() 
          });
          toast({ variant: 'destructive', title: "Security Intervention", description: "Battle has been paused for moderation review." });
      }
  }, [battle?.reportCount, battleId, firestore]);

  const handleSelectOpponent = async (challenger: ArenaChallenger) => {
    if (!firestore || !battle || !user || battle.creatorId !== user.id) return;
    setSelectingOpponentId(challenger.id);

    try {
        const rivalRef = doc(firestore, "arena_leaderboard", challenger.userId);
        const rivalSnap = await getDoc(rivalRef);
        const rivalStreak = rivalSnap.exists() ? (rivalSnap.data()?.winStreak || 0) : 0;

        const batch = writeBatch(firestore);
        const bRef = doc(firestore, 'arena_battles', battleId);
        batch.update(bRef, {
            status: 'live',
            opponentB: { userId: challenger.userId, videoUrl: challenger.videoUrl, votes: 0, winStreak: rivalStreak },
            participants: [battle.creatorId, challenger.userId],
            [`participantInfo.${challenger.userId}`]: {
                name: challenger.userName,
                avatarUrl: challenger.avatarUrl,
                campusAcronym: challenger.campusAcronym,
                primaryColor: '#ef4444',
                winStreak: rivalStreak
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
    if (!firestore || !user || isVoting || !battle || battle.status !== 'live') return;
    
    const isBlocked = await isBotSuspicionCheck(firestore, user.id);
    if (isBlocked) {
        toast({ variant: 'destructive', title: 'Account Restricted', description: 'Suspicious engagement patterns detected. Contact Liaison support.' });
        return;
    }

    const targetUserId = target === 'A' ? battle.opponentA?.userId : battle.opponentB?.userId;
    if (!targetUserId) return;

    setIsVoting(true);

    try {
      const voteAuditRef = doc(firestore, 'battle_votes', battleId, 'users', user.id);
      const auditSnap = await getDoc(voteAuditRef);
      const now = Date.now();

      if (auditSnap.exists()) {
          const data = auditSnap.data();
          const lastVote = data.lastVoteTime?.toMillis?.() || 0;
          const voteCount = data.voteCount || 0;

          if (now - lastVote < 10000) {
              toast({ variant: 'destructive', title: 'Voting too fast!', description: 'Please wait 10s between energy contributions.' });
              setIsVoting(false);
              return;
          }

          if (voteCount > 50) {
              logSuspiciousActivity(firestore, {
                  type: 'suspicious_votes',
                  userId: user.id,
                  battleId,
                  details: `User has contributed ${voteCount + 1} votes to battle ${battleId}. Threshold exceeded.`
              });
          }
      }

      const batch = writeBatch(firestore);
      batch.set(voteAuditRef, {
          lastVoteTime: serverTimestamp(),
          voteCount: increment(1)
      }, { merge: true });

      const battleRef = doc(firestore, 'arena_battles', battleId);
      batch.update(battleRef, { 
          [target === 'A' ? 'opponentA.votes' : 'opponentB.votes']: increment(1), 
          [`votes.${targetUserId}`]: increment(1) 
      });

      if (battle.isSponsored) {
          const sponsorStatsRef = doc(firestore, 'sponsor_stats', battleId);
          batch.set(sponsorStatsRef, { votes: increment(1) }, { merge: true });
      }

      await batch.commit();
      trackUserBehavior(firestore, user.id, 'vote');
      toast({ title: "Energy Contributed! ⚡" });

    } catch(err) { 
        console.error(err);
        toast({ variant: 'destructive', title: 'Action Refused' }); 
    } finally { 
        setIsVoting(false); 
    }
  };

  const handlePowerUp = async (powerup: typeof POWER_UPS[0], target: 'A' | 'B') => {
    if (!firestore || !user || !battle || battle.status !== 'live' || !wallet) return;
    
    const isBlocked = await isBotSuspicionCheck(firestore, user.id);
    if (isBlocked) return;

    if (boostsRemaining <= 0) {
        toast({ variant: 'destructive', title: 'Limit Reached', description: 'Maximum 5 boosts per battle.' });
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

        trackUserBehavior(firestore, user.id, 'gift');
        toast({ title: `${powerup.label} Deployed! ${powerup.emoji}` });

    } catch (err: any) { toast({ variant: 'destructive', title: 'Deployment Failed' }); }
  };

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  if (isLoadingBattle || !battle) {
    return <div className="fixed inset-0 z-[7000] bg-black flex items-center justify-center"><Loader2 className="animate-spin text-red-600" size={48} /></div>;
  }

  // ⚖️ MODERATION: Gated view for under review content
  if (isUnderReview && !isAdmin && !isCreator) {
      return (
          <div className="fixed inset-0 z-[7000] bg-slate-950 flex flex-col items-center justify-center p-10 text-center space-y-6">
              <div className="p-8 bg-red-600 rounded-full shadow-[0_0_50px_rgba(220,38,38,0.4)]">
                  <ShieldAlert size={64} className="text-white animate-pulse" />
              </div>
              <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter">Ring Restricted</h2>
              <p className="text-slate-400 max-w-sm font-medium leading-relaxed">
                  This battle has been flagged by multiple citizens and is currently under security review by the National Liaison.
              </p>
              <Button onClick={onClose} className="bg-white text-slate-900 font-black rounded-2xl px-10 py-6 h-auto">Return to Yard</Button>
          </div>
      );
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
      
      <div className="flex-[3] relative bg-slate-950 flex flex-col border-r border-white/5">
        
        {battle.isSponsored && (
            <div className="absolute top-0 left-0 right-0 z-[100] px-8 pt-4 pb-12 bg-gradient-to-b from-slate-950/90 to-transparent pointer-events-none">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="relative w-12 h-12 rounded-2xl overflow-hidden border-2 border-amber-500/50 bg-white shadow-lg">
                            <img src={battle.sponsorLogo} alt="sponsor" className="w-full h-full object-contain p-1" />
                        </div>
                        <div>
                            <p className="text-[8px] font-black text-amber-500 uppercase tracking-[0.3em]">Sponsored by</p>
                            <h4 className="text-lg font-black text-white leading-none">{battle.sponsorName}</h4>
                        </div>
                    </div>
                    <div className="bg-amber-500 text-slate-950 px-6 py-2 rounded-2xl font-black shadow-[0_0_30px_rgba(245,158,11,0.4)] border-2 border-white/20 flex flex-col items-end">
                        <span className="text-[8px] uppercase tracking-widest leading-none mb-1">Prize Pool</span>
                        <span className="text-xl italic tracking-tighter leading-none">GHS {battle.prizeAmount?.toLocaleString()}</span>
                    </div>
                </div>
            </div>
        )}

        <div className="absolute top-6 left-6 right-6 z-50 flex justify-between items-center mt-12 sm:mt-0">
          <div className="flex gap-2">
            <button onClick={onClose} className="p-3 bg-black/40 backdrop-blur-md rounded-full text-white border border-white/10 hover:bg-black/60 shadow-xl transition-all"><X size={24}/></button>
            <button 
                onClick={() => setShowReport(true)}
                className="p-3 bg-red-600/40 backdrop-blur-md rounded-full text-white border border-red-500/20 hover:bg-red-600 transition-all shadow-xl"
                title="Report Battle"
            >
                <ShieldAlert size={24}/>
            </button>
          </div>
          <div className={cn("px-6 py-2 rounded-2xl text-[10px] font-black text-white uppercase tracking-[0.3em] backdrop-blur-md border border-white/10", isWaiting ? "bg-indigo-600" : isLive ? "bg-red-600 animate-pulse" : "bg-amber-500")}>
            {isWaiting ? "DEPLOYMENT OPEN" : isLive ? "LIVE SHOWDOWN" : "CONCLUDED"}
          </div>
          <button onClick={toggleSound} className="p-3 bg-black/40 backdrop-blur-md rounded-full text-white border border-white/10 hover:bg-black/60 transition-all">
            {soundOn ? <Volume2 size={24} /> : <VolumeX size={24} />}
          </button>
        </div>

        {isWaiting && (
            <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-900 overflow-y-auto no-scrollbar pt-24">
                <div className="max-w-2xl w-full space-y-8 py-20">
                    <div className="relative aspect-video rounded-[2.5rem] overflow-hidden border-4 border-white/10 shadow-2xl bg-black group">
                        <ReactPlayer url={battle.opponentA.videoUrl} playing={!isEnded} muted={!soundOn} width="100%" height="100%" />
                        <div className="absolute bottom-6 left-6 z-20 flex flex-col gap-2">
                            <StreakBadge streak={p1Stats?.winStreak || 0} losses={p1Stats?.losses} />
                            <div className="bg-black/40 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 text-white">
                                <p className="text-xs font-black">{p1?.name}</p>
                            </div>
                        </div>
                    </div>
                    <div className="text-center space-y-4">
                        <h2 className="text-3xl font-black italic text-white uppercase tracking-tighter">"{battle.title}"</h2>
                        <div className="pt-4 flex flex-col items-center gap-4">
                            <Button onClick={() => setIsJoinModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-50 text-white px-12 py-8 rounded-[2rem] font-black text-lg shadow-2xl active:scale-95 transition-all w-full max-w-sm">JOIN CHALLENGE <UserPlus className="ml-2" /></Button>
                        </div>
                    </div>
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
                        </div>
                        <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center shadow-lg border-2 border-white/20"><Swords size={18} className="text-white" /></div>
                        <div className="text-center flex-1 flex flex-col items-center">
                            <p className="text-[8px] font-black text-amber-400 uppercase">{p2?.campusAcronym}</p>
                            <p className="text-2xl font-black text-white tabular-nums">{battle.opponentB?.votes || 0}</p>
                        </div>
                    </div>
                </div>

                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-1 md:gap-4 p-1 md:p-4 bg-slate-900">
                    <div className="relative rounded-[2.5rem] overflow-hidden border-4 border-white/5 bg-black">
                        <ReactPlayer url={battle.opponentA.videoUrl} playing={isLive} muted={!soundOn} width="100%" height="100%" />
                        <div className="absolute bottom-6 left-6 z-20">
                            <StreakBadge streak={p1Stats?.winStreak || 0} losses={p1Stats?.losses} />
                        </div>
                    </div>
                    <div className="relative rounded-[2.5rem] overflow-hidden border-4 border-white/5 bg-black">
                        <ReactPlayer url={battle.opponentB?.videoUrl} playing={isLive} muted={!soundOn} width="100%" height="100%" />
                        <div className="absolute bottom-6 right-6 z-20">
                            <StreakBadge streak={p2Stats?.winStreak || 0} losses={p2Stats?.losses} />
                        </div>
                    </div>
                </div>

                <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-full max-w-2xl px-6 z-50">
                    <div className="bg-slate-950/80 backdrop-blur-xl p-8 rounded-[3.5rem] border border-white/10 shadow-2xl">
                        <div className="h-5 bg-white/5 rounded-full overflow-hidden flex p-1 border border-white/10 mb-8 shadow-inner relative">
                            <div className="h-full bg-blue-600 transition-all duration-1000 ease-out rounded-full" style={{ width: `${p1Pct}%` }} />
                            <div className="h-full bg-amber-500 transition-all duration-1000 ease-out rounded-full" style={{ width: `${p2Pct}%` }} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <button onClick={() => handleVote('A')} disabled={isVoting} className="py-5 bg-blue-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl transition-all active:scale-95">VOTE {p1?.campusAcronym}</button>
                            <button onClick={() => handleVote('B')} disabled={isVoting} className="py-5 bg-amber-500 text-slate-950 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl transition-all active:scale-95">VOTE {p2?.campusAcronym}</button>
                        </div>
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

      {/* CHAT INTERFACE AND OTHER ELEMENTS */}
      
      <JoinBattleModal battle={battle} isOpen={isJoinModalOpen} onClose={() => setIsJoinModalOpen(false)} />
      
      {showReport && (
          <ReportContentDialog 
            targetId={battleId} 
            targetType="battle" 
            reportedUserId={battle.creatorId} 
            isOpen={showReport} 
            onClose={() => setShowReport(false)} 
          />
      )}
    </div>
  );
}
