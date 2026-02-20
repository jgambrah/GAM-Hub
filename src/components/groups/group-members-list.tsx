'use client';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { useAuth } from '@/hooks/use-auth';
import { collection, query, where } from 'firebase/firestore';
import type { Group, User } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Crown, MessageCircle, Link2 } from 'lucide-react';
import { Button } from '../ui/button';

export function GroupMembersList({ group }: { group: Group }) {
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth(); // get current user for 'isMe' check

    // Firestore 'in' queries can handle up to 30 items in a single query.
    // For simplicity, we'll fetch the first 30 members. A real app would need pagination for larger groups.
    const memberIds = group.members.slice(0, 30);

    const membersQuery = useMemoFirebase(() => {
        if (!firestore || memberIds.length === 0) return null;
        return query(
            collection(firestore, 'users'),
            where('id', 'in', memberIds)
        );
    }, [firestore, group.members]); // Dependency on group.members will refetch if it changes.

    const { data: members, isLoading } = useCollection<User>(membersQuery);

    if (isLoading) {
        return (
            <div className="space-y-3">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)}
            </div>
        )
    }

    return (
        <div className="space-y-2">
            {members?.map(member => {
                const isMe = member.id === currentUser?.id;
                const isAdmin = group.admins.includes(member.id);
                const isStaff = member.role === 'staff';

                return (
                    <div key={member.id} className="group p-2.5 rounded-xl hover:bg-muted/50 transition-all">
                        <div className="flex items-center gap-3">
                             <div className="relative">
                                <Avatar className="h-10 w-10">
                                    <AvatarImage src={member.avatarUrl} />
                                    <AvatarFallback>{member.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                {isAdmin && (
                                    <div className="absolute -top-1 -right-1 bg-amber-500 text-white p-0.5 rounded-full border-2 border-card">
                                        <Crown size={10} />
                                    </div>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-foreground truncate flex items-center gap-1.5 text-sm">
                                    {member.name} {isMe && <span className="text-[10px] font-medium text-primary">(You)</span>}
                                </p>
                                <p className="text-[10px] text-muted-foreground font-medium truncate uppercase tracking-wider">
                                    {isStaff ? member.designation : member.major}
                                </p>
                            </div>
                        </div>

                         {!isMe && (
                            <div className="mt-2.5 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                <Button size="sm" className="h-7 text-xs flex-1">
                                    <MessageCircle size={12} /> Message
                                </Button>
                                <Button size="sm" variant="secondary" className="h-7 text-xs flex-1">
                                    <Link2 size={12} /> Link Up
                                </Button>
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    )
}
