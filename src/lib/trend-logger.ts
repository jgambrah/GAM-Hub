
'use client';

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
 * Non-blocking logger for raw real-time behavioral signals.
 * These raw events power the high-velocity trend detection engine of the Yard.
 */
export function logTrendEvent(
  firestore: Firestore,
  params: {
    type: TrendEventType;
    entityId: string;
    campusId: string;
    tag?: string;
    metadata?: any;
  }
) {
  if (!firestore) return;
  
  const colRef = collection(firestore, 'trend_events');
  addDocumentNonBlocking(colRef, {
    type: params.type,
    entityId: params.entityId,
    campusId: params.campusId,
    tag: params.tag || null,
    metadata: params.metadata || {},
    timestamp: serverTimestamp(),
  });
}
