import React from 'react';
import { Text, View } from 'react-native';
import type { ErpRecord, ProjectErp } from '@workspace/api-client-react';
import { Banner, Btn, Card, Chips, Field, Label } from '@/components/ui';
import { useColors } from '@/hooks/useColors';

/** Web projectFormEditing.ts groups: directional plot matrix for READY open-plotting projects. */
export const MATRIX_GROUPS: { key: string; label: string; facings: string[] }[] = [
  { key: 'east', label: 'East facing', facings: ['East'] },
  { key: 'north', label: 'North facing', facings: ['North'] },
  { key: 'west', label: 'West facing', facings: ['West'] },
  { key: 'south', label: 'South facing', facings: ['South'] },
  { key: 'corner', label: 'Corner (NE / SE)', facings: ['North-East Corner', 'South-East Corner'] },
  { key: 'commercial', label: 'Commercial', facings: ['Commercial'] },
];

export type MatrixRow = { count: string; area: string; mixed: boolean };
export type Matrix = Record<string, MatrixRow>;
export type AcctDraft = { recordId?: string; revision?: number; data: Record<string, string>; dirty: boolean; locked?: boolean };

const plotsOf = (erp: ProjectErp) => erp.records.filter((r) => r.kind === 'plots' && r.status !== 'deleted');

export function seedMatrix(erp: ProjectErp): Matrix {
  const out: Matrix = {};
  const recs = plotsOf(erp);
  for (const g of MATRIX_GROUPS) {
    const m = recs.filter((r) => g.facings.includes(String(r.data.facing ?? '')));
    const areas = Array.from(new Set(m.map((r) => Number(r.data.areaSqYards))));
    out[g.key] = { count: String(m.length), area: areas.length === 1 ? String(areas[0]) : '', mixed: areas.length > 1 };
  }
  return out;
}

export function seedAccounts(erp: ProjectErp): AcctDraft[] {
  return erp.records.filter((r) => r.kind === 'accounts' && r.status !== 'deleted').map((r: ErpRecord) => ({
    recordId: r.id, revision: r.revision, dirty: false, locked: !!r.data.isDefaultCash,
    data: Object.fromEntries(Object.entries(r.data).map(([k, v]) => [k, v === null || v === undefined ? '' : String(v)])),
  }));
}

/** Payload pieces for project.setup-save (READY edit), mirroring web projectFormPayload. */
export function livePayload(erp: ProjectErp, matrix: Matrix | null, accts: AcctDraft[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const res = erp.resources.find((r) => r.kind === 'accounts');
  const edits = accts.filter((a) => a.dirty && !a.locked);
  if (edits.length) {
    if (!res) throw new Error('Project account configuration is unavailable.');
    out.accountEdits = edits.map((a) => {
      const saved = a.recordId ? erp.records.find((r) => r.id === a.recordId) : undefined;
      const data: Record<string, unknown> = {};
      for (const f of res.fields) {
        const raw = f.key === 'openingBalance' && saved ? saved.data.openingBalance : a.data[f.key];
        if (raw === undefined || raw === '') continue;
        data[f.key] = f.kind === 'number' ? Number(raw) : f.kind === 'boolean' ? raw === 'true' || raw === true : raw;
      }
      return saved ? { recordId: saved.id, revision: a.revision, data } : { data };
    });
  }
  if (matrix) {
    out.plotMatrix = {
      groups: MATRIX_GROUPS.map((g) => ({ key: g.key, count: Number(matrix[g.key]?.count || 0), areaSqYards: !matrix[g.key]?.area || Number(matrix[g.key].area) === 0 ? null : Number(matrix[g.key].area) })),
      records: plotsOf(erp).map((r) => ({ recordId: r.id, revision: r.revision })),
    };
  }
  return out;
}

export function LiveMatrixEditor({ matrix, onChange }: { matrix: Matrix; onChange: (m: Matrix) => void }) {
  const c = useColors();
  const total = MATRIX_GROUPS.reduce((n, g) => n + (Number(matrix[g.key]?.count) || 0), 0);
  const area = MATRIX_GROUPS.reduce((n, g) => n + (Number(matrix[g.key]?.count) || 0) * (Number(matrix[g.key]?.area) || 0), 0);
  const set = (k: string, f: 'count' | 'area', v: string) => onChange({ ...matrix, [k]: { ...matrix[k], [f]: v } });
  return (
    <Card>
      <Text style={{ color: c.foreground, fontFamily: 'Inter_700Bold', fontSize: 16 }}>Directional plot matrix</Text>
      <Text style={{ color: c.mutedForeground, fontSize: 12, marginBottom: 10 }}>Changes apply to saved available plots on the server. Booked, sold and blocked plots are never removed.</Text>
      {MATRIX_GROUPS.map((g) => (
        <View key={g.key} style={{ borderTopWidth: 1, borderColor: c.border, paddingTop: 8 }}>
          <Label>{g.label.toUpperCase()}</Label>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}><Field label="Plots" value={matrix[g.key]?.count ?? ''} onChangeText={(v) => set(g.key, 'count', v)} keyboardType="numeric" /></View>
            <View style={{ flex: 1 }}><Field label="Area each (Sq.Yds)" value={matrix[g.key]?.area ?? ''} onChangeText={(v) => set(g.key, 'area', v)} keyboardType="numeric" hint={matrix[g.key]?.mixed ? 'Mixed sizes saved; leave blank to keep them' : undefined} /></View>
          </View>
        </View>
      ))}
      <Text style={{ color: c.foreground, fontFamily: 'Inter_600SemiBold', marginTop: 6 }}>{total} plots · {Math.round(area).toLocaleString('en-IN')} Sq.Yds (uniform groups)</Text>
    </Card>
  );
}

