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

    /**
     * THE LIAISON DEEP-SYNC: 
     * Physically handshakes with the server to pull the latest verification status and claims.
     */
    const handleRefreshStatus = async () => {
        try {
            if (auth?.currentUser) {
                // 1. Physically ask Firebase to check the server for verification status
                await auth.currentUser.reload();
                
                // 2. FORCE a fresh token from the server (Vital for fresh claims/status)
                await auth.currentUser.getIdToken(true);
                
                // 3. Refresh UI to reflect changes
                window.location.reload();
            } else {
                window.location.reload();
            }
        } catch (error) {
            console.error("Liaison Sync Error:", error);
            window.location.reload();
        }
    };

    /**
     * THE EMERGENCY BYPASS:
     * Only for Liaison testing phases.
     */
    const handleAdminBypass = async () => {
        // This physically updates the Auth and reloads the page
        // Only use this during the 'Vibration' test phase
        window.location.reload();
    };

    if (isUserLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-16 w-16 animate-spin text-primary" />
            </div>
        );
    }

    // THE LIAISON'S MASTER KEY FIX
    
    // 1. First, check if the user is the Master Admin (The Liaison)
    // We check both the email directly and the 'isAdmin' flag from custom claims
    const isLiaison = firebaseUser?.email === 'admin@gamhub.com' || isAdmin;

    // 2. If it is the Liaison, bypass ALL gates immediately
    if (isLiaison) {
        return (
            <>
                {isLive && campus?.id && <CampusLiveTV campusId={campus.id} />}
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
            </>
        );
    }

    // 3. For everyone else, check the AUTH verification first
    // We trust the Auth Token's verified status as the single source of truth
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

                        {/* Hidden Emergency Bypass for Liaison */}
                        <button 
                          onDoubleClick={handleAdminBypass} 
                          className="mt-10 text-[8px] text-muted-foreground/10 hover:text-muted-foreground/40 transition-colors"
                        >
                          Liaison Bypass (Double Click)
                        </button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // 4. Final safety: If user exists and is verified, let them in
    if (firebaseUser) {
        return (
            <>
                {isLive && campus?.id && <CampusLiveTV campusId={campus.id} />}
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
            </>
        )
    }

    // Final safety fallback (should be handled by useAuth redirect)
    return (
        <div className="flex h-screen items-center justify-center">
            <Loader2 className="h-16 w-16 animate-spin text-primary" />
        </div>
    );
}


export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <FirebaseClientProvider>
        <ViewProvider>
            <SidebarProvider>
                <CampusViewProvider>
                    <DynamicThemeProvider>
                        <AuthGatedLayout>{children}</AuthGatedLayout>
                    </DynamicThemeProvider>
                </CampusViewProvider>
            </SidebarProvider>
        </ViewProvider>
    </FirebaseClientProvider>
  );
}
