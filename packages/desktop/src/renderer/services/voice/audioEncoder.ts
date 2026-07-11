/**
 * @license
 * Copyright 2026 AionUi (aura.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Converts a Uint8Array containing PCM audio data into a Base64-encoded string.
 */
export function pcmToBase64(pcmData: Uint8Array): string {
  let binary = '';
  const len = pcmData.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(pcmData[i]);
  }
  return btoa(binary);
}

/**
 * Converts a Base64 string back into a Uint8Array.
 */
export function base64ToPcm(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}