export function LiveAccountsEditor({ erp, accts, onChange }: { erp: ProjectErp; accts: AcctDraft[]; onChange: (a: AcctDraft[]) => void }) {
  const c = useColors();
  const res = erp.resources.find((r) => r.kind === 'accounts');
  if (!res) return <Banner tone="warn" title="Project account configuration is unavailable." />;
  const set = (i: number, k: string, v: string) => onChange(accts.map((a, j) => (j === i ? { ...a, dirty: true, data: { ...a.data, [k]: v } } : a)));
  return (
    <Card>
      <Text style={{ color: c.foreground, fontFamily: 'Inter_700Bold', fontSize: 16, marginBottom: 6 }}>Project bank accounts</Text>
      {accts.map((a, i) => {
        const editable = !a.locked && (a.recordId ? res.canManage : res.canCreate);
        return (
          <View key={a.recordId ?? `new-${i}`} style={{ borderTopWidth: 1, borderColor: c.border, paddingTop: 8, marginBottom: 6 }}>
            <Text style={{ color: c.foreground, fontFamily: 'Inter_600SemiBold', marginBottom: 6 }}>{a.data.accountName || (a.recordId ? 'Account' : 'New account')}{a.locked ? ' · default cash (fixed)' : ''}</Text>
            {res.fields.filter((f) => (f as { ui?: string }).ui !== 'hidden').map((f) => {
              const lab = f.label + (f.required ? ' *' : '');
              if (f.kind === 'select' && f.options?.length) return <Chips key={f.key} label={lab} options={f.options.map((o) => ({ value: o, label: o.replace(/_/g, ' ') }))} value={a.data[f.key] ?? ''} onChange={(v) => editable && set(i, f.key, v)} />;
              const immutable = f.key === 'openingBalance' && !!a.recordId;
              return <Field key={f.key} label={lab} value={a.data[f.key] ?? ''} onChangeText={(v) => set(i, f.key, v)} editable={editable && !immutable} keyboardType={f.kind === 'number' ? 'numeric' : 'default'} hint={immutable ? 'Opening balance is fixed once recorded.' : f.kind === 'date' ? 'YYYY-MM-DD' : undefined} />;
            })}
          </View>
        );
      })}
      {res.canCreate ? <Btn label="Add bank account" icon="plus" variant="ghost" onPress={() => onChange([...accts, { data: { status: 'active', openingBalance: '0' }, dirty: true }])} /> : null}
    </Card>
  );
}
