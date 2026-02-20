'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, setDocumentNonBlocking } from '@/firebase';
import { collection, query, where, getDocs, limit, doc } from 'firebase/firestore';
import { Loader2, Shuffle } from 'lucide-react';
import type { User } from '@/lib/types';

interface ConnectButtonProps {
  userId: string;
  campusId: string;
  connectToSameCampus: boolean;
}

export function ConnectButton({ userId, campusId, connectToSameCampus }: ConnectButtonProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);

  const findRandomStudent = async () => {
    if (!firestore) return null;
    
    let q;
    if (connectToSameCampus) {
      // Find a student from the same campus, who is not the current user
      q = query(
        collection(firestore, 'users'),
        where('campusId', '==', campusId),
        where('id', '!=', userId),
        where('role', '==', 'student'),
        limit(20)
      );
    } else {
      // Find a student from a different campus
      q = query(
        collection(firestore, 'users'),
        where('campusId', '!=', campusId),
        where('role', '==', 'student'),
        limit(20)
      );
    }

    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      return null;
    }
    const students = querySnapshot.docs.map(doc => doc.data() as User);
    const randomIndex = Math.floor(Math.random() * students.length);
    return students[randomIndex];
  };

  const handleConnect = async () => {
    if (!firestore) return;
    setIsLoading(true);

    const randomStudent = await findRandomStudent();

    if (!randomStudent) {
      toast({
        variant: 'destructive',
        title: 'No students found',
        description: 'Could not find any students to connect with at this time.',
      });
      setIsLoading(false);
      return;
    }

    const connectionId = [userId, randomStudent.id].sort().join('_');
    const connectionRef = doc(firestore, 'connections', connectionId);

    const connectionData = {
      fromUserId: userId,
      toUserId: randomStudent.id,
      fromCampusId: campusId,
      toCampusId: randomStudent.campusId,
      createdAt: new Date().toISOString(),
      status: 'pending',
      isInterCampus: campusId !== randomStudent.campusId,
    };
    
    setDocumentNonBlocking(connectionRef, connectionData, {});

    toast({
      title: 'Connection Request Sent!',
      description: `Your link-up request to ${randomStudent.name} has been sent.`,
    });
    
    setIsLoading(false);
  };

  const buttonText = connectToSameCampus
    ? 'Connect with a student from your campus'
    : 'Connect with a student from another campus';

  return (
    <Button onClick={handleConnect} disabled={isLoading} className="w-full">
      {isLoading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Shuffle className="mr-2 h-4 w-4" />
      )}
      {buttonText}
    </Button>
  );
}
