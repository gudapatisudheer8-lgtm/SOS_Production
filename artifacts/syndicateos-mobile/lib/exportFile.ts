import { Platform } from 'react-native';

/** Saves/share a text file. Web: browser download. Native: cache File + system share sheet. Throws on failure. */
export async function exportText(name: string, text: string, mime: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof document === 'undefined') throw new Error('File export is not available in this environment.');
    const url = URL.createObjectURL(new Blob([text], { type: mime }));
    const a = document.createElement('a'); a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  const { File, Paths } = await import('expo-file-system');
  const Sharing = await import('expo-sharing');
  const file = new File(Paths.cache, name.replace(/[^\w.-]+/g, '_'));
  if (file.exists) file.delete();
  file.create();
  file.write(text);
  if (!(await Sharing.isAvailableAsync())) throw new Error(`Saved to app cache (${file.uri}), but sharing is not available on this device.`);
  await Sharing.shareAsync(file.uri, { mimeType: mime, dialogTitle: name, UTI: mime === 'text/csv' ? 'public.comma-separated-values-text' : undefined });
}

export const escapeHtml = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] as string);

/** Prints an HTML table. Web: window.print of the current page. Native: expo-print system dialog. */
export async function printTable(title: string, subtitle: string, head: string[], rows: string[][], foot?: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') throw new Error('Printing is not available in this environment.');
    window.print(); return;
  }
  const Print = await import('expo-print');
  const html = `<!doctype html><html><head><meta charset="utf-8"/><style>
body{font-family:-apple-system,Roboto,sans-serif;color:#111827;padding:18px}h1{font-size:18px;margin:0}p{color:#6b7280;font-size:11px;margin:4px 0 12px}
table{width:100%;border-collapse:collapse;font-size:10px}th{background:#F4F4F6;text-align:left}th,td{border:1px solid #e5e7eb;padding:5px}td.n{text-align:right;font-family:monospace}
.f{margin-top:10px;font-size:11px;font-weight:700}</style></head><body><h1>${escapeHtml(title)}</h1><p>${escapeHtml(subtitle)}</p>
<table><thead><tr>${head.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c, i) => `<td${i === r.length - 1 ? ' class="n"' : ''}>${escapeHtml(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>
${foot ? `<div class="f">${escapeHtml(foot)}</div>` : ''}</body></html>`;
  await Print.printAsync({ html });
}
