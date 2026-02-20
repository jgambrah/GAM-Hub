'use client';
import * as React from 'react';
import { ChatSidebar } from '@/components/chat/chat-sidebar';
import PrivateChat from '@/components/social/PrivateChat';
import type { Chat } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { MessagesSquare } from 'lucide-react';

export default function ChatPage() {
  const [selectedChat, setSelectedChat] = React.useState<Chat | null>(null);
  const { user, isUserLoading } = useAuth();
  const { firestore } = useFirebase();

  const chatsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, 'chats'),
      where('users', 'array-contains', user.id),
      orderBy('updatedAt', 'desc')
    );
  }, [firestore, user]);

  const { data: chats, isLoading: isLoadingChats } = useCollection<Chat>(chatsQuery);
  const isLoading = isUserLoading || isLoadingChats;

  const otherUser = selectedChat && user 
    ? (selectedChat.userAInfo?.id === user.id ? selectedChat.userBInfo : selectedChat.userAInfo)
    : null;

  return (
    <div className="flex h-[calc(100vh-theme(spacing.16))] border-t">
      <ChatSidebar 
        chats={chats} 
        isLoading={isLoading} 
        selectedChat={selectedChat} 
        onSelectChat={setSelectedChat}
        currentUser={user}
      />
      <div className="flex-1 flex flex-col">
        {selectedChat && otherUser ? (
            <PrivateChat key={selectedChat.id} chatId={selectedChat.id} otherUser={otherUser} />
        ) : (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground bg-muted/20">
                <MessagesSquare className="h-12 w-12 mb-4" />
                <h3 className="text-lg font-semibold">Select a conversation</h3>
                <p className="text-sm">Or search for someone to start a new one.</p>
            </div>
        )}
      </div>
    </div>
  );
}
