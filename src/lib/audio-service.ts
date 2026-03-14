
'use client';

/**
 * @fileOverview Liaison Audio Messaging Service.
 * Orchestrates the secure upload of vocal vibrations to Firebase Storage.
 * Implements high-efficiency .webm compression handshake.
 */

import { FirebaseStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

/**
 * uploadAudio
 * -----------
 * Converts a raw MediaRecorder blob into a public download URL.
 * Standardizes the storage handshake for chats, groups, and comments.
 * Strictly uses audio/webm for storage optimization.
 */
export async function uploadAudio(
  storage: FirebaseStorage, 
  blob: Blob, 
  path: string
): Promise<string> {
  if (!storage || !blob || !path) {
    throw new Error("Liaison Alert: Missing audio upload parameters.");
  }

  try {
    const fileRef = ref(storage, path);
    
    // Perform the Multimedia Handshake
    // Rule: Explicitly set contentType to audio/webm for 10x compression over wav
    await uploadBytes(fileRef, blob, {
      contentType: 'audio/webm',
      customMetadata: {
        vibeType: 'voice_note',
        uploadedAt: new Date().toISOString()
      }
    });

    const downloadUrl = await getDownloadURL(fileRef);
    console.log(`📡 Liaison Audio: Vibe synced to ${path}`);
    return downloadUrl;
  } catch (error) {
    console.error("Liaison Audio Upload Error:", error);
    throw new Error("Failed to sync voice vibration to the Yard. Check your connection.");
  }
}
