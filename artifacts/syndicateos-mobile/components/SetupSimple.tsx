import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Btn, Card, Chips, Field } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { CONFIRM_KEY, applyDefaults, isVisible, num0, type Row, type SetupConfig, type SetupDraft, type SetupField } from '@/lib/projectSetup';
import { formatIndianCompact } from '@/lib/sourceCalc';

type Meta = SetupField & { ui?: string; optionLabels?: Record<string, string> };
export const uiOf = (f: SetupField) => (f as Meta).ui;
export const optLabel = (f: SetupField, o: string) => (f as Meta).optionLabels?.[o] ?? o.replace(/_/g, ' ');
export const inr = (n: number) => `${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })} (${formatIndianCompact(n)})`;
export type Render = (f: SetupField, row: Row, error: string | undefined, onChange: (v: unknown) => void) => React.ReactNode;
type Edit = (fn: (d: SetupDraft) => SetupDraft) => void;
const TINTS = ['#FFB800', '#8fb0e0', '#a98bd6', '#e58a8a', '#5fbf9f', '#7d8bb5'];

function Disclosure({ label, open, onToggle }: { label: string; open: boolean; onToggle: () => void }) {
  const c = useColors();
  return <Pressable onPress={onToggle} accessibilityRole="button" style={{ paddingVertical: 6 }}><Text style={{ color: c.primary, fontFamily: 'Inter_600SemiBold', fontSize: 12 }}>{open ? '− ' : '+ '}{label}</Text></Pressable>;
}

