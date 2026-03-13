'use client';

/**
 * @fileOverview Liaison Trend Detection Engine: Data Collection Utility.
 * Captures raw real-time behavioral signals across the Yard.
 */

import { collection, serverTimestamp, Firestore } from 'firebase/firestore';
import { addDocumentNonBlocking } from '@/firebase';

export type TrendEventType = 
  | 'video_view' 
  | 'video_like' 
  | 'video_share' 
  | 'product_view' 
  | 'product_purchase' 
  | 'vendor_visit' 
  | 'hashtag_click';

/**
 * logTrendEvent
 * -------------
 * Non-blocking logger for raw vibrations.
 * This powers the Real-Time Aggregator Cloud Function.
 */
export function logTrendEvent(
  firestore: Firestore,
  event: {
    type: TrendEventType;
    entityId: string;
    campusId: string;
    tag?: string;
    metadata?: any;
  }
) {
  if (!firestore) return;
  
  const colRef = collection(firestore, 'trend_events');
  
  // 🛡️ LIAISON SECURITY: Sanitize data to prevent Firebase "undefined" errors
  const data: any = {
    type: event.type,
    entityId: event.entityId,
    campusId: event.campusId || 'all',
    timestamp: serverTimestamp(),
  };

  // Only add fields if they are actually defined
  if (event.tag !== undefined && event.tag !== null) {
    data.tag = event.tag;
  }

  if (event.metadata !== undefined && event.metadata !== null) {
    data.metadata = event.metadata;
  }

  addDocumentNonBlocking(colRef, data);
}
