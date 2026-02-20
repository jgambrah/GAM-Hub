'use client';

import { doc, updateDoc, arrayRemove } from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import { useAuth } from '@/hooks/use-auth';
import { LogOut, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import * as React from 'react';

export function ExitGroupButton({ groupId }: { groupId: string }) {
  const { firestore } = useFirebase();
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [isLoading, setIsLoading] = React.useState(false);

  const handleExit = async () => {
    if (!firestore || !user || !confirm("Are you sure you want to leave this community?")) return;

    setIsLoading(true);
    try {
      const groupRef = doc(firestore, 'groups', groupId);
      await updateDoc(groupRef, {
        members: arrayRemove(user.id)
      });
      toast({
        title: "You've left the community",
      });
      router.push("/groups");
      router.refresh(); // To ensure the list updates
    } catch (err) {
      console.error("Error exiting group:", err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not leave the community.'
      });
      setIsLoading(false);
    }
  };

  return (
    <Button 
      onClick={handleExit}
      variant="destructive"
      size="sm"
      disabled={isLoading}
      className="bg-red-50 text-red-600 hover:bg-red-100"
    >
      {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut size={14} />}
       Exit Community
    </Button>
  );
}