/* ---------- facing matrix ---------- */
export function FacingMatrix({ cfg, draft, edit, errs, render, locked }: { cfg: SetupConfig; draft: SetupDraft; edit: Edit; errs: Record<string, string>; render: Render; locked?: boolean }) {
  const c = useColors();
  const inv = cfg.inventory!;
  const m = inv.mappings;
  const facingF = inv.fields.find((f) => f.kind === 'select' && f.key === 'facing') ?? inv.fields.find((f) => f.kind === 'select');
  const [adv, setAdv] = useState<string | null>(null);
  if (!facingF || !m.count || !m.area) return null;
  const cntF = inv.fields.find((f) => f.key === m.count);
  const areaF = inv.fields.find((f) => f.key === m.area);
  const advanced = inv.fields.filter((f) => ![facingF.key, m.count, m.area, inv.rateField].includes(f.key) || (f.key === inv.rateField && f.key !== m.count));
  const advFields = advanced.filter((f) => f.key !== facingF.key && f.key !== m.count && f.key !== m.area);
  const opts = facingF.options ?? [];
  const idxOf = (o: string) => draft.groups.findIndex((g) => g[facingF.key] === o);
  const setCell = (o: string, k: string, v: unknown) => edit((d) => {
    const i = d.groups.findIndex((g) => g[facingF.key] === o);
    if (i < 0) return { ...d, groups: [...d.groups, applyDefaults(inv.fields, { [facingF.key]: o, [k]: v })] };
    return { ...d, groups: d.groups.map((g, j) => (j === i ? { ...g, [k]: v } : g)) };
  });
  const orphan = draft.groups.map((g, i) => ({ g, i })).filter(({ g, i }) => !opts.includes(String(g[facingF.key] ?? '')) || idxOf(String(g[facingF.key])) !== i);
  let total = 0; let area = 0;
  const first = num0(inv.fields.find((f) => f.key === 'startNumber')?.default ?? 1) || 1;
  const starts: number[] = []; let run = first;
  draft.groups.forEach((g) => { starts.push(run); const n = Math.max(0, Math.floor(num0(g[m.count]))); run += n; });
  const cards = opts.map((o, n) => {
    const i = idxOf(o); const g = i >= 0 ? draft.groups[i] : {};
    const cnt = Math.max(0, num0(g[m.count])); const a = Math.max(0, num0(g[m.area]));
    total += cnt; area += cnt * a;
    const from = i >= 0 ? starts[i] : first;
    return { o, i, g, cnt, a, from, tint: TINTS[n % TINTS.length] };
  });
  orphan.forEach(({ g }) => { const cnt = Math.max(0, num0(g[m.count])); total += cnt; area += cnt * Math.max(0, num0(g[m.area])); });
  const inputStyle = { borderWidth: 1.5, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10, color: c.foreground, fontFamily: 'Inter_600SemiBold', backgroundColor: c.card } as const;
  return (
    <View pointerEvents={locked ? 'none' : 'auto'}>
      <View style={{ backgroundColor: c.warningSurface, borderRadius: 14, padding: 14, marginBottom: 12, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 }}>
        <View style={{ flex: 1, minWidth: 200 }}>
          <Text style={{ color: c.foreground, fontFamily: 'Inter_700Bold' }}>{inv.kind || 'Plot'} matrix by {facingF.label.toLowerCase()}</Text>
          <Text style={{ color: c.mutedForeground, fontSize: 12 }}>Enter count and area per {cfg.labels.inventoryUnit ?? 'unit'}. Numbers run sequentially across groups in the order entered.</Text>
        </View>
        <View><Text style={{ color: c.mutedForeground, fontSize: 11 }}>TOTAL</Text><Text style={{ color: c.foreground, fontFamily: 'Inter_700Bold', fontSize: 18 }}>{total.toLocaleString('en-IN')} · {area.toLocaleString('en-IN', { maximumFractionDigits: 6 })} {areaF?.unit ?? ''}</Text></View>
      </View>
      {total > 0 ? (
        <View style={{ marginBottom: 12, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.card }}>
          <Text style={{ color: c.foreground, fontFamily: 'Inter_700Bold', marginBottom: 6 }}>Live venture grid</Text>
          {draft.groups.map((g, i) => {
            const n = Math.max(0, Math.floor(num0(g[m.count])));
            if (!n) return null;
            const tint = TINTS[Math.max(0, opts.indexOf(String(g[facingF.key] ?? ''))) % TINTS.length];
            return (
              <View key={i} style={{ marginBottom: 8 }}>
                <Text style={{ color: c.mutedForeground, fontSize: 11 }}>{optLabel(facingF, String(g[facingF.key] ?? ''))} · {starts[i]}–{starts[i] + n - 1}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 3, marginTop: 3 }}>
                  {Array.from({ length: Math.min(n, 120) }, (_, k) => <View key={k} style={{ minWidth: 28, paddingVertical: 3, borderRadius: 6, backgroundColor: tint, alignItems: 'center' }}><Text style={{ fontSize: 10, color: '#14224a', fontFamily: 'Inter_600SemiBold' }}>{starts[i] + k}</Text></View>)}
                  {n > 120 ? <Text style={{ fontSize: 11, color: c.mutedForeground }}>+{n - 120} more</Text> : null}
                </View>
              </View>
            );
          })}
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {cards.map(({ o, i, g, cnt, a, from, tint }) => (
          <View key={o} style={{ flexGrow: 1, flexBasis: 150, minWidth: 150, maxWidth: 260, borderRadius: 16, borderWidth: 1.5, borderColor: tint, backgroundColor: c.card, padding: 12 }}>
            <Text style={{ color: c.foreground, fontFamily: 'Inter_700Bold', marginBottom: 8 }}>{optLabel(facingF, o)}</Text>
            <Text style={{ color: c.mutedForeground, fontSize: 10, fontFamily: 'Inter_600SemiBold' }}>{(cntF?.label ?? 'Count').toUpperCase()}</Text>
            <TextInput value={typeof g[m.count] === 'string' ? (g[m.count] as string) : ''} onChangeText={(v) => setCell(o, m.count, v)} keyboardType="numeric" placeholder="0" placeholderTextColor={c.mutedForeground} style={{ ...inputStyle, borderColor: tint, marginBottom: 8 }} />
            <Text style={{ color: c.mutedForeground, fontSize: 10, fontFamily: 'Inter_600SemiBold' }}>{(areaF?.label ?? 'Area').toUpperCase()}</Text>
            <TextInput value={typeof g[m.area] === 'string' ? (g[m.area] as string) : ''} onChangeText={(v) => setCell(o, m.area, v)} keyboardType="numeric" placeholder="0" placeholderTextColor={c.mutedForeground} style={{ ...inputStyle, borderColor: tint, marginBottom: 8 }} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: c.mutedForeground, fontSize: 11 }}>{cnt > 0 ? `Nos. ${from}–${from + cnt - 1}` : 'No numbers'}</Text>
              <Text style={{ color: c.foreground, fontSize: 11, fontFamily: 'Inter_700Bold' }}>{(cnt * a).toLocaleString('en-IN', { maximumFractionDigits: 6 })}</Text>
            </View>
            {i >= 0 && advFields.length ? <Disclosure label="Advanced" open={adv === o} onToggle={() => setAdv(adv === o ? null : o)} /> : null}
            {i >= 0 && adv === o ? advFields.map((f) => <View key={f.key}>{render(f, g, errs[`groups.${i}.${f.key}`], (v) => edit((d) => ({ ...d, groups: d.groups.map((x, j) => (j === i ? { ...x, [f.key]: v } : x)) })))}</View>) : null}
            {i >= 0 ? ['count', 'area'].map((k) => errs[`groups.${i}.${k === 'count' ? m.count : m.area}`] ? <Text key={k} style={{ color: c.destructive, fontSize: 11 }}>{errs[`groups.${i}.${k === 'count' ? m.count : m.area}`]}</Text> : null) : null}
          </View>
        ))}
      </View>
      {orphan.length ? (
        <View style={{ marginTop: 14 }}>
          <Text style={{ color: c.foreground, fontFamily: 'Inter_700Bold', marginBottom: 6 }}>Other entered groups (kept as saved)</Text>
          {orphan.map(({ g, i }) => (
            <Card key={i}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: c.foreground, fontFamily: 'Inter_600SemiBold' }}>Group {i + 1}</Text>
                <Btn label="Remove" variant="ghost" icon="trash-2" onPress={() => edit((d) => ({ ...d, groups: d.groups.filter((_, j) => j !== i) }))} />
              </View>
              {inv.fields.map((f) => <View key={f.key}>{render(f, g, errs[`groups.${i}.${f.key}`], (v) => edit((d) => ({ ...d, groups: d.groups.map((x, j) => (j === i ? { ...x, [f.key]: v } : x)) })))}</View>)}
            </Card>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/* ---------- partners ---------- */
export function PartnerCards({ cfg, draft, edit, errs, render, update, locked }: {
  cfg: SetupConfig; draft: SetupDraft; edit: Edit; errs: Record<string, string>; render: Render;
  update: (i: number, key: string, v: unknown) => void; locked?: boolean;
}) {
  const c = useColors();
  const [adv, setAdv] = useState<number | null>(null);
  const ca = cfg.rules.capitalAllocation as { budgetField?: string; capitalField?: string; equityField?: string; totalPercent?: number } | undefined;
  const eqKey = ca?.equityField ?? 'fixedEquityPercent';
  const capKey = ca?.capitalField ?? 'initialCapital';
  const budget = ca?.budgetField ? num0(draft.values[ca.budgetField]) : 0;
  const eq = draft.partners.reduce((n, p) => n + num0(p[eqKey]), 0);
  const cap = draft.partners.reduce((n, p) => n + num0(p[capKey]), 0);
  const totalPct = ca?.totalPercent ?? 100;
  const visible = cfg.partnerFields.filter((f) => uiOf(f) !== 'hidden');
  const basic = visible.filter((f) => uiOf(f) !== 'advanced');
  const advanced = visible.filter((f) => uiOf(f) === 'advanced');
  const stat = (l: string, v: string, bad: boolean) => <View style={{ flexGrow: 1, minWidth: 140 }}><Text style={{ color: c.mutedForeground, fontSize: 11 }}>{l}</Text><Text style={{ color: bad ? c.destructive : c.foreground, fontFamily: 'Inter_700Bold' }}>{v}</Text></View>;
  return (
    <View pointerEvents={locked ? 'none' : 'auto'}>
      {ca ? (
        <Card>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {stat('Equity remaining', `${Math.round((totalPct - eq) * 100) / 100}% of ${totalPct}%`, eq > totalPct + 0.001)}
            {budget > 0 ? stat('Planned capital remaining', inr(budget - cap), cap > budget + 0.001) : stat('Planned capital', inr(cap), false)}
            {budget > 0 ? stat('Project budget', inr(budget), false) : null}
          </View>
          {eq > totalPct + 0.001 ? <Text style={{ color: c.destructive, fontSize: 12, marginTop: 6 }}>Equity exceeds {totalPct}%. Reduce a partner's share.</Text> : null}
          {budget > 0 && cap > budget + 0.001 ? <Text style={{ color: c.destructive, fontSize: 12, marginTop: 6 }}>Planned capital exceeds the project budget. Reduce capital or raise the budget yourself.</Text> : null}
        </Card>
      ) : null}
      {draft.partners.map((p, i) => (
        <Card key={i}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <Text style={{ color: c.foreground, fontFamily: 'Inter_700Bold' }}>{String(p.name || `Partner ${i + 1}`)}</Text>
            <Btn label="Remove" variant="ghost" icon="trash-2" onPress={() => edit((d) => ({ ...d, partners: d.partners.filter((_, j) => j !== i) }))} />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 12 }}>
          {basic.map((f) => {
            const onChange = (v: unknown) => (f.key === capKey && (f as { readOnly?: boolean }).readOnly ? undefined : f.key === eqKey || f.key === capKey ? update(i, f.key, v) : edit((d) => ({ ...d, partners: d.partners.map((x, j) => (j === i ? { ...x, [f.key]: v } : x)) })));
            return <View key={f.key} style={{ flexBasis: 260, flexGrow: 1 }}>{render(f, p, errs[`partners.${i}.${f.key}`], onChange)}{f.key === capKey && num0(p[capKey]) > 0 ? <Text style={{ color: c.mutedForeground, fontSize: 11, marginTop: -6, marginBottom: 8 }}>{inr(num0(p[capKey]))}</Text> : null}</View>;
          })}
          </View>
          {advanced.length ? <Disclosure label="Advanced" open={adv === i} onToggle={() => setAdv(adv === i ? null : i)} /> : null}
          {adv === i ? advanced.map((f) => <View key={f.key}>{render(f, p, errs[`partners.${i}.${f.key}`], (v) => edit((d) => ({ ...d, partners: d.partners.map((x, j) => (j === i ? { ...x, [f.key]: v } : x)) })))}</View>) : null}
        </Card>
      ))}
    </View>
  );
}

/* ---------- bank accounts ---------- */
export function AccountCards({ cfg, draft, edit, errs, render, locked }: { cfg: SetupConfig; draft: SetupDraft; edit: Edit; errs: Record<string, string>; render: Render; locked?: boolean }) {
  const c = useColors();
  const confirm = cfg.rules.accountNumberConfirmation !== false && cfg.accountFields.some((f) => f.key === 'accountNumber');
  const shown = cfg.accountFields.filter((f) => uiOf(f) !== 'hidden' && uiOf(f) !== 'advanced');
  const set = (i: number, k: string, v: unknown) => edit((d) => ({ ...d, accounts: d.accounts.map((x, j) => (j === i ? { ...x, [k]: v, ...(k === 'accountNumber' && !confirm ? { [CONFIRM_KEY]: v } : {}) } : x)) }));
  return (
    <View pointerEvents={locked ? 'none' : 'auto'}>
      {draft.accounts.map((a, i) => (
        <Card key={i}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <Text style={{ color: c.foreground, fontFamily: 'Inter_700Bold' }}>{String(a.bankName || `Account ${i + 1}`)}</Text>
            <Btn label="Remove" variant="ghost" icon="trash-2" onPress={() => edit((d) => ({ ...d, accounts: d.accounts.filter((_, j) => j !== i) }))} />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 12 }}>{shown.filter((f) => isVisible(f, a)).map((f) => <View key={f.key} style={{ flexBasis: 260, flexGrow: 1 }}>{render(f, a, errs[`accounts.${i}.${f.key}`], (v) => set(i, f.key, v))}</View>)}</View>
          {confirm ? <Field label="Confirm account number *" value={String(a[CONFIRM_KEY] ?? '')} onChangeText={(v) => set(i, CONFIRM_KEY, v)} error={errs[`accounts.${i}.${CONFIRM_KEY}`]} /> : null}
        </Card>
      ))}
    </View>
  );
}

export { Chips };
