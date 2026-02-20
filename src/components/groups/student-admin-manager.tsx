'use client';
import { useFirebase, useCollection, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { collection, query, where, doc, writeBatch, arrayUnion, serverTimestamp } from 'firebase/firestore';
import type { GroupRequest, Group } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Button } from '../ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, XCircle, UserPlus } from 'lucide-react';
import React from 'react';
import { Skeleton } from '../ui/skeleton';

export function StudentAdminManager({ group }: { group: Group }) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [loadingAction, setLoadingAction] = React.useState<string | null>(null);

  const requestsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'group_requests'),
      where('groupId', '==', group.id),
      where('status', '==', 'pending')
    );
  }, [firestore, group.id]);

  const { data: requests, isLoading } = useCollection<GroupRequest>(requestsQuery);

  const handleAction = async (request: GroupRequest, approve: boolean) => {
    if (!firestore) return;
    setLoadingAction(request.id);

    try {
      if (approve) {
        const batch = writeBatch(firestore);
        
        // 1. Add to members array in group doc
        const groupRef = doc(firestore, 'groups', group.id);
        batch.update(groupRef, {
          members: arrayUnion(request.userId)
        });

        // 2. Mark request as approved
        const requestRef = doc(firestore, 'group_requests', request.id);
        batch.update(requestRef, { 
          status: 'approved',
          approvedAt: serverTimestamp()
        });

        await batch.commit();
        toast({ title: "Member Admitted!", description: `${request.userName} is now part of the community.` });
      } else {
        // Just reject the request
        const requestRef = doc(firestore, 'group_requests', request.id);
        updateDocumentNonBlocking(requestRef, { status: 'rejected' });
        toast({ title: "Request Declined", description: `The request from ${request.userName} has been removed.`, variant: 'destructive' });
      }
    } catch (err) {
      console.error("Admissions Error:", err);
      toast({ variant: 'destructive', title: "Liaison Error", description: "Could not process entry request." });
    } finally {
      setLoadingAction(null);
    }
  };

  if (isLoading) {
    return (
        <div className="space-y-4">
            <Skeleton className="h-16 w-full rounded-[1.8rem]" />
            <Skeleton className="h-16 w-full rounded-[1.8rem]" />
        </div>
    );
  }

  if (!requests || requests.length === 0) {
    return (
        <div className="text-center py-16 bg-muted/30 rounded-[2.5rem] border-2 border-dashed border-border/50">
            <UserPlus className="mx-auto text-muted-foreground/30 mb-4" size={48} />
            <p className="text-sm font-black text-muted-foreground uppercase tracking-widest">Vetting Queue Clear</p>
            <p className="text-[10px] text-muted-foreground/60 mt-2 italic">No one is currently waiting at the door.</p>
        </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-2 mb-2">
        <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            Awaiting Handshake ({requests.length})
        </h4>
      </div>
      
      {requests.map((req) => (
        <div key={req.id} className="group flex items-center justify-between p-4 bg-white dark:bg-muted/20 border-2 border-border/50 rounded-[2rem] hover:border-primary/30 transition-all shadow-sm">
          <div className="flex items-center gap-4">
             <Avatar className="h-12 w-12 border-2 border-background shadow-sm">
                <AvatarImage src={req.userAvatarUrl} />
                <AvatarFallback className="font-black">{req.userName.charAt(0)}</AvatarFallback>
            </Avatar>
            <div>
                <p className="font-black text-sm text-foreground leading-none">{req.userName}</p>
                <p className="text-[10px] font-bold text-blue-500 uppercase tracking-tighter mt-1">{req.userCampusId}</p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => handleAction(req, false)}
              disabled={loadingAction === req.id}
              className="p-3 rounded-xl text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all disabled:opacity-50"
            >
              <XCircle size={20} />
            </button>
            <button
              onClick={() => handleAction(req, true)}
              disabled={loadingAction === req.id}
              className="px-6 py-3 bg-slate-900 dark:bg-primary text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {loadingAction === req.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle size={14} /> Admit</>}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
