/** Match the private attachment API's plan formats and per-file size limit. */
export async function validatePlanFile(file: File): Promise<void> {
  const label = `"${file.name}"`;
  if (!file.size || file.size > 10 * 1024 * 1024) {
    throw new Error(`${label}: select a non-empty plan file of 10 MB or less.`);
  }
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const text = new TextDecoder().decode(bytes);
  const valid = file.type === 'application/pdf' ? text.startsWith('%PDF-')
    : file.type === 'image/png' ? bytes.length >= 8 && bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71
    : file.type === 'image/jpeg' ? bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216
    : file.type === 'image/webp' ? text.startsWith('RIFF') && text.slice(8, 12) === 'WEBP'
    : false;
  if (!valid) throw new Error(`${label}: select a genuine PDF, PNG, JPG or WebP file. SVG and other formats are not supported.`);
}
