'use client';

import React, { useState } from 'react';
import { useFirebase, useCollection, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { useAuth } from '@/hooks/use-auth';
import { collection, query, where, orderBy, doc, serverTimestamp } from 'firebase/firestore';
import type { Chat, User, Message } from '@/lib/types';
import { Loader2, Send } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ForwardMessageModalProps {
  message: Message;
  isOpen: boolean;
  onClose: () => void;
}

export function ForwardMessageModal({ message, isOpen, onClose }: ForwardMessageModalProps) {
  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [isForwarding, setIsForwarding] = useState(false);

  const chatsQuery = useMemoFirebase(() => {
    if (!firestore || !currentUser) return null;
    return query(
      collection(firestore, 'chats'),
      where('users', 'array-contains', currentUser.id),
      orderBy('updatedAt', 'desc')
    );
  }, [firestore, currentUser]);

  const { data: chats, isLoading } = useCollection<Chat>(chatsQuery);

  const handleForward = async () => {
    if (!selectedChatId || !firestore || !currentUser) return;
    setIsForwarding(true);

    try {
      const forwardedMessageData: Partial<Message> = {
        text: message.text,
        mediaUrl: message.mediaUrl,
        type: message.type,
        senderId: currentUser.id,
        senderName: currentUser.name || "User",
        createdAt: new Date().toISOString(),
        isForwarded: true,
        replyTo: null, 
      };
      
      await addDocumentNonBlocking(collection(firestore, 'chats', selectedChatId, 'messages'), forwardedMessageData);
      
      await updateDocumentNonBlocking(doc(firestore, 'chats', selectedChatId), {
        lastMessage: `Forwarded: ${message.text || 'Media'}`,
        updatedAt: new Date().toISOString(),
      });
      
      toast({ title: 'Message Forwarded', description: 'Your message has been sent.' });
      onClose();

    } catch (error) {
      console.error('Failed to forward message:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not forward message.' });
    } finally {
      setIsForwarding(false);
    }
  };

  const getOtherUser = (chat: Chat) => {
    if (!currentUser) return null;
    return chat.userAInfo?.id === currentUser.id ? chat.userBInfo : chat.userAInfo;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Forward Message To...</DialogTitle>
          <DialogDescription>Select a conversation to forward this message to.</DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <ScrollArea className="h-72">
            <div className="space-y-2">
              {isLoading && <p>Loading connections...</p>}
              {chats?.map((chat) => {
                const otherUser = getOtherUser(chat);
                if (!otherUser) return null;
                return (
                  <div
                    key={chat.id}
                    onClick={() => setSelectedChatId(chat.id)}
                    className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${selectedChatId === chat.id ? 'bg-primary/10' : 'hover:bg-muted'}`}
                  >
                    <Avatar>
                      <AvatarImage src={otherUser.avatarUrl} />
                      <AvatarFallback>{otherUser.name?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span className="font-semibold">{otherUser.name}</span>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>
        <Button onClick={handleForward} disabled={!selectedChatId || isForwarding}>
          {isForwarding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
          Forward
        </Button>
      </DialogContent>
    </Dialog>
  );
}
