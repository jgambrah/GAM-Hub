
'use client';

/**
 * @fileOverview Liaison Fraud Protection Utility.
 * Orchestrates device fingerprinting and suspicious activity logging.
 */

import { Firestore, doc, setDoc, addDoc, collection, serverTimestamp, getDoc } from 'firebase/firestore';
import { addDocumentNonBlocking } from '@/firebase';

/**
 * generateDeviceHash
 * ------------------
 * Generates a non-invasive hardware fingerprint based on browser signals.
 */
export async function generateDeviceHash(): Promise<string> {
  if (typeof window === 'undefined') return 'server';
  
  const signals = [
    navigator.userAgent,
    screen.width,
    screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    navigator.language
  ].join('|');

  // Convert to high-fidelity hash
  const msgBuffer = new TextEncoder().encode(signals);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * registerUserDevice
 * ------------------
 * Maps a user to their current device fingerprint for Sybil protection.
 */
export async function registerUserDevice(firestore: Firestore, userId: string) {
  if (!firestore || !userId) return;

  const deviceHash = await generateDeviceHash();
  const deviceId = `${userId}_${deviceHash.slice(0, 16)}`;
  const deviceRef = doc(firestore, 'user_devices', deviceId);

  try {
    const snap = await getDoc(deviceRef);
    if (!snap.exists()) {
      await setDoc(deviceRef, {
        userId,
        deviceHash,
        createdAt: serverTimestamp(),
        lastSeen: serverTimestamp()
      });
    } else {
      await setDoc(deviceRef, { lastSeen: serverTimestamp() }, { merge: true });
    }
  } catch (err) {
    console.warn("Liaison Shield: Device registry drifted.");
  }
}

/**
 * logSuspiciousActivity
 * ---------------------
 * Official entry point for flagging Arena anomalies.
 */
export function logSuspiciousActivity(
  firestore: Firestore,
  params: {
    type: 'suspicious_votes' | 'multi_account_device' | 'gift_spam';
    userId: string;
    battleId?: string;
    details: string;
  }
) {
  if (!firestore) return;

  const logData = {
    ...params,
    timestamp: serverTimestamp()
  };

  addDocumentNonBlocking(collection(firestore, 'fraud_logs'), logData);
  console.log(`🛡️ Liaison Shield: Fraud logged - ${params.type} for user ${params.userId.slice(-6)}`);
}
