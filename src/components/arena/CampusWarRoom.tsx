
'use client';

/**
 * CampusWarRoom Component
 * -----------------------
 * National Hub Stage for University vs University Wars.
 * Finalized with STEP 12: ARENA GIFT COMBO SYSTEM & FINALE BOOST ⚡🔥
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  collection, query, orderBy, limitToLast, 
  serverTimestamp, addDoc, updateDoc, 
  increment, doc, getDoc, writeBatch, onSnapshot, setDoc
} from 'firebase/firestore';
import { useFirebase, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { useAuth } from '@/hooks/use-auth';
import type { CampusWar, BattleMessage, VoteShard, GiftCombo } from '@/lib/types';
import { 
  X, Swords, Users, Send, Zap, 
  Loader2, MessageSquare, Globe, CheckCircle2, Flame, Coins
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { registerUserDevice, isBotSuspicionCheck, trackUserBehavior } from '@/lib/fraud-protection';
import { spendCoins } from '@/lib/monetization';
import { cn } from '@/lib/utils';

const POWER_UPS = [
    { type: 'fire', label: 'Vibe Boost', emoji: '🔥', weight: 5, cost: 10 },
    { type: 'mass_shade', label: 'Mass Shade', emoji: '🗣️', weight: 15, cost: 30 },
    { type: 'national_crown', label: 'National Crown', emoji: '👑', weight: 50, cost: 100 },
];

const COMBO_WINDOW_MS = 4000; 

interface LocalBurst { id: string; emoji: string; x: number; }

export function CampusWarRoom({ warId, onClose }: { warId: string, onClose: () => void }) {
  const { firestore } = useFirebase();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [message, setMessage] = useState('');
  const [isVoting, setIsVoting] = useState(false);
  const [bursts, setBursts] = useState<LocalBurst[]>([]);
  const [activeCombo, setActiveCombo] = useState<GiftCombo | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const warRef = useMemoFirebase(() => {
    if (!firestore || !warId) return null;
    return doc(firestore, 'campus_wars', warId);
  }, [firestore, warId]);

  const { data: war, isLoading } = useDoc<CampusWar>(warRef);

  const walletRef = useMemoFirebase(() => {
    if (!firestore || !user?.id) return null;
    return doc(firestore, 'wallets', user.id);
  }, [firestore, user?.id]);
  const { data: wallet } = useDoc<any>(walletRef);

  // ⏱️ FINAL FRENZY TIMER
  useEffect(() => {
    if (!war?.endsAt || war.status !== 'live') return;
    const timer = setInterval(() => {
      const end = new Date(war.endsAt).getTime();
      const now = Date.now();
      const diff = Math.max(0, Math.floor((end - now) / 1000));
      setTimeLeft(diff);
    }, 1000);
    return () => clearInterval(timer);
  }, [war?.endsAt, war?.status]);

  const isFinalFrenzy = war?.status === 'live' && timeLeft > 0 && timeLeft <= 20;

  // ⚡ STEP 12: COMBO LISTENER
  useEffect(() => {
    if (!firestore || !warId || !user?.id) return;
    
    const comboId = `${warId}_${user.id}`;
    const unsub = onSnapshot(doc(firestore, 'gift_combos', comboId), (snap) => {
        if (snap.exists()) {
            const data = snap.data() as GiftCombo;
            const now = Date.now();
            const lastTime = data.lastGiftTime?.toMillis?.() || 0;
            if (now - lastTime > COMBO_WINDOW_MS) setActiveCombo(null);
            else setActiveCombo(data);
        } else {
            setActiveCombo(null);
        }
    });
    return () => unsub();
  }, [firestore, warId, user?.id]);

  const shardsQuery = useMemoFirebase(() => {
      if (!firestore || !warId) return null;
      return query(collection(firestore, 'campus_wars', warId, 'vote_shards'));
  }, [firestore, warId]);

  const { data: shards } = useCollection<VoteShard>(shardsQuery);

  const aggregatedScores = useMemo(() => {
      if (!shards || shards.length === 0) return { A: war?.votesA || 0, B: war?.votesB || 0 };
      return shards.reduce((acc, shard) => ({
          A: acc.A + (shard.votesA || 0),
          B: acc.B + (shard.votesB || 0)
      }), { A: 0, B: 0 });
  }, [shards, war]);

  const messagesQuery = useMemoFirebase(() => 
    firestore ? query(
      collection(firestore, "campus_wars", warId, "messages"),
      orderBy("createdAt", "asc"),
      limitToLast(50)
    ) : null
  , [firestore, warId]);
  
  const { data: messages } = useCollection<BattleMessage>(messagesQuery);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !firestore || !user || war?.status === 'ended') return;
    setMessage('');
    addDoc(collection(firestore, "campus_wars", warId, "messages"), { 
        userId: user.id, 
        userName: user.name, 
        text: message.trim(), 
        createdAt: serverTimestamp() 
    });
  };

  const handleVote = async (side: 'A' | 'B') => {
    if (!firestore || !user || isVoting || !war || war.status === 'ended') return;
    
    const isBlocked = await isBotSuspicionCheck(firestore, user.id);
    if (isBlocked) return;

    setIsVoting(true);
    try {
      const voteAuditRef = doc(firestore, 'battle_votes', warId, 'users', user.id);
      const auditSnap = await getDoc(voteAuditRef);
      const now = Date.now();

      if (auditSnap.exists()) {
          const lastVote = auditSnap.data().lastVoteTime?.toMillis?.() || 0;
          if (now - lastVote < 10000) {
              toast({ variant: 'destructive', title: 'Energy Recharging...' });
              setIsVoting(false);
              return;
          }
      }

      const shardId = Math.floor(Math.random() * 10).toString();
      const shardRef = doc(firestore, 'campus_wars', warId, 'vote_shards', shardId);
      const batch = writeBatch(firestore);

      batch.set(voteAuditRef, {
          lastVoteTime: serverTimestamp(),
          voteCount: increment(1)
      }, { merge: true });

      const multiplier = isFinalFrenzy ? 2 : 1;
      batch.set(shardRef, { 
          [side === 'A' ? 'votesA' : 'votesB']: increment(multiplier) 
      }, { merge: true });

      await batch.commit();
      trackUserBehavior(firestore, user.id, 'vote');
      sendReaction('🗳️');
    } catch(err) { toast({ variant: 'destructive', title: 'Refused' }); }
    finally { setIsVoting(false); }
  };

  const handlePowerUp = async (up: typeof POWER_UPS[0], side: 'A' | 'B') => {
    if (!firestore || !user || !war || war.status === 'ended' || !wallet) return;
    
    const isBlocked = await isBotSuspicionCheck(firestore, user.id);
    if (isBlocked) return;

    if (wallet.coins < up.cost) {
        toast({ variant: 'destructive', title: 'Insufficient Coins' });
        return;
    }

    const comboId = `${warId}_${user.id}`;
    const comboRef = doc(firestore, 'gift_combos', comboId);
    const comboSnap = await getDoc(comboRef);
    
    let comboCount = 1;
    let multiplier = 1.0;
    const now = Date.now();

    if (comboSnap.exists()) {
        const data = comboSnap.data() as GiftCombo;
        const lastTime = data.lastGiftTime?.toMillis?.() || 0;
        if (now - lastTime < COMBO_WINDOW_MS) comboCount = data.comboCount + 1;
    }

    if (comboCount >= 50) multiplier = 3.0;
    else if (comboCount >= 20) multiplier = 2.0;
    else if (comboCount >= 10) multiplier = 1.5;
    else if (comboCount >= 5) multiplier = 1.2;

    // ⚡ FINALE BOOST: Double multiplier in the last 20 seconds
    if (isFinalFrenzy) {
        multiplier *= 2.0;
    }

    const finalWeight = Math.floor(up.weight * multiplier);
    const shardId = Math.floor(Math.random() * 10).toString();
    const shardRef = doc(firestore, 'campus_wars', warId, 'vote_shards', shardId);

    try {
        await spendCoins(firestore, user.id, up.cost, 'powerup_used', {
            battleId: warId,
            userName: user.name,
            powerupType: up.type,
            comboCount,
            multiplier
        });

        const batch = writeBatch(firestore);
        batch.set(comboRef, {
            userId: user.id,
            battleId: warId,
            comboCount,
            comboMultiplier: multiplier,
            lastGiftTime: serverTimestamp()
        }, { merge: true });

        batch.set(shardRef, { 
            [side === 'A' ? 'votesA' : 'votesB']: increment(finalWeight) 
        }, { merge: true });

        // Achievement Log for War
        if (comboCount === 10 || comboCount === 25 || comboCount === 50) {
            const achievementRef = doc(firestore, 'user_achievements', user.id);
            const achievementUpdate: any = { updatedAt: serverTimestamp() };
            let milestoneMsg = "";
            if (comboCount === 10) { achievementUpdate.fireStarter = true; milestoneMsg = `🔥 FIRE STORM x10! ${user.name} is defending the Yard!`; }
            if (comboCount === 25) { achievementUpdate.giftMachine = true; milestoneMsg = `🚀 GIFT MACHINE x25! ${user.name} is unstoppable!`; }
            if (comboCount === 50) { achievementUpdate.arenaLegend = true; milestoneMsg = `🏆 ARENA LEGEND x50! salute ${user.name}!`; }
            
            if (milestoneMsg) {
                batch.set(achievementRef, achievementUpdate, { merge: true });
                batch.set(doc(collection(firestore, "campus_wars", warId, "messages")), {
                    userId: 'system', userName: 'WAR ROOM', text: milestoneMsg, createdAt: serverTimestamp()
                });
            }
        }

        await batch.commit();
        trackUserBehavior(firestore, user.id, 'gift');
        sendReaction(up.emoji);
    } catch (err) { console.error(err); }
  };

  const sendReaction = (emoji: string) => {
    const id = Math.random().toString(36);
    setBursts(prev => [...prev, { id, emoji, x: 20 + Math.random() * 60 }]);
    setTimeout(() => setBursts(prev => prev.filter(b => b.id !== id)), 2000);
  };

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (isLoading || !war) return null;

  const { A: votesA, B: votesB } = aggregatedScores;
  const totalVotes = (votesA || 0) + (votesB || 0);
  const p1Pct = totalVotes > 0 ? ((votesA || 0) / totalVotes) * 100 : 50;
  const p2Pct = 100 - p1Pct;

  return (
    <div className="fixed inset-0 z-[8000] bg-black flex flex-col md:flex-row overflow-hidden animate-in fade-in duration-500">
      <div className="flex-[3] relative bg-slate-950 flex flex-col overflow-hidden">
        
        <div className="absolute inset-0 pointer-events-none z-[100]">
            <AnimatePresence>
                {bursts.map(b => (
                    <motion.div key={b.id} initial={{ opacity: 0, y: 0, scale: 0.5 }} animate={{ opacity: [0, 1, 1, 0], y: -400, scale: [0.5, 2, 1.5, 1] }} exit={{ opacity: 0 }} transition={{ duration: 2 }} className="absolute text-7xl" style={{ left: `${b.x}%`, bottom: '150px' }}>
                        {b.emoji}
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>

        <div className="absolute top-0 left-0 right-0 z-50 p-8 flex justify-between items-start bg-gradient-to-b from-black/80 to-transparent">
          <button onClick={onClose} className="p-4 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-md border border-white/10 transition-all"><X size={24}/></button>
          <div className="text-center">
            <div className={cn("px-8 py-2 rounded-2xl text-[10px] font-black text-white uppercase tracking-[0.4em] shadow-2xl animate-pulse", war.status === 'live' ? "bg-red-600" : "bg-indigo-600")}>
                {war.status === 'live' ? `Live National War - ${timeLeft}s` : 'National War Hub'}
            </div>
            <h1 className="text-2xl font-black italic text-white mt-4 tracking-tighter uppercase">"{war.title}"</h1>
          </div>
          <div className="bg-white/10 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10 text-white flex items-center gap-3">
            <Users size={18} className="text-indigo-400" />
            <span className="text-sm font-black tabular-nums">{war.viewerCount || 0}</span>
          </div>
        </div>

        {/* ⚡ FINAL FRENZY BANNER */}
        <AnimatePresence>
            {isFinalFrenzy && (
                <motion.div 
                    initial={{ scale: 0.9, opacity: 0, y: -20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 1.1, opacity: 0 }}
                    className="absolute top-32 left-1/2 -translate-x-1/2 z-[60] bg-red-600 text-white px-8 py-3 rounded-[2rem] font-black text-xs uppercase tracking-[0.3em] shadow-[0_0_50px_rgba(220,38,38,0.6)] border-4 border-white/20 animate-pulse flex items-center gap-3"
                >
                    <Zap size={18} fill="white" /> FINAL FRENZY: 2X COMBO POWER
                </motion.div>
            )}
        </AnimatePresence>

        <div className="flex-1 flex flex-col justify-center items-center p-8 gap-12">
            <div className="w-full max-w-5xl flex justify-between items-center gap-10">
                <div className="text-center flex-1">
                    <h2 className="text-8xl md:text-[10rem] font-black italic tracking-tighter mb-4" style={{ color: war.campusAInfo?.primaryColor }}>{war.campusAInfo?.acronym}</h2>
                    <p className="text-5xl font-black text-white tabular-nums">{(votesA || 0).toLocaleString()}</p>
                </div>
                <div className="relative"><div className="p-10 bg-indigo-600 rounded-full shadow-[0_0_100px_rgba(79,70,229,0.4)] border-8 border-slate-900"><Swords size={64} className="text-white" /></div></div>
                <div className="text-center flex-1"><h2 className="text-8xl md:text-[10rem] font-black italic tracking-tighter mb-4" style={{ color: war.campusBInfo?.primaryColor }}>{war.campusBInfo?.acronym}</h2><p className="text-5xl font-black text-white tabular-nums">{(votesB || 0).toLocaleString()}</p></div>
            </div>

            <div className="w-full max-w-4xl h-16 bg-white/5 rounded-full overflow-hidden flex p-2 border-2 border-white/10 shadow-2xl relative">
                <div className="h-full transition-all duration-1000 ease-out rounded-full" style={{ width: `${p1Pct}%`, backgroundColor: war.campusAInfo?.primaryColor }} />
                <div className="h-full transition-all duration-1000 ease-out rounded-full" style={{ width: `${p2Pct}%`, backgroundColor: war.campusBInfo?.primaryColor }} />
                <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-white/30 -translate-x-1/2 z-20" />
            </div>
        </div>

        <div className="p-10 bg-gradient-to-t from-black/80 to-transparent flex justify-center gap-10">
            <div className="flex flex-col gap-4 w-full max-w-md">
                
                {/* COMBO HUD */}
                <AnimatePresence>
                    {activeCombo && activeCombo.comboCount >= 2 && (
                        <motion.div initial={{ scale: 0.5, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} className="flex justify-center mb-4">
                            <div className={cn("px-6 py-2 rounded-2xl font-black italic text-xl shadow-2xl flex items-center gap-2 border-2", activeCombo.comboCount >= 50 ? "bg-red-600 text-white" : activeCombo.comboCount >= 25 ? "bg-purple-600 text-white" : activeCombo.comboCount >= 10 ? "bg-indigo-600 text-white" : "bg-amber-500 text-slate-950")}>
                                <Zap size={20} fill="currentColor" /> 
                                {activeCombo.comboCount >= 50 ? "LEGENDARY COMBO" : activeCombo.comboCount >= 25 ? "GIFT MACHINE" : activeCombo.comboCount >= 10 ? "FIRE STORM" : "COMBO"} x{activeCombo.comboCount}
                                {isFinalFrenzy && <span className="ml-2 text-xs bg-white/20 px-2 py-0.5 rounded-lg border border-white/30">2X FRENZY</span>}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="grid grid-cols-2 gap-4">
                    <button onClick={() => handleVote('A')} disabled={isVoting} className="py-6 rounded-3xl font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95 border-2 border-white/10 hover:brightness-110" style={{ backgroundColor: war.campusAInfo?.primaryColor }}>VOTE {war.campusAInfo?.acronym}</button>
                    <button onClick={() => handleVote('B')} disabled={isVoting} className="py-6 rounded-3xl font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95 border-2 border-white/10 hover:brightness-110" style={{ backgroundColor: war.campusBInfo?.primaryColor }}>VOTE {war.campusBInfo?.acronym}</button>
                </div>
                <div className="flex justify-center gap-4">
                    {POWER_UPS.map(up => (
                        <button key={up.type} onClick={() => handlePowerUp(up, user?.campusId === war.campusAId ? 'A' : 'B')} className="group flex flex-col items-center gap-1">
                            <div className="p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all active:scale-90"><span className="text-2xl">{up.emoji}</span></div>
                            <span className="text-[8px] font-black text-slate-500 uppercase">+{up.weight * (isFinalFrenzy ? 2 : 1)}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
      </div>

      <div className="flex-1 bg-slate-900 border-l border-white/5 flex flex-col">
        <div className="p-6 bg-slate-950/50 border-b border-white/5"><h3 className="text-white font-black uppercase text-xs tracking-widest">Global War Chat</h3></div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar bg-slate-900/50">
            {messages?.map(m => (<div key={m.id} className="animate-in slide-in-from-bottom-2"><div className="flex items-center gap-2 mb-1"><p className={cn("text-[9px] font-black uppercase", m.userId === 'system' ? "text-amber-500" : "text-slate-500")}>{m.userName}</p></div><div className={cn("p-3 rounded-2xl border text-sm", m.userId === 'system' ? "bg-amber-500/10 border-amber-500/30 text-amber-200 italic" : "bg-white/5 border-white/5 text-slate-300")}>{m.text}</div></div>))}
            <div ref={scrollRef} />
        </div>
        <form onSubmit={handleSendMessage} className="p-6 bg-slate-950 flex gap-2">
            <input value={message} onChange={e => setMessage(e.target.value)} placeholder="Declare defense..." className="flex-1 bg-white/5 rounded-2xl px-5 py-4 text-sm text-white outline-none border-none focus:ring-2 focus:ring-indigo-600 font-bold transition-all" />
            <button type="submit" disabled={!message.trim()} className="p-4 bg-indigo-600 text-white rounded-2xl active:scale-90 shadow-xl"><Send size={20} /></button>
        </form>
      </div>
    </div>
  );
}
