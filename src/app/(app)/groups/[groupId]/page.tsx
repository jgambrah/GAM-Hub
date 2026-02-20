
'use client';

import * as React from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useFirebase, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, collection, query, where, limit } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import type { Group, WatchParty, Product } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock, Globe, Users, PlayCircle, Sparkles, ChevronRight, MessageSquare, UserPlus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ExitGroupButton } from '@/components/groups/exit-group-button';
import { StudentAdminManager } from '@/components/groups/student-admin-manager';
import { GroupMembersList } from '@/components/groups/group-members-list';
import { RequestToJoinButton } from '@/components/groups/request-to-join-button';
import WatchPartyPlayer from '@/components/groups/WatchPartyPlayer';
import { CreateWatchParty } from '@/components/groups/CreateWatchParty';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRouter } from 'next/navigation';
import GroupChat from '@/components/groups/GroupChat';

/**
 * THE LANDING LOGIC: Member Exclusive Banner
 * Appears only if a vendor has targeted THIS specific community.
 */
function CommunitySponsoredAd({ groupId }: { groupId: string }) {
    const { firestore, firebaseApp } = useFirebase();
    const router = useRouter();

    const adQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(
            collection(firestore, 'products'),
            where('isSponsored', '==', true),
            where('targetGroupId', '==', groupId),
            where('adStatus', '==', 'active'),
            limit(1)
        );
    }, [firestore, groupId]);

    const { data: ads, isLoading } = useCollection<Product>(adQuery);
    const activeAd = ads?.[0];

    const handleAdClick = async () => {
        if (!firebaseApp || !activeAd) return;
        const functions = getFunctions(firebaseApp);
        const trackClick = httpsCallable(functions, 'trackAdClick');
        try {
            // Log the engagement with the Liaison Brain
            trackClick({ productId: activeAd.id, vendorId: activeAd.vendorId }).catch(e => console.error(e));
            router.push(`/products/${activeAd.id}`);
        } catch (err) { 
            router.push(`/products/${activeAd.id}`); 
        }
    };

    if (isLoading || !activeAd) return null;

    return (
        <div 
            onClick={handleAdClick}
            className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border-2 border-dashed border-amber-200 dark:border-amber-800 rounded-[2rem] flex items-center justify-between group cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-all animate-in slide-in-from-top-2 duration-500"
        >
            <div className="flex items-center gap-4">
                <div className="p-2 bg-amber-500 text-white rounded-xl shadow-lg shadow-amber-200/50">
                    <Sparkles size={16} fill="currentColor" />
                </div>
                <div>
                    <p className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-[0.2em]">Member Exclusive</p>
                    <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm group-hover:underline decoration-amber-500 underline-offset-2 transition-all">
                        {activeAd.adHeadline || activeAd.name}
                    </h4>
                </div>
            </div>
            <button className="bg-slate-900 text-white dark:bg-amber-500 px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg active:scale-95 transition-all">
                VIEW DEAL <ChevronRight size={12} />
            </button>
        </div>
    );
}

