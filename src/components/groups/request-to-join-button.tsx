
'use client';
import { useFirebase, addDocumentNonBlocking, useCollection, useMemoFirebase } from '@/firebase';
import { useAuth } from '@/hooks/use-auth';
import { collection, query, where } from 'firebase/firestore';
import { Button } from '../ui/button';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Loader2, History } from 'lucide-react';
import type { Group, GroupRequest } from '@/lib/types';
import React from 'react';

export function RequestToJoinButton({ group }: { group: Group }) {
    const { firestore } = useFirebase();
    const { user } = useAuth();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = React.useState(false);

    const existingRequestQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(
            collection(firestore, 'group_requests'),
            where('groupId', '==', group.id),
            where('userId', '==', user.id)
        );
    }, [firestore, user, group.id]);

    const { data: existingRequests, isLoading: isLoadingRequest } = useCollection<GroupRequest>(existingRequestQuery);
    
    const hasPendingRequest = existingRequests?.some(r => r.status === 'pending');

    const handleRequest = async () => {
        if (!firestore || !user) return;
        setIsLoading(true);

        const requestData = {
            groupId: group.id,
            userId: user.id,
            userName: user.name,
            userCampusId: user.campusId,
            userAvatarUrl: user.avatarUrl,
            status: 'pending',
            createdAt: new Date().toISOString()
        };

        try {
            await addDocumentNonBlocking(collection(firestore, 'group_requests'), requestData);
            toast({ title: "Request Sent", description: "Your request to join has been sent to the group admin." });
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: "Error", description: "Could not send join request." });
        } finally {
            setIsLoading(false);
        }
    }

    if (isLoadingRequest) {
        return <Button disabled className="w-full"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Checking...</Button>;
    }
    
    if (hasPendingRequest) {
        return <Button disabled variant="outline" className="w-full"><History className="mr-2 h-4 w-4" /> Request Pending</Button>;
    }

    return (
        <Button onClick={handleRequest} disabled={isLoading} className="w-full">
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
            Request to Join
        </Button>
    )
}
