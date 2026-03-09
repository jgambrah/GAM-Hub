'use client';

import React from 'react';
import AppHeader from '@/components/layout/app-header';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { FirebaseClientProvider, useFirebase, useMemoFirebase, useDoc } from '@/firebase';
import { SidebarProvider } from '@/components/ui/sidebar';
import { DynamicThemeProvider } from '@/components/layout/dynamic-theme-provider';
import { CampusViewProvider } from '@/hooks/use-campus-view';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CampusAIGuide from '@/components/ai/CampusAIGuide';
import ImpersonatorTool from '@/components/admin/ImpersonatorTool';
import { ViewProvider, useView } from '@/context/ViewContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import BottomNav from '@/components/navigation/BottomNav';
import { doc } from 'firebase/firestore';
import type { LiveBroadcast } from '@/lib/types';
import { CampusLiveTV } from '@/components/social/CampusLiveTV';
import { VibePlayerProvider } from '@/components/social/VibePlayerContext';
import { VibeReactionBursts } from '@/components/social/VibeReactions';
import VibeMiniPlayer from '@/components/social/VibeMiniPlayer';

function AuthGatedLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isChatPage = pathname.startsWith('/chat');
    const isDisputesPage = pathname.startsWith('/admin/disputes');
    const isAnalyticsPage = pathname.startsWith('/admin/analytics');

    const { firestore, auth } = useFirebase();
    const { firebaseUser, isUserLoading, isAdmin, user, campus } = useAuth();
    const { setViewMode } = useView();

    // -- Live Broadcast Logic --
    const broadcastDocRef = useMemoFirebase(() => {
        if (!firestore || !campus?.id) return null;
        return doc(firestore, 'live_broadcasts', campus.id);
    }, [firestore, campus]);
    
    const { data: broadcast } = useDoc<LiveBroadcast>(broadcastDocRef);
    const isLive = broadcast?.status === 'live';
    // -------------------------

    const handleRefreshStatus = async () => {
        try {
            if (auth?.currentUser) {
                await auth.currentUser.reload();
                await auth.currentUser.getIdToken(true);
                window.location.reload();
            } else {
                window.location.reload();
            }
        } catch (error) {
            console.error("Liaison Sync Error:", error);
            window.location.reload();
        }
    };

    if (isUserLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-16 w-16 animate-spin text-primary" />
            </div>
        );
    }

    const isLiaison = firebaseUser?.email === 'admin@gamhub.com' || isAdmin;

    if (isLiaison) {
        return (
            <>
                {isLive && campus?.id && <CampusLiveTV campusId={campus.id} />}
                <VibeReactionBursts />
                <div className="flex min-h-screen bg-background">
                    <AppSidebar />
                    <div className="flex flex-1 flex-col">
                        <AppHeader />
                        <main className={cn("flex-1 pb-24", !isChatPage && !isDisputesPage && !isAnalyticsPage && "p-4 sm:p-6 lg:p-8")}>
                            {children}
                        </main>
                    </div>
                    <CampusAIGuide />
                    <ImpersonatorTool onRoleChange={setViewMode} />
                    <BottomNav />
                </div>
                <VibeMiniPlayer />
            </>
        );
    }

    if (firebaseUser && !firebaseUser.emailVerified) {
        const isVendor = user?.role === 'vendor';
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-gray-50 dark:bg-background p-4">
                 <Card className="p-8 rounded-[2.5rem] shadow-xl max-w-md text-center border-2 border-primary/10 relative overflow-hidden">
                    <CardHeader>
                        <CardTitle className="text-2xl font-black mb-4">
                           {isVendor ? "Verify Business Identity" : "Verify Campus Identity"}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground mb-8 leading-relaxed">
                           {isVendor 
                             ? "Please check your business email to confirm your GAM Hub account." 
                             : "Security Check: Please log into your University Webmail and click the link we sent to verify your student/staff status."}
                        </p>
                        <Button
                          onClick={handleRefreshStatus}
                          className="w-full py-6 rounded-2xl font-black bg-slate-900 text-white dark:bg-primary dark:text-primary-foreground shadow-lg active:scale-95 transition-all"
                          size="lg"
                        >
                           I've Clicked the Link
                        </Button>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-6">
                            Handshake Protocol Active
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (firebaseUser) {
        return (
            <>
                {isLive && campus?.id && <CampusLiveTV campusId={campus.id} />}
                <VibeReactionBursts />
                <div className="flex min-h-screen bg-background">
                    <AppSidebar />
                    <div className="flex flex-1 flex-col">
                        <AppHeader />
                        <main className={cn("flex-1 pb-24", !isChatPage && !isDisputesPage && !isAnalyticsPage && "p-4 sm:p-6 lg:p-8")}>
                            {children}
                        </main>
                    </div>
                    <CampusAIGuide />
                    <BottomNav />
                </div>
                <VibeMiniPlayer />
            </>
        )
    }

    return (
        <div className="flex h-screen items-center justify-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
    );
}


export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <FirebaseClientProvider>
        <ViewProvider>
            <SidebarProvider>
                <VibePlayerProvider>
                    <CampusViewProvider>
                        <DynamicThemeProvider>
                            <AuthGatedLayout>{children}</AuthGatedLayout>
                        </DynamicThemeProvider>
                    </CampusViewProvider>
                </VibePlayerProvider>
            </SidebarProvider>
        </ViewProvider>
    </FirebaseClientProvider>
  );
}
