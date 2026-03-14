'use client';

/**
 * @fileOverview Liaison Audio Messaging Service.
 * Orchestrates the secure upload of vocal vibrations to Firebase Storage.
 */

import { FirebaseStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

/**
 * uploadAudio
 * -----------
 * Converts a raw MediaRecorder blob into a public download URL.
 * Standardizes the storage handshake for chats, groups, and comments.
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
    await uploadBytes(fileRef, blob, {
      contentType: 'audio/webm',
      customMetadata: {
        vibeType: 'voice_note',
        uploadedAt: new Date().toISOString()
      }
    });

    return await getDownloadURL(fileRef);
  } catch (error) {
    console.error("Liaison Audio Upload Error:", error);
    throw new Error("Failed to sync voice vibration to the Yard.");
  }
}
