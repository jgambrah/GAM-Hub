'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useDoc, useFirestore, useMemoFirebase, useCollection, useAuth as useAuthInstance } from '@/firebase';
import type { User as AppUser, Campus } from '@/lib/types';
import { onIdTokenChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, collection } from 'firebase/firestore';

interface AuthState {
  user: AppUser | null;
  firebaseUser: FirebaseUser | null;
  campus: Campus | null;
  isUserLoading: boolean;
  isAdmin: boolean;
  isCandidate: boolean;
  isTokenReady: boolean;
}

// Global variable to track claims across re-renders/loop prevention
declare global {
  interface Window {
    __LAST_CLAIMS__?: string;
  }
}

export const useAuth = (): AuthState => {
  const { isUserLoading: isAuthLoading } = useUser();
  const firestore = useFirestore();
  const auth = useAuthInstance();
  const router = useRouter();
  
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isTokenReady, setIsTokenReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCandidate, setIsCandidate] = useState(false);

  /**
   * ✅ LIAISON SYNC DEBOUNCE
   * Prevents the infinite re-render loop by only updating state 
   * when custom claims have actually changed string-wise.
   */
  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (user) => {
      if (user) {
        setFirebaseUser(user);
        try {
          const idTokenResult = await user.getIdTokenResult();
          const claims = idTokenResult.claims;
          
          // CRITICAL: Stop the vibration loop
          const newClaimsString = JSON.stringify(claims);
          if (window.__LAST_CLAIMS__ !== newClaimsString) {
            window.__LAST_CLAIMS__ = newClaimsString;
            
            setIsAdmin(!!claims.isAdmin || !!claims.superAdmin || user.email === 'admin@gamhub.com' || user.uid === 'xYAuFJclD2UiUwPAUb4vqEaaKct2');
            setIsCandidate(!!claims.isCandidate);
            setIsTokenReady(true);
            
            console.log("🔑 Liaison Sync: Auth Token Refreshed (Claims Changed)");
          } else if (!isTokenReady) {
            setIsTokenReady(true);
          }
        } catch (err) {
          console.error("Liaison Sync Error:", err);
          setIsTokenReady(true);
        }
      } else {
        setFirebaseUser(null);
        setIsTokenReady(false);
        setIsAdmin(false);
        setIsCandidate(false);
        window.__LAST_CLAIMS__ = undefined;
      }
    });
    return () => unsubscribe();
  }, [auth]);

  // Redirect logic
  useEffect(() => {
    if (!isAuthLoading && !firebaseUser && isTokenReady === false) {
      const timer = setTimeout(() => {
        if (!auth.currentUser) router.replace('/login');
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [firebaseUser, isAuthLoading, isTokenReady, auth, router]);

  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !firebaseUser || !isTokenReady) return null;
    return doc(firestore, 'users', firebaseUser.uid);
  }, [firestore, firebaseUser, isTokenReady]);

  const { data: appUser, isLoading: isDocLoading } = useDoc<AppUser>(userDocRef);

  const campusesQuery = useMemoFirebase(() => {
    if (!firestore || !isTokenReady) return null;
    return collection(firestore, 'campuses');
  }, [firestore, isTokenReady]);
  
  const { data: allCampuses, isLoading: isLoadingCampuses } = useCollection<Campus>(campusesQuery);

  const campus = useMemo(() => {
    if (!appUser || !allCampuses) return null;
    return allCampuses.find(c => c.id === appUser.campusId) || null;
  }, [appUser, allCampuses]);
  
  const augmentedAppUser = useMemo(() => {
    if (appUser && campus) {
      return { ...appUser, campusAcronym: campus.acronym };
    }
    return appUser;
  }, [appUser, campus]);

  const isUserLoading = isAuthLoading || !isTokenReady || (firebaseUser ? (isDocLoading || isLoadingCampuses) : false);

  return {
    user: augmentedAppUser,
    firebaseUser,
    campus,
    isUserLoading,
    isAdmin,
    isCandidate,
    isTokenReady,
  };
};
