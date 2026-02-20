'use client';
import * as React from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useFirebase, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, limit, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import type { User, Connection } from '@/lib/types';
import { CommunityConnectCard } from '@/components/connections/student-profile-card';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Check, Users, Sparkles } from 'lucide-react';
import { campuses } from '@/lib/data';

function IncomingRequest({ connection }: { connection: Connection }) {
    const { firestore, auth } = useFirebase();
    const { toast } = useToast();
    const [isAccepting, setIsAccepting] = React.useState(false);

    // Fetch the sender's profile
    const senderRef = useMemoFirebase(() => {
        if (!firestore || !connection.fromUserId) return null;
        return doc(firestore, 'users', connection.fromUserId);
    }, [firestore, connection.fromUserId]);
    const { data: sender, isLoading: isLoadingSender } = useDoc<User>(senderRef);

    const handleAcceptLinkUp = async () => {
        if (!firestore || !auth.currentUser) return;
        
        setIsAccepting(true);
        const db = firestore;
        const batch = writeBatch(db);
        const myId = auth.currentUser.uid;
        const senderId = connection.fromUserId;

        // 1. Update Connection Status
        const connRef = doc(db, 'connections', connection.id);
        batch.update(connRef, { status: 'accepted' });

        // 2. Create the Chat Room (The Bridge)
        const chatId = [myId, senderId].sort().join('_');
        const chatRef = doc(db, 'chats', chatId);

        // The createChatOnConnection cloud function will handle denormalizing user info.
        // This client-side write ensures the chat appears instantly for the user.
        batch.set(chatRef, {
            users: [myId, senderId],
            lastMessage: "Handshake Complete! You can now chat.",
            updatedAt: serverTimestamp(),
            type: 'private'
        }, { merge: true });

        try {
            await batch.commit();
            toast({ title: "Link Up successful!", description: `A chat with ${sender?.name} is ready.` });
        } catch (error) {
            console.error("Failed to accept connection:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not accept connection.' });
            setIsAccepting(false);
        }
    };

    if (isLoadingSender || !sender) {
        return <Skeleton className="h-20 w-full" />;
    }

    const senderCampus = campuses.find(c => c.id === sender.campusId);

    return (
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
                <Avatar>
                    <AvatarImage src={sender.avatarUrl} />
                    <AvatarFallback>{sender.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                    <p className="font-semibold text-sm">{sender.name}</p>
                    <p className="text-xs text-muted-foreground">{senderCampus?.name || sender.campusId}</p>
                </div>
            </div>
            <Button size="sm" onClick={handleAcceptLinkUp} disabled={isAccepting}>
                {isAccepting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Accept
            </Button>
        </div>
    );
}

function IncomingRequests() {
  const { user } = useAuth();
  const { firestore } = useFirebase();

  const requestsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, 'connections'),
      where('toUserId', '==', user.id),
      where('status', '==', 'pending')
    );
  }, [firestore, user]);

  const { data: requests, isLoading } = useCollection<Connection>(requestsQuery);

  if (isLoading) {
    return <Card><CardContent><Skeleton className="h-24 w-full" /></CardContent></Card>
  }
  
  if (!requests || requests.length === 0) {
    return null;
  }

  return (
    <Card>
        <CardHeader>
            <CardTitle>Incoming Link-Up Requests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
            {requests.map(req => <IncomingRequest key={req.id} connection={req} />)}
        </CardContent>
    </Card>
  );
}

export default function ConnectionsPage() {
  const { user, isUserLoading } = useAuth();
  const { firestore } = useFirebase();
  const [view, setView] = React.useState<'my-links' | 'discover'>('my-links');

  // Query for DISCOVERY
  const discoveryQuery = useMemoFirebase(() => {
      if (!firestore || !user?.campusId) return null;
      return query(
          collection(firestore, 'users'),
          where('campusId', '==', user.campusId),
          where('role', 'in', ['student', 'staff']),
          where('visibility', '==', 'public'),
          limit(20)
      );
  }, [firestore, user]);
  const { data: peopleToDiscover, isLoading: loadingDiscovery } = useCollection<User>(discoveryQuery);

  const isLoading = isUserLoading || loadingDiscovery;

  return (
    <div className="space-y-8">
        <div className="flex justify-between items-end">
            <div>
                <h1 className="font-headline text-3xl font-bold tracking-tight">The Yard Network</h1>
                <p className="text-muted-foreground">Connect with students and staff across Ghana</p>
            </div>
            
            <div className="bg-muted p-1 rounded-2xl flex gap-1">
                <button 
                    onClick={() => setView('my-links')}
                    className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${view === 'my-links' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground'}`}
                >
                    My Connections
                </button>
                <button 
                    onClick={() => setView('discover')}
                    className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${view === 'discover' ? 'bg-primary text-white shadow-lg' : 'text-muted-foreground'}`}
                >
                    Discover People
                </button>
            </div>
        </div>

        {view === 'my-links' && (
            <div className="animate-in fade-in space-y-6">
                <IncomingRequests />
                {/* Simplified empty state for demonstration */}
                <div className="bg-card p-20 rounded-[3rem] text-center border-2 border-dashed border-border">
                   <Users className="mx-auto text-muted-foreground/30 mb-4" size={64} />
                   <h3 className="text-xl font-bold text-muted-foreground">You are flying solo!</h3>
                   <p className="text-muted-foreground mb-8">Ready to vibrate the Yard? Start linking up with peers.</p>
                   <button 
                     onClick={() => setView('discover')}
                     className="bg-foreground text-background px-8 py-4 rounded-2xl font-black flex items-center gap-2 mx-auto hover:bg-primary transition-all"
                   >
                     <Sparkles size={18} /> Find My Major-Mates
                   </button>
                </div>
            </div>
        )}

        {view === 'discover' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                    {isLoading ? (
                        [...Array(6)].map((_, i) => (
                          <div key={i} className="space-y-3 p-4 border rounded-2xl"><Skeleton className="h-14 w-14 rounded-full" /><Skeleton className="h-5 w-3/4" /><Skeleton className="h-4 w-1/2" /><Skeleton className="h-10 w-full rounded-xl mt-4" /></div>
                        ))
                    ) : (
                        peopleToDiscover?.filter(p => p.id !== user?.id).map((person: User) => (
                            <CommunityConnectCard key={person.id} student={person} currentUser={user!} />
                        ))
                    )}
                </div>
            </div>
        )}
    </div>
  );
}
