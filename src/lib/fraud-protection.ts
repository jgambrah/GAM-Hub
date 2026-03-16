
'use client';

/**
 * @fileOverview Liaison Fraud Protection Utility.
 * Orchestrates device fingerprinting, suspicious activity logging, and bot behavior analysis.
 */

import { Firestore, doc, setDoc, addDoc, collection, serverTimestamp, getDoc, increment } from 'firebase/firestore';
import { addDocumentNonBlocking } from '@/firebase';
import type { UserBehavior } from './types';

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
 * trackUserBehavior
 * -----------------
 * Records specific engagement metrics for bot-pattern analysis.
 */
export async function trackUserBehavior(
  firestore: Firestore,
  userId: string,
  type: 'vote' | 'gift' | 'watch',
  value: number = 1
) {
  if (!firestore || !userId) return;

  const behaviorRef = doc(firestore, 'user_behavior', userId);
  const field = type === 'vote' ? 'votesToday' : type === 'gift' ? 'giftsSent' : 'watchTime';

  try {
    await setDoc(behaviorRef, {
      [field]: increment(value),
      lastUpdated: serverTimestamp()
    }, { merge: true });

    // 🕵️ AUTO-AUDIT: Check for bot patterns on every interaction
    if (type === 'vote' || type === 'gift') {
        const snap = await getDoc(behaviorRef);
        if (snap.exists()) {
            const data = snap.data() as UserBehavior;
            await checkAndFlagBotPatterns(firestore, userId, data);
        }
    }
  } catch (err) {
    console.warn("Liaison Shield: Behavior log drifted.");
  }
}

/**
 * checkAndFlagBotPatterns
 * -----------------------
 * Internal analyzer for bot patterns.
 * Patterns: High Voting + Low Watch Time OR High Gift Spam.
 */
async function checkAndFlagBotPatterns(firestore: Firestore, userId: string, data: UserBehavior) {
    // 1. High Voting Anomaly (>100 votes with <5 mins watch time)
    if (data.votesToday > 100 && data.watchTime < 300) {
        await logSuspiciousActivity(firestore, {
            type: 'bot_pattern',
            userId,
            details: `Hyper-voting detected: ${data.votesToday} votes with only ${data.watchTime}s watch time. High probability of script.`
        });
        // Temporary block logic would be handled by cloud functions or Liaison review
    }

    // 2. Gift Spam Anomaly (>50 gifts in a single session)
    if (data.giftsSent > 50) {
        await logSuspiciousActivity(firestore, {
            type: 'gift_spam',
            userId,
            details: `Gift spam detected: ${data.giftsSent} unique transactions in current window.`
        });
    }
}

/**
 * isBotSuspicionCheck
 * -------------------
 * Quick check before critical Arena actions.
 */
export async function isBotSuspicionCheck(firestore: Firestore, userId: string): Promise<boolean> {
    if (!firestore || !userId) return false;
    const snap = await getDoc(doc(firestore, 'user_behavior', userId));
    if (snap.exists()) {
        const data = snap.data() as UserBehavior;
        return data.isBlocked === true;
    }
    return false;
}

/**
 * logSuspiciousActivity
 * ---------------------
 * Official entry point for flagging Arena anomalies.
 */
export function logSuspiciousActivity(
  firestore: Firestore,
  params: {
    type: 'suspicious_votes' | 'multi_account_device' | 'gift_spam' | 'bot_pattern';
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
