
'use client';

/**
 * useNotifications Hook
 * --------------------
 * Orchestrates device token registration and foreground message handling.
 * Synchronizes with the Yard's Push Notification Node.
 */

import { useEffect, useState } from 'react';
import { useFirebase, updateDocumentNonBlocking } from '@/firebase';
import { useAuth } from '@/hooks/use-auth';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { doc } from 'firebase/firestore';

export function useNotifications() {
  const { firestore, firebaseApp } = useFirebase();
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    // 🛡️ SECURITY GUARD: FCM requires browser context and authenticated user
    if (typeof window === 'undefined' || !user?.id || !firestore || !firebaseApp) return;

    if (!("Notification" in window)) {
      console.warn("Liaison Alert: Browser does not support push notifications.");
      return;
    }

    const registerPushProtocol = async () => {
      try {
        const messaging = getMessaging(firebaseApp);
        
        // 1. Request Permission
        const status = await Notification.requestPermission();
        setPermission(status);

        if (status === 'granted') {
          // 2. Get Device Token
          const token = await getToken(messaging, {
            // Liaison Note: Replace with your actual VAPID key from Firebase Console
            vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
          });

          if (token && token !== user.fcmToken) {
            // 3. Handshake: Sync token to user profile
            const userRef = doc(firestore, 'users', user.id);
            updateDocumentNonBlocking(userRef, { fcmToken: token });
            console.log("🔔 Liaison: Device push token synced to Yard.");
          }
        }
      } catch (err) {
        console.warn("🔔 Liaison: Notification protocol failed:", err);
      }
    };

    registerPushProtocol();

    // 4. Foreground Listener: Handle vibes while user is active
    const messaging = getMessaging(firebaseApp);
    const unsubscribe = onMessage(messaging, (payload) => {
      console.log('🔔 Liaison: Foreground vibe received:', payload);
      // Native browser notification if user allows
      if (Notification.permission === 'granted') {
          new Notification(payload.notification?.title || "New Vibe", {
              body: payload.notification?.body,
              icon: '/favicon.ico'
          });
      }
    });

    return () => unsubscribe();
  }, [user?.id, firestore, firebaseApp]);

  return { permission };
}
