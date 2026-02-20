'use client';

import React, { useState } from 'react';
import { useFirebase, addDocumentNonBlocking } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Loader2, PlayCircle } from 'lucide-react';
import { collection, serverTimestamp } from 'firebase/firestore';

interface CreateWatchPartyProps {
    groupId: string;
    hostId: string;
}

export function CreateWatchParty({ groupId, hostId }: CreateWatchPartyProps) {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);

    const handleCreateParty = async () => {
        if (!firestore) return;
        setIsLoading(true);
        try {
            // For demo, using a fixed YouTube URL
            const videoUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'; // A classic choice
            
            await addDocumentNonBlocking(collection(firestore, 'watch_parties'), {
                groupId,
                hostId,
                videoUrl,
                title: 'Group Watch Party!',
                isPlaying: false,
                currentTime: 0,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });

            toast({ title: "Watch Party Created!", description: "The player will now appear for all group members." });

        } catch (error: any) {
            toast({ variant: 'destructive', title: "Error", description: "Could not start watch party." });
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <Button onClick={handleCreateParty} disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
            Start a Watch Party
        </Button>
    )
}
