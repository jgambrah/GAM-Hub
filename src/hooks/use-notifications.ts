
'use client';

import { useEffect, useState } from 'react';
import { useFirebase } from '@/firebase';
import { useAuth } from '@/hooks/use-auth';
import { saveFcmToken } from '@/lib/market-intelligence';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

/**
 * useNotifications Hook
 * --------------------
 * Orchestrates device token registration and foreground message handling.
 */
export function useNotifications() {
  const { firestore, firebaseApp } = useFirebase();
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if (typeof window === 'undefined' || !user?.id || !firestore || !firebaseApp) return;

    // Check if browser supports notifications
    if (!("Notification" in window)) {
      console.warn("Liaison Alert: Browser does not support push notifications.");
      return;
    }

    setPermission(Notification.permission);

    const registerToken = async () => {
      try {
        const messaging = getMessaging(firebaseApp);
        
        // Request permission
        const status = await Notification.requestPermission();
        setPermission(status);

        if (status === 'granted') {
          // Get FCM Token
          const token = await getToken(messaging, {
            vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY // Ensure this is in your .env
          });

          if (token && token !== user.fcmToken) {
            await saveFcmToken(firestore, user.id, token);
            console.log("🔔 Liaison: Device token synced to Yard.");
          }
        }
      } catch (err) {
        console.error("🔔 Liaison: Notification registration failed:", err);
      }
    };

    registerToken();

    // Listener for foreground notifications
    const messaging = getMessaging(firebaseApp);
    const unsubscribe = onMessage(messaging, (payload) => {
      console.log('🔔 Liaison: Foreground Vibe Received:', payload);
      // In a real app, we'd trigger a custom toast here
    });

    return () => unsubscribe();
  }, [user?.id, firestore, firebaseApp]);

  return { permission };
}
