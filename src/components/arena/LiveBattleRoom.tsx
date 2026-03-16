
'use client';

/**
 * LiveBattleRoom Component
 * -----------------------
 * Elite National Arena Stage.
 * Finalized with STEP 12: ARENA GIFT COMBO SYSTEM & ACHIEVEMENTS ⚡🔥
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
import type { ArenaBattle, BattleMessage, ArenaChallenger, HubWallet, ArenaGift, GiftLeaderboardEntry, ArenaLeaderboard, GiftCombo, BattleComboLeader } from '@/lib/types';
import { 
  X, Swords, Users, Send, Zap, 
  Loader2, MessageSquare, Trophy, ShieldCheck, Target, Volume2, VolumeX, CheckCircle2, UserPlus, Star, Crown, AlertTriangle, Gift, Rocket, Medal, Sparkles, Building2, Megaphone, Gem, ShieldAlert, Flame, Coins
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
import { registerUserDevice, isBotSuspicionCheck, trackUserBehavior } from '@/lib/fraud-protection';

const POWER_UPS = [
    { type: 'fire', label: 'Fire Boost', emoji: '🔥', weight: 5, cost: 10 },
    { type: 'mic_drop', label: 'Mic Drop', emoji: '🎤', weight: 10, cost: 25 },
    { type: 'crown', label: 'Crown Boost', emoji: '👑', weight: 20, cost: 50 },
    { type: 'knockout', label: 'Knockout', emoji: '⚡', weight: 50, cost: 120 },
];

const MAX_BOOSTS_PER_USER = 10;
const COMBO_WINDOW_MS = 4000; // Step 12: 4-second reset rule

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

function ComboLeaderboard({ battleId }: { battleId: string }) {
    const { firestore } = useFirebase();
    const comboLeadersQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'battle_combo_leaders', battleId, 'leaders'), orderBy('combo', 'desc'), limit(3));
    }, [firestore, battleId]);
    const { data: leaders } = useCollection<any>(comboLeadersQuery);

    if (!leaders || leaders.length === 0) return null;

    return (
        <div className="bg-slate-950/50 p-4 rounded-2xl border border-white/5 mb-4 animate-in slide-in-from-right-2">
            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                <Flame size={10} className="text-red-500" /> Peak Combo Heat
            </p>
            <div className="space-y-2">
                {leaders.map((l: any, i: number) => (
                    <div key={l.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-slate-600">#{i+1}</span>
                            <span className="text-[10px] font-bold text-white truncate max-w-[80px]">{l.userName}</span>
                        </div>
                        <span className="text-[10px] font-black text-amber-500 italic">x{l.combo}</span>
                    </div>
                ))}
            </div>
        </div>
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
  const [activeCombo, setActiveCombo] = useState<GiftCombo | null>(null);
  const [recentPowerUp, setRecentPowerUp] = useState<any>(null);
  const [subscribingTo, setSubscribingTo] = useState<any | null>(null);
  const [showReport, setShowReport] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  const battleRef = useMemoFirebase(() => {
    if (!firestore || !battleId) return null;
    return doc(firestore, 'arena_battles', battleId);
  }, [firestore, battleId]);

  const { data: battle, isLoading: isLoadingBattle } = useDoc<ArenaBattle>(battleRef);

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

  const isLive = battle?.status === 'live';
  const isWaiting = battle?.status === 'waiting';
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

  const messagesQuery = useMemoFirebase(() => 
    firestore ? query(
      collection(firestore, "arena_battles", battleId, "messages"),
      orderBy("createdAt", "asc"),
      limitToLast(50)
    ) : null
  , [firestore, battleId]);
  
  const { data: messages } = useCollection<BattleMessage>(messagesQuery);

  useEffect(() => {
    if (!firestore || !battleId || !user?.id || !isLive) return;
    
    const comboId = `${battleId}_${user.id}`;
    const unsub = onSnapshot(doc(firestore, 'gift_combos', comboId), (snap) => {
        if (snap.exists()) {
            const data = snap.data() as GiftCombo;
            const now = Date.now();
            const lastTime = data.lastGiftTime?.toMillis?.() || 0;
            if (now - lastTime > COMBO_WINDOW_MS) setActiveCombo(null);
            else setActiveCombo(data);
        } else setActiveCombo(null);
    });
    return () => unsub();
  }, [firestore, battleId, user?.id, isLive]);

  const handlePowerUp = async (powerup: typeof POWER_UPS[0], target: 'A' | 'B') => {
    if (!firestore || !user || !battle || battle.status !== 'live' || !wallet) return;
    
    const isBlocked = await isBotSuspicionCheck(firestore, user.id);
    if (isBlocked) return;

    if (wallet.coins < powerup.cost) {
        toast({ variant: 'destructive', title: 'Insufficient Artillery', description: 'Refill your coins to deploy gifts.' });
        return;
    }

    const targetUserId = target === 'A' ? battle.opponentA?.userId : battle.opponentB?.userId;
    const isSubscriber = user.subscribedCreators?.includes(targetUserId);

    try {
        const comboId = `${battleId}_${user.id}`;
        const comboRef = doc(firestore, 'gift_combos', comboId);
        const comboSnap = await getDoc(comboRef);
        
        let comboCount = 1;
        let multiplier = 1.0;
        const now = Date.now();

        if (comboSnap.exists()) {
            const data = comboSnap.data() as GiftCombo;
            const lastTime = data.lastGiftTime?.toMillis?.() || 0;
            if (now - lastTime < COMBO_WINDOW_MS) {
                comboCount = data.comboCount + 1;
            }
        }

        if (comboCount >= 50) multiplier = 3.0;
        else if (comboCount >= 20) multiplier = 2.0;
        else if (comboCount >= 10) multiplier = 1.5;
        else if (comboCount >= 5) multiplier = 1.2;

        const votesWithMultiplier = Math.floor(powerup.weight * multiplier);

        await spendCoins(firestore, user.id, powerup.cost, 'powerup_used', {
            battleId,
            targetSide: target,
            powerupType: powerup.type,
            targetCreatorId: targetUserId,
            userName: user.name,
            userAvatarUrl: user.avatarUrl,
            comboCount,
            multiplier
        });

        const batch = writeBatch(firestore);
        batch.update(doc(firestore, 'arena_battles', battleId), { 
            [target === 'A' ? 'opponentA.votes' : 'opponentB.votes']: increment(votesWithMultiplier), 
            [`votes.${targetUserId}`]: increment(votesWithMultiplier) 
        });

        batch.set(comboRef, {
            userId: user.id,
            battleId,
            giftType: powerup.type,
            comboCount,
            comboMultiplier: multiplier,
            lastGiftTime: serverTimestamp()
        }, { merge: true });

        // 🏆 COMBO LEADERBOARD HANDSHAKE
        const comboLeaderRef = doc(firestore, 'battle_combo_leaders', battleId, 'leaders', user.id);
        const leaderSnap = await getDoc(comboLeaderRef);
        if (!leaderSnap.exists() || (leaderSnap.data().combo < comboCount)) {
            batch.set(comboLeaderRef, { userId: user.id, userName: user.name, combo: comboCount, updatedAt: serverTimestamp() }, { merge: true });
        }

        // 💎 ACHIEVEMENTS HANDSHAKE
        if (comboCount >= 10 || comboCount === 25 || comboCount === 50) {
            const achievementRef = doc(firestore, 'user_achievements', user.id);
            const achievementUpdate: any = { updatedAt: serverTimestamp() };
            let milestoneMsg = "";
            if (comboCount === 10) { achievementUpdate.fireStarter = true; milestoneMsg = "🔥 FIRE STORM x10! " + user.name + " is heating up!"; }
            if (comboCount === 25) { achievementUpdate.giftMachine = true; milestoneMsg = "🚀 GIFT MACHINE x25! " + user.name + " is on a rampage!"; }
            if (comboCount === 50) { achievementUpdate.arenaLegend = true; milestoneMsg = "👑 ARENA LEGEND x50! salute the King " + user.name + "!"; }
            
            if (milestoneMsg) {
                batch.set(achievementRef, achievementUpdate, { merge: true });
                batch.set(doc(collection(firestore, "arena_battles", battleId, "messages")), {
                    userId: 'system', userName: 'NATIONAL HUB', text: milestoneMsg, createdAt: serverTimestamp()
                });
            }
        }

        await batch.commit();
        trackUserBehavior(firestore, user.id, 'gift');
        
    } catch (err: any) { console.error(err); }
  };

  const handleVote = async (target: 'A' | 'B') => {
    if (!firestore || !user || isVoting || !battle || battle.status !== 'live') return;
    const isBlocked = await isBotSuspicionCheck(firestore, user.id);
    if (isBlocked) return;

    const targetUserId = target === 'A' ? battle.opponentA?.userId : battle.opponentB?.userId;
    if (!targetUserId) return;

    setIsVoting(true);
    try {
      const voteAuditRef = doc(firestore, 'battle_votes', battleId, 'users', user.id);
      const auditSnap = await getDoc(voteAuditRef);
      const now = Date.now();

      if (auditSnap.exists()) {
          const lastVote = auditSnap.data().lastVoteTime?.toMillis?.() || 0;
          if (now - lastVote < 10000) { toast({ variant: 'destructive', title: 'Energy Recharging...' }); setIsVoting(false); return; }
      }

      const batch = writeBatch(firestore);
      batch.set(voteAuditRef, { lastVoteTime: serverTimestamp(), voteCount: increment(1) }, { merge: true });
      batch.update(doc(firestore, 'arena_battles', battleId), { [target === 'A' ? 'opponentA.votes' : 'opponentB.votes']: increment(1), [`votes.${targetUserId}`]: increment(1) });
      await batch.commit();
      trackUserBehavior(firestore, user.id, 'vote');
    } catch(err) { toast({ variant: 'destructive', title: 'Refused' }); }
    finally { setIsVoting(false); }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !firestore || !user || battle.status === 'ended') return;
    const isSub = user.subscribedCreators?.includes(battle.opponentA.userId) || (battle.opponentB && user.subscribedCreators?.includes(battle.opponentB.userId));
    addDoc(collection(firestore, "arena_battles", battleId, "messages"), { userId: user.id, userName: user.name, text: message.trim(), isSubscriber: !!isSub, createdAt: serverTimestamp() });
    setMessage('');
  };

  if (isLoadingBattle || !battle) return <div className="fixed inset-0 z-[7000] bg-black flex items-center justify-center"><Loader2 className="animate-spin text-red-600" size={48} /></div>;

  const p1 = battle.participantInfo[battle.opponentA.userId];
  const p2 = battle.opponentB ? battle.participantInfo[battle.opponentB.userId] : null;
  const totalVotes = (battle.opponentA.votes || 0) + (battle.opponentB?.votes || 0);
  const p1Pct = totalVotes > 0 ? ((battle.opponentA.votes || 0) / totalVotes) * 100 : 50;
  const p2Pct = 100 - p1Pct;

  return (
    <div className="fixed inset-0 z-[7000] bg-black flex flex-col md:flex-row overflow-hidden animate-in fade-in duration-500">
      
      <div className="flex-[3] relative bg-slate-950 flex flex-col border-r border-white/5">
        
        {battle.isSponsored && (
            <div className="absolute top-0 left-0 right-0 z-[100] px-8 pt-4 pb-12 bg-gradient-to-b from-slate-950/90 to-transparent pointer-events-none">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="relative w-12 h-12 rounded-2xl overflow-hidden border-2 border-amber-500/50 bg-white shadow-lg"><img src={battle.sponsorLogo} alt="sponsor" className="w-full h-full object-contain p-1" /></div>
                        <div><p className="text-[8px] font-black text-amber-500 uppercase tracking-[0.3em]">Sponsored by</p><h4 className="text-lg font-black text-white">{battle.sponsorName}</h4></div>
                    </div>
                    <div className="bg-amber-500 text-slate-950 px-6 py-2 rounded-2xl font-black shadow-lg border-2 border-white/20 flex flex-col items-end"><span className="text-[8px] uppercase tracking-widest">Prize Pool</span><span className="text-xl italic tracking-tighter leading-none">GHS {battle.prizeAmount}</span></div>
                </div>
            </div>
        )}

        <div className="absolute top-6 left-6 right-6 z-50 flex justify-between items-center mt-12 sm:mt-0">
          <div className="flex gap-2">
            <button onClick={onClose} className="p-3 bg-black/40 backdrop-blur-md rounded-full text-white border border-white/10 hover:bg-black/60 shadow-xl transition-all"><X size={24}/></button>
            <button onClick={() => setShowReport(true)} className="p-3 bg-red-600/40 backdrop-blur-md rounded-full text-white border border-red-500/20 hover:bg-red-600 shadow-xl"><ShieldAlert size={24}/></button>
          </div>
          <div className={cn("px-6 py-2 rounded-2xl text-[10px] font-black text-white uppercase tracking-[0.3em] backdrop-blur-md border border-white/10", isWaiting ? "bg-indigo-600" : isLive ? "bg-red-600 animate-pulse" : "bg-amber-500")}>
            {isWaiting ? "DEPLOYMENT OPEN" : isLive ? "LIVE SHOWDOWN" : "CONCLUDED"}
          </div>
          <button onClick={toggleSound} className="p-3 bg-black/40 backdrop-blur-md rounded-full text-white border border-white/10 hover:bg-black/60 transition-all">{soundOn ? <Volume2 size={24} /> : <VolumeX size={24} />}</button>
        </div>

        {isLive && (
            <div className="flex-1 flex flex-col pt-24">
                <div className="absolute top-32 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4">
                    <div className="bg-black/60 backdrop-blur-xl p-4 rounded-[2rem] border border-white/10 shadow-2xl flex items-center justify-between gap-8">
                        <div className="text-center flex-1 flex flex-col items-center"><p className="text-[8px] font-black text-blue-400 uppercase">{p1?.campusAcronym}</p><p className="text-2xl font-black text-white tabular-nums">{battle.opponentA.votes || 0}</p></div>
                        <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center shadow-lg border-2 border-white/20"><Swords size={18} className="text-white" /></div>
                        <div className="text-center flex-1 flex flex-col items-center"><p className="text-[8px] font-black text-amber-400 uppercase">{p2?.campusAcronym}</p><p className="text-2xl font-black text-white tabular-nums">{battle.opponentB?.votes || 0}</p></div>
                    </div>
                </div>

                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-1 md:gap-4 p-1 md:p-4 bg-slate-900">
                    <div className="relative rounded-[2.5rem] overflow-hidden border-4 border-white/5 bg-black"><ReactPlayer url={battle.opponentA.videoUrl} playing={isLive} muted={!soundOn} width="100%" height="100%" /><div className="absolute bottom-6 left-6 z-20"><StreakBadge streak={p1Stats?.winStreak || 0} losses={p1Stats?.losses} /></div></div>
                    <div className="relative rounded-[2.5rem] overflow-hidden border-4 border-white/5 bg-black"><ReactPlayer url={battle.opponentB?.videoUrl} playing={isLive} muted={!soundOn} width="100%" height="100%" /><div className="absolute bottom-6 right-6 z-20"><StreakBadge streak={p2Stats?.winStreak || 0} losses={p2Stats?.losses} /></div></div>
                </div>

                <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-full max-w-2xl px-6 z-50">
                    <div className="bg-slate-950/80 backdrop-blur-xl p-8 rounded-[3.5rem] border border-white/10 shadow-2xl">
                        <AnimatePresence>
                            {activeCombo && activeCombo.comboCount >= 2 && (
                                <motion.div initial={{ scale: 0.5, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 1.5, opacity: 0 }} className="absolute -top-16 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none">
                                    <div className={cn("px-6 py-2 rounded-2xl font-black italic text-xl shadow-2xl flex items-center gap-2 border-2", activeCombo.comboCount >= 50 ? "bg-red-600 text-white border-white/30" : activeCombo.comboCount >= 25 ? "bg-purple-600 text-white" : activeCombo.comboCount >= 10 ? "bg-indigo-600 text-white" : "bg-amber-500 text-slate-950 border-white/20")}>
                                        <Zap className="animate-bounce" size={20} fill="currentColor" />
                                        {activeCombo.comboCount >= 50 ? "LEGENDARY COMBO" : activeCombo.comboCount >= 25 ? "GIFT MACHINE" : activeCombo.comboCount >= 10 ? "FIRE STORM" : "COMBO"} x{activeCombo.comboCount}
                                        {activeCombo.comboMultiplier > 1 && <span className="ml-2 text-xs bg-white/20 px-2 py-0.5 rounded-lg border border-white/30">{activeCombo.comboMultiplier}x POWER</span>}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                        <div className="h-5 bg-white/5 rounded-full overflow-hidden flex p-1 border border-white/10 mb-8 shadow-inner relative"><div className="h-full bg-blue-600 transition-all duration-1000 ease-out rounded-full" style={{ width: `${p1Pct}%` }} /><div className="h-full bg-amber-500 transition-all duration-1000 ease-out rounded-full" style={{ width: `${p2Pct}%` }} /><div className="absolute left-1/2 top-0 bottom-0 w-1 bg-white/30 -translate-x-1/2 z-20" /></div>
                        <div className="grid grid-cols-2 gap-4">
                            <button onClick={() => handleVote('A')} disabled={isVoting} className="py-5 bg-blue-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl transition-all active:scale-95">VOTE {p1?.campusAcronym}</button>
                            <button onClick={() => handleVote('B')} disabled={isVoting} className="py-5 bg-amber-500 text-slate-950 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl transition-all active:scale-95">VOTE {p2?.campusAcronym}</button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {isEnded && (
            <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-950 pt-24"><Trophy size={100} className="text-amber-500 mb-8 animate-bounce" /><h1 className="text-5xl font-black text-white italic uppercase tracking-tighter mb-10">Concluded</h1>{battle.aiVerdict && <div className="max-w-xl p-10 bg-slate-900 border-4 border-amber-500/30 rounded-[3rem] text-center shadow-xl"><p className="text-xl font-black italic text-indigo-50 mb-8 leading-relaxed">"{battle.aiVerdict.verdict}"</p><Button onClick={onClose} className="w-full bg-white text-slate-900 font-black rounded-2xl h-16 shadow-xl">Return to Arena</Button></div>}</div>
        )}
      </div>

      <aside className="flex-1 bg-slate-900 flex flex-col overflow-hidden">
        <div className="p-6 border-b border-white/5">
            <ComboLeaderboard battleId={battleId} />
            <SupportLeaderboard battleId={battleId} />
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar bg-slate-900/50">
            {messages?.map(m => (<div key={m.id} className="animate-in slide-in-from-bottom-2 flex flex-col gap-1"><div className="flex items-center gap-2"><p className={cn("text-[9px] font-black uppercase", m.userId === 'system' ? "text-amber-500" : "text-slate-500")}>{m.userName}</p>{m.isSubscriber && <Star size={8} className="text-amber-500 fill-amber-500" />}</div><div className={cn("p-3 rounded-2xl border text-sm max-w-[90%]", m.userId === 'system' ? "bg-amber-500/10 border-amber-500/30 text-amber-200 italic" : m.userId === user?.id ? "bg-indigo-600 text-white border-indigo-500 self-end" : "bg-white/5 border-white/5 text-slate-300")}>{m.text}</div></div>))}
            <div ref={scrollRef} />
        </div>
        <div className="p-6 bg-slate-950/80 backdrop-blur-xl border-t border-white/5 space-y-6">
            {inputMode === 'gift' ? (
                <div className="space-y-4 animate-in slide-in-from-bottom-4">
                    <div className="flex items-center justify-between px-2">
                        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2"><Zap size={12} fill="currentColor" /> Arena Artillery</p>
                        <button onClick={() => setInputMode('chat')} className="p-1 hover:bg-white/10 rounded-full text-slate-500"><X size={16}/></button>
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                        {POWER_UPS.map(up => {
                            const canAfford = (wallet?.coins || 0) >= up.cost;
                            return (
                                <button key={up.type} disabled={!canAfford || boostsRemaining <= 0} onClick={() => handlePowerUp(up, user?.campusId === p1?.campusAcronym ? 'A' : 'B')} className={cn("flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all active:scale-90", canAfford ? "bg-white/5 border-white/10 hover:bg-indigo-600/20 hover:border-indigo-500" : "bg-red-900/10 opacity-50 grayscale")}>
                                    <span className="text-2xl">{up.emoji}</span>
                                    <div className="text-center"><p className="text-[8px] font-black uppercase text-white tracking-tighter">{up.label}</p><p className="text-[10px] font-bold text-amber-500">{up.cost}</p></div>
                                </button>
                            );
                        })}
                    </div>
                    <div className="flex justify-between items-center px-2">
                        <div className="flex items-center gap-1.5 bg-amber-500/10 px-3 py-1 rounded-lg border border-amber-500/20"><Coins size={10} className="text-amber-500" /><span className="text-[10px] font-black text-amber-500">{wallet?.coins || 0}</span></div>
                        <p className="text-[8px] font-bold text-slate-500 uppercase">Limit: {boostsRemaining} Left</p>
                    </div>
                </div>
            ) : (
                <div className="flex gap-2">
                    <button onClick={() => setInputMode('gift')} className="p-4 bg-white/5 hover:bg-indigo-600 text-indigo-400 hover:text-white rounded-2xl transition-all active:scale-90 border border-white/10"><Zap size={20} fill="currentColor" /></button>
                    <form onSubmit={handleSendMessage} className="flex-1 flex gap-2"><input value={message} onChange={e => setMessage(e.target.value)} placeholder="Cast shade..." className="flex-1 bg-white/5 rounded-2xl px-5 py-4 text-sm text-white outline-none border-none focus:ring-2 focus:ring-red-600 font-bold" /><button type="submit" disabled={!message.trim()} className="p-4 bg-red-600 text-white rounded-2xl active:scale-90 shadow-xl"><Send size={20} /></button></form>
                </div>
            )}
        </div>
      </aside>
      <JoinBattleModal battle={battle} isOpen={isJoinModalOpen} onClose={() => setIsJoinModalOpen(false)} />
      {showReport && <ReportContentDialog targetId={battleId} targetType="battle" reportedUserId={battle.creatorId} isOpen={showReport} onClose={() => setShowReport(false)} />}
    </div>
  );
}
