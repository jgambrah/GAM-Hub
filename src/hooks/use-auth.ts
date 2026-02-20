'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useDoc, useFirestore, useMemoFirebase, useCollection, useAuth as useAuthInstance } from '@/firebase';
import type { User as AppUser, Campus } from '@/lib/types';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
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

export const useAuth = (): AuthState => {
  const { isUserLoading: isAuthLoading } = useUser();
  const firestore = useFirestore();
  const auth = useAuthInstance();
  const router = useRouter();
  
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isTokenReady, setIsTokenReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCandidate, setIsCandidate] = useState(false);

  // ✅ THE CRITICAL FIX: Force Token Refresh on Auth State Change
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setFirebaseUser(user);
        try {
          // 1. Force refresh token to pick up latest custom claims
          const idTokenResult = await user.getIdTokenResult(true);
          const claims = idTokenResult.claims;
          
          setIsAdmin(!!claims.isAdmin || !!claims.superAdmin || user.email === 'admin@gamhub.com');
          setIsCandidate(!!claims.isCandidate);
          
          // 2. Signal that the token is fresh and custom claims are active
          setIsTokenReady(true);
          console.log("Liaison Sync: Auth Token is fresh and claims are active.");
        } catch (err) {
          console.error("Liaison Sync Error:", err);
          setIsTokenReady(true); // Fallback to proceed even if claims check fails
        }
      } else {
        setFirebaseUser(null);
        setIsTokenReady(false);
        setIsAdmin(false);
        setIsCandidate(false);
      }
    });
    return () => unsubscribe();
  }, [auth]);

  // Redirect if definitely not logged in
  useEffect(() => {
    if (!isAuthLoading && !firebaseUser && isTokenReady === false) {
      const timer = setTimeout(() => {
        if (!auth.currentUser) router.replace('/login');
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [firebaseUser, isAuthLoading, isTokenReady, auth, router]);

  // Memoize the document reference to the user's profile in Firestore
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

  // Overall loading state depends on TOKEN READINESS
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