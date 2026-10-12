// Blueprint geometry contract + pure helpers (validation, inventory matching, orthographic projection).
// Coordinates are normalized to the SOURCE IMAGE bounds (0..100). They are not survey/cadastral values.

export type Facing = 'E' | 'N' | 'W' | 'S' | 'NE' | 'NW' | 'SE' | 'SW' | 'UNKNOWN';
export const FACINGS: Facing[] = ['E', 'N', 'W', 'S', 'NE', 'NW', 'SE', 'SW', 'UNKNOWN'];

export interface Pt { x: number; y: number }
export interface BlueprintPlot { number: string; facing: Facing; points: Pt[]; referenceOnly?: boolean; confidence?: number }
export interface BlueprintRoad { name: string; widthFeet: number | null; points: Pt[]; confidence?: number }
export interface Geometry {
  plots: BlueprintPlot[];
  roads: BlueprintRoad[];
  northDegrees: number | null;
  notes: string;
  /** Source PAGE width / height (not land dimensions). null = unknown/unverified. */
  aspectRatio?: number | null;
}

export type BlueprintStatus = 'EMPTY' | 'DRAFT' | 'CONFIRMED';
export interface BlueprintAttachment { id: string; fileName: string; contentType: string }
export interface BlueprintState {
  revision: number;
  status: BlueprintStatus;
  sourceAttachmentId: string | null;
  confirmedAttachmentId?: string | null;
  draft: Geometry | null;
  confirmed: Geometry | null;
  attachments: BlueprintAttachment[];
  canManage: boolean;
}

export const SUPPORTED_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const round2 = (v: number) => Math.round(v * 100) / 100;

export function cloneGeometry(g: Geometry): Geometry {
  return {
    plots: g.plots.map((p) => ({ ...p, points: p.points.map((q) => ({ ...q })) })),
    roads: g.roads.map((r) => ({ ...r, points: r.points.map((q) => ({ ...q })) })),
    northDegrees: g.northDegrees,
    notes: g.notes ?? '',
    aspectRatio: g.aspectRatio ?? null,
  };
}

export const emptyGeometry = (): Geometry => ({ plots: [], roads: [], northDegrees: null, notes: '', aspectRatio: null });

export function centroid(points: Pt[]): Pt {
  if (!points.length) return { x: 0, y: 0 };
  const s = points.reduce((a, p) => ({ x: a.x + p.x, y: a.y + p.y }), { x: 0, y: 0 });
  return { x: s.x / points.length, y: s.y / points.length };
}

export const normalizeLabel = (s: string) => String(s || '').trim().toUpperCase().replace(/^PLOT\s*/i, '').replace(/\s+/g, '');

/** Plot numbers in the geometry that do not match any saved inventory plot number. */
export function unmatchedPlotNumbers(g: Geometry, inventoryNumbers: string[]): Set<string> {
  const inv = new Set(inventoryNumbers.map(normalizeLabel));
  const out = new Set<string>();
  g.plots.forEach((p) => { if (!inv.has(normalizeLabel(p.number))) out.add(p.number); });
  return out;
}

/** Client-side mirror of the server rules; the server remains authoritative. */
export function validateGeometry(g: Geometry, inventoryNumbers: string[], forConfirm: boolean): string[] {
  const errors: string[] = [];
  const inRange = (p: Pt) => Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.x <= 100 && p.y >= 0 && p.y <= 100;
  const seen = new Set<string>();
  g.plots.forEach((p, i) => {
    const label = p.number.trim() || `#${i + 1}`;
    if (!p.number.trim()) errors.push(`Plot polygon ${i + 1} needs a plot number.`);
    if (p.points.length < 3) errors.push(`Plot ${label} needs at least 3 vertices.`);
    if (!p.points.every(inRange)) errors.push(`Plot ${label} has a vertex outside 0 to 100.`);
    const k = normalizeLabel(p.number);
    if (k && seen.has(k)) errors.push(`Plot number ${label} is used more than once.`);
    seen.add(k);
  });
  g.roads.forEach((r, i) => {
    const label = r.name.trim() || `#${i + 1}`;
    if (r.points.length < 2) errors.push(`Road ${label} needs at least 2 points.`);
    if (!r.points.every(inRange)) errors.push(`Road ${label} has a point outside 0 to 100.`);
    if (r.widthFeet !== null && !(r.widthFeet > 0)) errors.push(`Road ${label}: width must be positive or left unknown.`);
  });
  if (g.northDegrees !== null && !(g.northDegrees >= 0 && g.northDegrees < 360)) errors.push('North angle must be between 0 and 359 degrees, or unknown.');
  const ar = g.aspectRatio;
  if (ar !== null && ar !== undefined && !(Number.isFinite(ar) && ar > 0.05 && ar <= 20)) errors.push('Source page aspect ratio must be greater than 0.05 and at most 20, or unknown.');
  if (forConfirm) {
    if (!g.plots.length) errors.push('At least one plot polygon is required to confirm.');
    const unmatched = unmatchedPlotNumbers(g, inventoryNumbers);
    g.plots.forEach((p) => {
      if (unmatched.has(p.number) && !p.referenceOnly) errors.push(`Plot ${p.number || '(blank)'} is not in current inventory. Mark it reference-only or correct the number.`);
    });
  }
  return errors;
}

