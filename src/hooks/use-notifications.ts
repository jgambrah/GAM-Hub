
'use client';

import { useEffect, useState } from 'react';
import { useFirebase, updateDocumentNonBlocking } from '@/firebase';
import { useAuth } from '@/hooks/use-auth';
import { saveFcmToken } from '@/lib/market-intelligence';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { collection, query, where, orderBy, limit, getDocs, doc } from 'firebase/firestore';

/**
 * useNotifications Hook
 * --------------------
 * Orchestrates device token registration and foreground message handling.
 * Now expanded with Analytics Tracking for Open/Click events.
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

    if (Notification.permission !== 'granted') {
        setPermission(Notification.permission);
    }

    const registerToken = async () => {
      try {
        const messaging = getMessaging(firebaseApp);
        
        // Request permission
        const status = await Notification.requestPermission();
        setPermission(status);

        if (status === 'granted') {
          // Get FCM Token
          const token = await getToken(messaging, {
            vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
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

    // 📈 ANALYTICS: Listener for foreground notifications
    const messaging = getMessaging(firebaseApp);
    const unsubscribe = onMessage(messaging, async (payload) => {
      console.log('🔔 Liaison: Foreground Vibe Received:', payload);
      
      // LOG OPEN EVENT: Since the user is active in the app when this fires
      if (payload.data?.productId) {
          try {
              const q = query(
                  collection(firestore, 'notifications'),
                  where('userId', '==', user.id),
                  where('relatedProductId', '==', payload.data.productId),
                  orderBy('sentAt', 'desc'),
                  limit(1)
              );
              const snap = await getDocs(q);
              if (!snap.empty) {
                  const notifRef = doc(firestore, 'notifications', snap.docs[0].id);
                  updateDocumentNonBlocking(notifRef, { opened: true, clicked: true });
              }
          } catch (e) {
              console.warn("Analytics Sync Failed:", e);
          }
      }
    });

    return () => unsubscribe();
  }, [user?.id, firestore, firebaseApp]);

  return { permission };
}
