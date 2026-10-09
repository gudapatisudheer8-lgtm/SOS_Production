import { Platform } from 'react-native';
import { currentToken } from '@/lib/session';

export interface Attachment { id: string; fileName: string; contentType: string; size: number }
export const MAX_BYTES = 10 * 1024 * 1024;
export const ALLOWED = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp4'];
export const ACCEPT = ALLOWED.join(',');
export const attachmentsSupported = Platform.OS === 'web' && typeof document !== 'undefined';

const base = () => (process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : '');

export function validateFile(f: { type: string; size: number }): string | null {
  const type = f.type.split(';')[0];
  if (!ALLOWED.includes(type)) return 'Only PDF, PNG, JPEG, WEBP and audio (webm, ogg, mpeg, mp4) files are accepted.';
  if (f.size > MAX_BYTES) return 'File exceeds the 10 MB limit.';
  if (f.size === 0) return 'File is empty.';
  return null;
}

/** Multipart upload. The generated client has no multipart endpoint and does not export customFetch, so this uses fetch with the session token. */
export async function uploadAttachment(projectId: string, file: Blob, name: string): Promise<Attachment> {
  const bad = validateFile(file);
  if (bad) throw new Error(bad);
  const fd = new FormData();
  fd.append('file', file, name);
  const token = currentToken();
  const res = await fetch(`${base()}/api/erp/${projectId}/attachments`, { method: 'POST', body: fd, credentials: 'include', headers: token ? { Authorization: `Bearer ${token}` } : undefined });
  if (!res.ok) {
    let m = `Upload failed (${res.status}).`;
    try { const j = await res.json(); if (j?.message) m = j.message; } catch { /* ignore */ }
    throw new Error(m);
  }
  return (await res.json()) as Attachment;
}

/** Protected download. The generated client cannot return blobs, so this uses fetch with the bearer token and checks the response. */
export async function fetchAttachmentBlob(projectId: string, id: string): Promise<Blob> {
  const token = currentToken();
  const res = await fetch(`${base()}/api/erp/${projectId}/attachments/${id}`, { credentials: 'include', headers: token ? { Authorization: `Bearer ${token}` } : undefined });
  if (!res.ok) {
    let m = res.status === 404 ? 'Attachment not found.' : res.status === 403 || res.status === 401 ? 'You do not have access to this attachment.' : `Download failed (${res.status}).`;
    try { const j = await res.json(); if (j?.message) m = j.message; } catch { /* body not JSON */ }
    throw new Error(m);
  }
  const b = await res.blob();
  if (b.size === 0) throw new Error('The attachment is empty.');
  return b;
}

export function pickFile(accept = ACCEPT): Promise<File | null> {
  return new Promise((resolve) => {
    if (!attachmentsSupported) return resolve(null);
    const i = document.createElement('input');
    i.type = 'file'; i.accept = accept;
    i.onchange = () => resolve(i.files?.[0] ?? null);
    i.click();
  });
}

export function saveBlob(blob: Blob, name: string) {
  if (!attachmentsSupported) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
}

export interface Recorder { stop: () => Promise<Blob> }
export async function startRecording(): Promise<Recorder> {
  if (!attachmentsSupported || !navigator.mediaDevices || typeof MediaRecorder === 'undefined') throw new Error('Voice recording is not supported in this browser.');
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mime = ['audio/webm', 'audio/ogg', 'audio/mp4'].find((m) => MediaRecorder.isTypeSupported(m));
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  rec.start();
  return { stop: () => new Promise<Blob>((res) => { rec.onstop = () => { stream.getTracks().forEach((t) => t.stop()); res(new Blob(chunks, { type: rec.mimeType || 'audio/webm' })); }; rec.stop(); }) };
}
