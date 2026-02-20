'use client';

import * as React from 'react';
import type { User } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, setDocumentNonBlocking } from '@/firebase';
import { doc } from 'firebase/firestore';
import { GraduationCap, Link2, Briefcase, ShieldCheck, MessageSquare } from 'lucide-react';
import { campuses } from '@/lib/data';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';

interface CommunityConnectCardProps {
  student: User;
  currentUser: User;
}

export function CommunityConnectCard({ student: person, currentUser }: CommunityConnectCardProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const router = useRouter();
  const { isAdmin } = useAuth();
  const isStaff = person.role === 'staff';

  const campusInfo = campuses.find(c => c.id === person.campusId);
  const campusColor = campusInfo?.primaryColor || '#3F51B5';

  const handleLinkUp = () => {
    if (!firestore || !currentUser) return;

    // Create the Connection Request
    const connectionId = [currentUser.id, person.id].sort().join('_');
    const connectionRef = doc(firestore, 'connections', connectionId);

    const connectionData = {
      fromUserId: currentUser.id,
      toUserId: person.id,
      fromCampusId: currentUser.campusId,
      toCampusId: person.campusId,
      status: 'pending',
      createdAt: new Date().toISOString(),
      isInterCampus: currentUser.campusId !== person.campusId,
    };
    setDocumentNonBlocking(connectionRef, connectionData, { merge: true });

    toast({
      title: 'Request Sent!',
      description: `Your link-up request to ${person.name} has been sent.`,
    });
  };

  const handleAdminMessage = () => {
    if (!firestore || !currentUser) return;
    
    const chatId = [currentUser.id, person.id].sort().join('_');
    const chatRef = doc(firestore, 'chats', chatId);
    const chatData = {
        users: [currentUser.id, person.id],
        updatedAt: new Date().toISOString(),
        userAInfo: {
            id: currentUser.id,
            name: currentUser.name,
            avatarUrl: currentUser.avatarUrl
        },
        userBInfo: {
            id: person.id,
            name: person.name,
            avatarUrl: person.avatarUrl
        },
        lastMessage: `Liaison has started a support chat.`
    };
    setDocumentNonBlocking(chatRef, chatData, { merge: true });

    toast({
      title: 'Support Chat Opened',
      description: `A direct message with ${person.name} has been created.`,
    });
    
    router.push('/chat');
  };

  return (
    <div className={cn(
      "bg-card rounded-2xl shadow-sm hover:shadow-lg transition-shadow border overflow-hidden max-w-sm",
      isStaff && 'border-blue-200'
    )}>
      <div 
        className="h-2 w-full" 
        style={{ backgroundColor: campusColor }} 
      />

      <div className="p-5">
        <div className="flex justify-between items-start mb-4">
          <div className="relative">
            <Avatar className="w-14 h-14 border-2 border-card shadow-sm">
                <AvatarImage src={person.avatarUrl} alt={person.name} />
                <AvatarFallback>{person.name?.charAt(0)}</AvatarFallback>
            </Avatar>
             {isStaff && (
               <div className="absolute -top-1 -right-1 bg-blue-600 text-white p-1 rounded-full border-2 border-card">
                 <ShieldCheck size={10} />
               </div>
             )}
          </div>
          
          <Badge variant="secondary" className={cn('font-bold', isStaff && 'bg-blue-100 text-blue-700 hover:bg-blue-100/80')}>
            {isStaff ? 'University Staff' : 'Student'}
          </Badge>
        </div>

        <h3 className="font-bold text-foreground flex items-center gap-1.5">
          {person.name} 
        </h3>
        
        <div className="flex items-center text-muted-foreground text-sm mt-1">
          {isStaff ? <Briefcase size={14} className="mr-2" /> : <GraduationCap size={14} className="mr-2" />}
          {isStaff ? person.designation : person.major}
        </div>
        
        {isStaff && person.department && (
            <p className="text-xs text-muted-foreground mt-1">{person.department}</p>
        )}
        
        {isAdmin ? (
          <Button 
            onClick={handleAdminMessage}
            className="w-full mt-5 rounded-xl text-sm font-bold bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            <MessageSquare size={16} /> Message Student
          </Button>
        ) : (
          <Button 
            onClick={handleLinkUp}
            className="w-full mt-5 rounded-xl text-sm font-bold"
            style={{ backgroundColor: campusColor, color: '#fff' }}
          >
            <Link2 size={16} /> Link Up
          </Button>
        )}
      </div>
    </div>
  );
}