export default function GroupDetailPage({ params }: { params: { groupId: string } }) {
  const { groupId } = params;
  const { user, isUserLoading } = useAuth();
  const { firestore } = useFirebase();

  const groupDocRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'groups', groupId);
  }, [firestore, groupId]);

  const { data: group, isLoading: isGroupLoading } = useDoc<Group>(groupDocRef);

  const watchPartyQuery = useMemoFirebase(() => {
    if (!firestore || !groupId) return null;
    return query(
      collection(firestore, 'watch_parties'),
      where('groupId', '==', groupId),
      limit(1)
    );
  }, [firestore, groupId]);

  const { data: watchParties, isLoading: isLoadingParty } = useCollection<WatchParty>(watchPartyQuery);
  const activeParty = watchParties?.[0];
  
  const isLoading = isUserLoading || isGroupLoading || isLoadingParty;
  
  if (isLoading) {
      return (
          <div className="max-w-6xl mx-auto space-y-6">
              <Skeleton className="h-12 w-2/3" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <Skeleton className="h-[600px] md:col-span-2 rounded-[3.5rem]" />
                <Skeleton className="h-[600px] md:col-span-1 rounded-[3.5rem]" />
              </div>
          </div>
      )
  }

  // LIAISON GATEKEEPER LOGIC: Main Rooms are open to everyone on that campus.
  // Private rooms are strictly gated.
  const isMainRoom = group?.isMainRoom === true;
  const isMember = user ? group?.members.includes(user.id) : false;
  const sameCampus = user?.campusId === group?.campusId;
  const canEnter = isMainRoom ? sameCampus : isMember;

  if (!group || (!canEnter && group.isPrivate)) {
      return (
          <div className="text-center py-20 px-4">
              <div className="bg-muted w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Lock size={32} className="text-muted-foreground" />
              </div>
              <h1 className="text-3xl font-black tracking-tight">Private Community</h1>
              <p className="text-muted-foreground mt-2 max-w-sm mx-auto">This Yard is restricted to verified members. Submit a request below to join the vibration.</p>
              {user && !isMember && (
                <div className="mt-8 max-w-sm mx-auto">
                    <RequestToJoinButton group={group} />
                </div>
              )}
          </div>
      )
  }
  
  const isCreator = user?.id === group.createdBy;
  const isAdmin = user ? group.admins.includes(user.id) : false;
  const isHost = user?.id === activeParty?.hostId;

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 px-2">
            <div>
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-card rounded-2xl shadow-sm border">
                        {group.isPrivate ? <Lock className="w-6 h-6 text-primary"/> : <Globe className="w-6 h-6 text-primary"/>}
                    </div>
                    <div>
                        <h1 className="text-4xl font-black font-headline tracking-tighter text-foreground">{group.name}</h1>
                        <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="text-[10px] font-black uppercase tracking-widest">{group.type}</Badge>
                            <span className="text-xs text-muted-foreground font-bold">{group.members.length} Members active</span>
                        </div>
                    </div>
                </div>
            </div>
            { isMember && !isCreator && <ExitGroupButton groupId={group.id} /> }
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            <div className="lg:col-span-2 space-y-8">
                {/* DYNAMIC COMMUNITY AD PLACEMENT */}
                <CommunitySponsoredAd groupId={groupId} />

                <Tabs defaultValue="lounge" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 bg-muted/50 p-1.5 rounded-[2rem] h-auto mb-8 border shadow-sm">
                        <TabsTrigger value="lounge" className="rounded-[1.5rem] py-3 font-black text-xs uppercase tracking-widest flex items-center gap-2">
                            <MessageSquare size={14} /> The Lounge
                        </TabsTrigger>
                        {isAdmin && (
                            <TabsTrigger value="admissions" className="rounded-[1.5rem] py-3 font-black text-xs uppercase tracking-widest flex items-center gap-2">
                                <UserPlus size={14} /> Admissions
                            </TabsTrigger>
                        )}
                    </TabsList>

                    <TabsContent value="lounge" className="space-y-8 animate-in fade-in duration-500">
                        {/* MULTIMEDIA GROUP CHAT */}
                        <GroupChat group={group} />

                        {/* WATCH PARTY SUITE */}
                        <Card className="rounded-[3rem] border-none shadow-xl bg-slate-950 text-white overflow-hidden">
                            <CardHeader className="p-8 border-b border-white/5">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <CardTitle className="text-xl font-black flex items-center gap-2">
                                            <PlayCircle className="text-blue-400" /> Watch Party
                                        </CardTitle>
                                        <CardDescription className="text-slate-400 font-medium">Synchronized video session for members</CardDescription>
                                    </div>
                                    {!activeParty && isAdmin && user && (
                                        <CreateWatchParty groupId={groupId} hostId={user.id} />
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                {activeParty ? (
                                    <WatchPartyPlayer party={activeParty} isHost={isHost} />
                                ) : (
                                    <div className="h-64 flex flex-col items-center justify-center text-slate-500 gap-2">
                                        <PlayCircle size={48} className="opacity-10" />
                                        <p className="text-xs font-bold uppercase tracking-widest">No active party</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {isAdmin && (
                        <TabsContent value="admissions" className="animate-in slide-in-from-right-4 duration-500">
                            <Card className="rounded-[3rem] border-none shadow-xl p-2">
                                <CardHeader className="p-8">
                                    <div className="flex items-center gap-3">
                                        <div className="p-3 bg-primary/10 text-primary rounded-2xl">
                                            <UserPlus size={24} />
                                        </div>
                                        <div>
                                            <CardTitle className="text-xl font-black">Gatekeeper Panel</CardTitle>
                                            <CardDescription className="font-medium">Vet and admit new community members</CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="px-8 pb-8">
                                    <StudentAdminManager group={group} />
                                </CardContent>
                            </Card>
                        </TabsContent>
                    )}
                </Tabs>
            </div>

            <div className="lg:col-span-1 space-y-8">
                 <Card className="rounded-[2.5rem] shadow-lg border-slate-100">
                    <CardHeader className="p-6 border-b bg-slate-50/50 rounded-t-[2.5rem]">
                        <CardTitle className="flex items-center gap-2 text-base font-black uppercase tracking-tight">
                            <Users size={18} className="text-primary" /> Member Directory
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4">
                        <GroupMembersList group={group} />
                    </CardContent>
                </Card>
            </div>
        </div>
    </div>
  );
}
