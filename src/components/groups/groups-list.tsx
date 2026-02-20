'use client';

import * as React from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { Group } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '../ui/skeleton';
import { Users, Lock, Globe } from 'lucide-react';
import { Badge } from '../ui/badge';
import Link from 'next/link';

export function GroupsList() {
    const { user } = useAuth();
    const { firestore } = useFirebase();

    const groupsQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(
            collection(firestore, 'groups'),
            where('members', 'array-contains', user.id),
            orderBy('createdAt', 'desc')
        );
    }, [firestore, user]);

    const { data: groups, isLoading } = useCollection<Group>(groupsQuery);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Your Communities</CardTitle>
                <CardDescription>Groups you have joined or created.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {isLoading ? (
                        <>
                            <Skeleton className="h-16 w-full" />
                            <Skeleton className="h-16 w-full" />
                        </>
                    ) : groups && groups.length > 0 ? (
                        groups.map(group => (
                            <Link href={`/groups/${group.id}`} key={group.id} className="block w-full text-left p-4 border rounded-lg hover:bg-muted transition-colors">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="font-semibold flex items-center gap-2">
                                            {group.isPrivate ? <Lock size={14} /> : <Globe size={14} />}
                                            {group.name}
                                        </p>
                                        <p className="text-xs text-muted-foreground">{group.description}</p>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <Badge variant="secondary">{group.type}</Badge>
                                        <span className="text-xs text-muted-foreground">{group.members.length} members</span>
                                    </div>
                                </div>
                            </Link>
                        ))
                    ) : (
                        <div className="text-center py-10 text-sm text-muted-foreground">
                            <Users className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                            You haven't joined any communities yet.
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