export const FACING_LABEL: Record<Facing, string> = {
  E: 'East', N: 'North', W: 'West', S: 'South', NE: 'North-East', NW: 'North-West', SE: 'South-East', SW: 'South-West', UNKNOWN: 'Unknown',
};

// ---------- Orthographic 3D projection ----------
export interface Camera { yaw: number; pitch: number; zoom: number; panX: number; panY: number }
export const DEFAULT_CAMERA: Camera = { yaw: -30, pitch: 55, zoom: 1, panX: 0, panY: 0 };

/** World: X = x-50 (right), Z = y-50 (down the source image), Y = up (uniform display thickness only). */
export function project(x: number, y: number, h: number, cam: Camera, base: number) {
  const X = x - 50, Z = y - 50, Y = h;
  const yaw = (cam.yaw * Math.PI) / 180, pitch = (cam.pitch * Math.PI) / 180;
  const x1 = X * Math.cos(yaw) - Z * Math.sin(yaw);
  const z1 = X * Math.sin(yaw) + Z * Math.cos(yaw);
  const sy = z1 * Math.sin(pitch) - Y * Math.cos(pitch);
  const depth = z1 * Math.cos(pitch) + Y * Math.sin(pitch);
  const s = base * cam.zoom;
  return { sx: x1 * s + cam.panX, sy: sy * s + cam.panY, depth };
}

/** Scale normalized y so plan proportions follow the source page aspect (width/height). Unknown = square viewing convention. */
export function proportionedGeometry(g: Geometry): Geometry {
  const ar = g.aspectRatio && g.aspectRatio > 0 ? g.aspectRatio : 1;
  const fy = (y: number) => 50 + (y - 50) / ar;
  return {
    ...g,
    plots: g.plots.map((p) => ({ ...p, points: p.points.map((q) => ({ x: q.x, y: fy(q.y) })) })),
    roads: g.roads.map((r) => ({ ...r, points: r.points.map((q) => ({ x: q.x, y: fy(q.y) })) })),
  };
}

/** Camera zoom/pan that fits every geometry point into a viewport of size w x h (centered at origin). */
export function fitCamera(g: Geometry, cam: Camera, base: number, w: number, h: number): Camera {
  const pts = [...g.plots.flatMap((p) => p.points), ...g.roads.flatMap((r) => r.points)];
  if (!pts.length) return { ...cam, zoom: 1, panX: 0, panY: 0 };
  const unit = { ...cam, zoom: 1, panX: 0, panY: 0 };
  const pr = pts.map((p) => project(p.x, p.y, 0, unit, base));
  const minX = Math.min(...pr.map((p) => p.sx)), maxX = Math.max(...pr.map((p) => p.sx));
  const minY = Math.min(...pr.map((p) => p.sy)), maxY = Math.max(...pr.map((p) => p.sy));
  const zoom = clamp(Math.min((w * 0.86) / Math.max(1, maxX - minX), (h * 0.8) / Math.max(1, maxY - minY)), 0.2, 8);
  return { ...cam, zoom, panX: -((minX + maxX) / 2) * zoom, panY: -((minY + maxY) / 2) * zoom };
}
