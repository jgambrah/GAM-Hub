'use client';

import * as React from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useFirebase, useCollection, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { collection, query, where, orderBy, doc, arrayUnion } from 'firebase/firestore';
import type { Group } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '../ui/skeleton';
import { Users, Lock, Globe, PlusCircle, Loader2, Search } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { useToast } from '@/hooks/use-toast';
import { RequestToJoinButton } from './request-to-join-button';

/**
 * DiscoverGroupsList Component
 * 
 * Fetches and displays groups on the user's campus that they haven't joined yet.
 * Handles direct joining for public groups and join requests for private ones.
 */
export function DiscoverGroupsList() {
    const { user } = useAuth();
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [joiningId, setJoiningId] = React.useState<string | null>(null);

    // Query for all groups on the user's campus
    const discoveryQuery = useMemoFirebase(() => {
        if (!firestore || !user || !user.campusId) return null;
        return query(
            collection(firestore, 'groups'),
            where('campusId', '==', user.campusId),
            orderBy('createdAt', 'desc')
        );
    }, [firestore, user?.campusId]);

    const { data: allGroups, isLoading } = useCollection<Group>(discoveryQuery);

    // Client-side filter to only show groups the user IS NOT a member of
    const discoverableGroups = React.useMemo(() => {
        if (!allGroups || !user) return [];
        return allGroups.filter(group => !group.members.includes(user.id));
    }, [allGroups, user]);

    const handleJoinPublic = async (group: Group) => {
        if (!firestore || !user) return;
        setJoiningId(group.id);
        
        try {
            const groupRef = doc(firestore, 'groups', group.id);
            // Atomically add the user to the members array
            await updateDocumentNonBlocking(groupRef, {
                members: arrayUnion(user.id)
            });
            
            toast({ 
                title: "Welcome to the Yard!", 
                description: `You have successfully joined ${group.name}.` 
            });
        } catch (error) {
            console.error("Join failed:", error);
            toast({ 
                variant: 'destructive', 
                title: "Join Failed", 
                description: "Could not join the community at this time." 
            });
        } finally {
            setJoiningId(null);
        }
    };

    if (isLoading) {
        return (
            <Card className="mt-8 border-none shadow-none bg-transparent">
                <CardHeader className="px-0">
                    <Skeleton className="h-8 w-48 mb-2" />
                    <Skeleton className="h-4 w-64" />
                </CardHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Skeleton className="h-32 w-full rounded-[2rem]" />
                    <Skeleton className="h-32 w-full rounded-[2rem]" />
                </div>
            </Card>
        );
    }

    if (discoverableGroups.length === 0) {
        return null; // Hide the section if there's nothing to discover
    }

    return (
        <div className="mt-12 space-y-6">
            <div className="flex items-center justify-between px-2">
                <div>
                    <h3 className="text-2xl font-black text-foreground flex items-center gap-2">
                        <Globe className="text-primary" size={24} /> Discover Communities
                    </h3>
                    <p className="text-sm text-muted-foreground font-medium italic">Grow your network on campus</p>
                </div>
                <div className="p-2 bg-muted rounded-xl text-muted-foreground">
                    <Search size={18} />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {discoverableGroups.map(group => (
                    <div key={group.id} className="p-6 bg-card border-2 border-border/50 rounded-[2.5rem] hover:border-primary/30 transition-all group relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                            <Users size={80} />
                        </div>
                        
                        <div className="relative z-10 flex flex-col h-full justify-between gap-6">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <h4 className="font-black text-lg text-foreground tracking-tight group-hover:text-primary transition-colors">{group.name}</h4>
                                    <Badge variant="secondary" className="text-[8px] font-black uppercase tracking-widest">{group.type}</Badge>
                                </div>
                                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed font-medium">
                                    {group.description || `The official hub for ${group.name} members.`}
                                </p>
                                
                                <div className="flex items-center gap-4 mt-4">
                                    <div className="flex items-center gap-1.5">
                                        <Users size={12} className="text-muted-foreground" />
                                        <span className="text-[10px] font-black text-muted-foreground uppercase">{group.members.length} members</span>
                                    </div>
                                    {group.isPrivate ? (
                                        <div className="flex items-center gap-1.5 text-amber-600">
                                            <Lock size={12} />
                                            <span className="text-[10px] font-black uppercase">Private Entry</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1.5 text-emerald-600">
                                            <Globe size={12} />
                                            <span className="text-[10px] font-black uppercase">Open Yard</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            <div className="pt-2">
                                {group.isPrivate ? (
                                    <RequestToJoinButton group={group} />
                                ) : (
                                    <Button 
                                        onClick={() => handleJoinPublic(group)} 
                                        disabled={joiningId === group.id}
                                        className="w-full rounded-[1.2rem] font-black text-xs uppercase tracking-widest bg-slate-900 text-white hover:bg-slate-800 h-12 shadow-lg active:scale-95 transition-all"
                                    >
                                        {joiningId === group.id ? (
                                            <Loader2 className="animate-spin mr-2" size={14} />
                                        ) : (
                                            <PlusCircle className="mr-2" size={14} />
                                        )}
                                        Join Community
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
