import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { getGetProjectErpQueryKey, type ErpResource, type ProjectErp } from '@workspace/api-client-react';
import { Banner, Btn, Card, CredentialSheet, Field } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { newRequestId } from '@/lib/erp';
import { errMessage } from '@/lib/session';
import { formatINR, formatIndianCompact } from '@/lib/sourceCalc';
import { useRun } from '@/lib/workspace';
import { Dialog, DialogFooter, live, str, type ErpCtx } from '@/screens/ErpScreens';

/**
 * Native port of web SyndicateEquityModule + App.tsx partner handlers:
 * partner.add, partner.update, partner.status, credentials.reset and erp.settings { equitySplitMode }.
 * Temporary PINs are held only in component state and shown once in CredentialSheet; never logged.
 */
type Access = { mobile: string; reused: boolean; temporaryCredential?: string; expiresAt?: string };
const nv = (x: unknown) => { const n = Number(x); return Number.isFinite(n) ? n : 0; };
const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object';
function accessOf(res: unknown): Access[] {
  const pools = [isObj(res) ? res.access : undefined, isObj(res) && isObj(res.entity) ? res.entity.access : undefined];
  const out: Access[] = [];
  for (const p of pools) for (const a of Array.isArray(p) ? p : p ? [p] : []) {
    if (isObj(a) && typeof a.mobile === 'string') out.push({ mobile: a.mobile, reused: a.reused === true, temporaryCredential: typeof a.temporaryCredential === 'string' ? a.temporaryCredential : undefined, expiresAt: typeof a.expiresAt === 'string' ? a.expiresAt : undefined });
  }
  return out;
}
/** Web pickConfigured: keep only configured profile fields; reject non-empty values with no field. */
function pickProfile(res: ErpResource, data: Record<string, unknown>): Record<string, unknown> {
  const keys = new Set(res.fields.map((f) => f.key));
  const out: Record<string, unknown> = {}; const rejected: string[] = [];
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined || v === null || v === '') continue;
    if (keys.has(k)) out[k] = v; else if (v !== 0) rejected.push(k);
  }
  if (rejected.length) throw new Error(`Not saved: the configured "${res.title || 'Partner profile'}" form has no field for ${rejected.join(', ')}. Clear these values or have the owner add them to the sector release.`);
  return out;
}

export function PartnerEquityNative({ erp, ctx }: { erp: ProjectErp; ctx: ErpCtx }) {
  const c = useColors();
  const run = useRun();
  const qc = useQueryClient();
  const projectId = erp.projectId;
  const isAcct = ctx.account.role === 'ACCOUNTANT';
  const pres = erp.resources.find((r) => r.kind === 'partner-profiles');
  const splitMode = str(erp.settings.equitySplitMode) === 'fixed' ? 'fixed' : str(erp.settings.equitySplitMode) || 'fixed';
  const [splitStatus, setSplitStatus] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; t: string } | null>(null);
  const [access, setAccess] = useState<Access[]>([]);
  const [resetFor, setResetFor] = useState<string | null>(null);
  const [adjust, setAdjust] = useState<null | { id: string; name: string; role: string; capital: string; equity: string }>(null);
  const [adding, setAdding] = useState<null | { name: string; phone: string; role: string; equity: string; capital: string; err: string }>(null);

  const profileOf = (pid: string) => erp.records.find((r) => r.kind === 'partner-profiles' && live(r) && String(r.data.partnerId) === pid);
  const partners = erp.partners.map((m) => {
    const raw = m as typeof m & { enabled?: boolean; revision?: number };
    const pr = profileOf(m.id);
    const d = pr?.data ?? {};
    return {
      id: m.id, name: m.name, phone: m.mobile, role: str(d.roleDescription) || 'Partner',
      initial: nv(d.initialCapital), invested: nv(m.invested), fixed: nv(d.fixedEquityPercent ?? m.equityPercent),
      drawings: nv(m.drawings), expenses: nv(m.expenses), active: raw.enabled !== false,
      revision: raw.revision, profileRevision: pr?.revision, profile: d,
    };
  });
  type P = (typeof partners)[number];
  const totalCapital = partners.reduce((n, p) => n + p.initial, 0);
  const totalInvested = partners.reduce((n, p) => n + p.invested, 0);
  const totalVariance = totalInvested - totalCapital;
  const equityOf = (p: P) => (splitMode === 'fixed' ? p.fixed : totalCapital > 0 ? (p.initial / totalCapital) * 100 : 0);
  const net = (p: P) => p.invested + p.expenses - p.drawings;

  // Same derivations as the web module.
  const det = (ctx.project?.details ?? {}) as Record<string, unknown>;
  const lc = (erp.settings.layoutCalculation ?? {}) as Record<string, unknown>;
  const plots = erp.records.filter((r) => r.kind === 'plots' && live(r));
  const benchmark = nv(det.floorRatePerSqYard) || nv(lc.floorRatePerSqYard);
  const plotArea = plots.reduce((n, r) => n + nv(r.data.areaSqYards), 0);
  const sellable = (() => {
    if (plotArea > 0) return plotArea;
    const extent = nv(det.extentValue) || nv(lc.totalExtentValue);
    if (extent <= 0) return 0;
    const unit = str(det.extentUnit) || str(lc.unit) || 'Acres';
    const sq = unit === 'Acres' ? extent * 4840 : unit === 'Guntas / Cents' ? extent * 121 : extent;
    return Math.round(sq * (1 - (nv(lc.roadDeductionPercent) + nv(lc.openSpacePercent)) / 100));
  })();
  const estValue = (() => {
    const sum = plots.reduce((n, r) => n + nv(r.data.areaSqYards) * (nv(r.data.ratePerSqYard) || benchmark), 0);
    return sum > 0 ? sum : sellable * benchmark;
  })();
  const hasBudget = det.totalEstimatedOutlay !== undefined && det.totalEstimatedOutlay !== null && det.totalEstimatedOutlay !== '';
  const projectSurplus = hasBudget ? estValue - nv(det.totalEstimatedOutlay) : 0;
  // The web passes its positive budget-based surplus into this module before
  // falling back to estimated sales less capital actually invested.
  const expectedProfit = Math.max(0, projectSurplus > 0 ? projectSurplus : estValue - totalInvested);
  const profitPerYd = sellable > 0 ? Math.round(expectedProfit / sellable) : 0;

  const refresh = () => qc.invalidateQueries({ queryKey: getGetProjectErpQueryKey(projectId) });
  const act = async (key: string, okText: string, fn: () => Promise<unknown>) => {
    if (busy) return false;
    setBusy(key); setNotice(null);
    try {
      const res = await fn();
      const a = accessOf(res);
      if (a.length) setAccess(a);
      setNotice({ ok: true, t: okText });
      await refresh();
      return true;
    } catch (e) { setNotice({ ok: false, t: errMessage(e) }); return false; } finally { setBusy(null); }
  };

  const changeSplit = async (mode: 'fixed' | 'proportional') => {
    if (busy || mode === splitMode) return;
    const revision = (erp.settings as Record<string, unknown>).revision;
    if (!Number.isInteger(revision) || Number(revision) < 0) { setSplitStatus('Project settings are still loading. Retry when the project finishes loading.'); return; }
    setSplitStatus('Saving equity basis…');
    const ok = await act('split', 'Equity split mode saved', () => run('erp.settings', { projectId, revision, settings: { equitySplitMode: mode } }));
    setSplitStatus(ok ? 'Equity basis saved.' : 'Could not save the equity basis. It was not changed.');
  };
  const toggleStatus = (p: P) => act(`status:${p.id}`, `Partner ${p.name} ${p.active ? 'deactivated' : 'activated'}`, () =>
    run('partner.status', { projectId, partnerId: p.id, revision: p.revision, enabled: !p.active, requestId: newRequestId(), profileRevision: p.profileRevision }));
  const resetPin = (p: P) => act(`reset:${p.id}`, `Credential for ${p.name} reset`, () => run('credentials.reset', { identityId: p.id, projectId })).then((ok) => { if (ok) setResetFor(null); });
  const saveAdjust = () => {
    if (!adjust) return;
    const p = partners.find((x) => x.id === adjust.id); if (!p) return;
    void act(`adjust:${p.id}`, `Partner ${adjust.name} updated`, async () => {
      if (!pres) throw new Error('This project has no configured partner profile form.');
      const profile = pickProfile(pres, {
        roleDescription: adjust.role, initialCapital: nv(adjust.capital), fixedEquityPercent: nv(adjust.equity),
        dailySpendingLimit: p.profile.dailySpendingLimit, officialDeclaredCapital: p.profile.officialDeclaredCapital,
      });
      return run('partner.update', { projectId, partnerId: p.id, revision: p.revision, name: adjust.name.trim(), profile, requestId: newRequestId(), profileRevision: p.profileRevision });
    }).then((ok) => { if (ok) setAdjust(null); });
  };
  const saveAdd = () => {
    if (!adding) return;
    if (!adding.name.trim()) return setAdding({ ...adding, err: 'Please provide a partner name.' });
    const digits = adding.phone.replace(/\D/g, '').slice(-10);
    if (digits.length < 10) return setAdding({ ...adding, err: 'Please provide a valid 10-digit mobile number. The mobile number serves as the partner User ID.' });
    void act('add', `Partner ${adding.name.trim()} added`, async () => {
      const profile = pres ? pickProfile(pres, { roleDescription: adding.role.trim() || 'Syndicate Partner', initialCapital: nv(adding.capital), fixedEquityPercent: nv(adding.equity) }) : undefined;
      return run('partner.add', { requestId: newRequestId(), projectId, name: adding.name.trim(), mobile: `+91${digits}`, ...(profile && Object.keys(profile).length ? { profile } : {}) });
    }).then((ok) => { if (ok) setAdding(null); });
  };
  const openAdd = () => setAdding({ name: '', phone: '+91 ', role: 'Investor Partner', equity: '10', capital: '0', err: '' });
  const resetP = partners.find((p) => p.id === resetFor) ?? null;

  const Kpi = ({ t, v, sub, extra }: { t: string; v: string; sub: string; extra?: React.ReactNode }) => (
    <View style={{ flexGrow: 1, flexBasis: '46%', minWidth: 140, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 10 }}>
      <Text style={{ color: '#6b7280', fontSize: 10, fontFamily: 'Inter_700Bold', textTransform: 'uppercase', letterSpacing: 0.8 }}>{t}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: '#030712', fontSize: 16, fontFamily: 'Inter_700Bold', marginTop: 2 }}>{v}</Text>
      <Text numberOfLines={2} style={{ color: '#6b7280', fontSize: 10 }}>{sub}</Text>
      {extra}
    </View>
  );

  return (
    <View>
      <Card>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 }}>
          <View style={{ flex: 1, minWidth: 220 }}>
            <Text style={{ color: '#030712', fontFamily: 'Inter_700Bold', fontSize: 18 }}>Partner Capital & Equity</Text>
            <Text style={{ color: '#6b7280', fontSize: 13, marginTop: 4 }}>Review each partner's capital commitment, investment, equity, land allocation, expected profit and drawings.</Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 8 }}>
            {isAcct ? <Btn label="+ Add Partner to Project" icon="user-plus" onPress={openAdd} /> : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f3f4f6', borderRadius: 999, padding: 3 }}>
              <Text style={{ color: '#4b5563', fontSize: 11, fontFamily: 'Inter_700Bold', paddingHorizontal: 6 }}>Equity basis:</Text>
              {([['fixed', 'Fixed Share %'], ['proportional', 'Capital-Weighted']] as const).map(([k, l]) => (
                <Pressable key={k} disabled={!isAcct || busy === 'split'} onPress={() => void changeSplit(k)} accessibilityRole="button" accessibilityState={{ selected: splitMode === k, disabled: !isAcct }}
                  style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, backgroundColor: splitMode === k ? '#111827' : 'transparent', opacity: busy === 'split' ? 0.6 : 1 }}>
                  <Text style={{ color: splitMode === k ? '#ffffff' : '#4b5563', fontFamily: 'Inter_700Bold', fontSize: 12 }}>{l}</Text>
                </Pressable>
              ))}
            </View>
            {splitStatus ? <Text accessibilityLiveRegion="polite" style={{ color: '#6b7280', fontSize: 11 }}>{splitStatus}</Text> : null}
          </View>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 }}>
          <Kpi t="Estimated Sales Value" v={formatIndianCompact(estValue)} sub={`${formatINR(estValue)} · realizable sales at benchmark rate`} />
          <Kpi t="Actual Investment" v={formatIndianCompact(totalInvested)} sub={`${formatINR(totalInvested)} · capital invested to date · ${partners.length} partners`}
            extra={totalVariance !== 0 ? <Text style={{ color: totalVariance > 0 ? '#047857' : '#be123c', fontSize: 11, fontFamily: 'Inter_700Bold' }}>{totalVariance > 0 ? `+${formatIndianCompact(totalVariance)}` : formatIndianCompact(totalVariance)} variance</Text> : null} />
          <Kpi t="Net Sellable Area" v={`${sellable.toLocaleString('en-IN')} Sq.Yds`} sub={`${(sellable / 4840).toFixed(2)} Acres net area · based on ${plots.length ? `${plots.length} layout plot entries` : 'project layout master plan'}`} />
          <Kpi t="Expected Profit" v={formatIndianCompact(expectedProfit)} sub={`${formatINR(expectedProfit)} · ${formatINR(profitPerYd)} per Sq.Yd`} />
        </View>
        {splitMode === 'fixed' && partners.length && Math.abs(partners.reduce((n, p) => n + p.fixed, 0) - 100) > 0.01 ? <Banner tone="warn" title={`Fixed shares total ${partners.reduce((n, p) => n + p.fixed, 0).toFixed(2)}%, not 100%`} /> : null}
        {notice ? <Banner tone={notice.ok ? 'ok' : 'error'} title={notice.t} /> : null}
      </Card>

      {partners.length === 0 ? (
        <Card>
          <Text style={{ color: '#030712', fontFamily: 'Inter_700Bold', textAlign: 'center' }}>No Partners Assigned to this Project</Text>
          <Text style={{ color: '#6b7280', fontSize: 12, textAlign: 'center', marginVertical: 6 }}>Syndicate partners and dynamic equity stakes are project-specific. Add your first partner to {ctx.project?.name ?? 'this project'}.</Text>
          {isAcct ? <Btn label="+ Add Partner to this Project" icon="plus" onPress={openAdd} /> : null}
        </Card>
      ) : partners.map((p) => {
        const eq = equityOf(p); const nb = net(p); const diff = p.invested - p.initial;
        return (
          <Card key={p.id}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#FFB800', alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontFamily: 'Inter_700Bold', color: '#111827' }}>{p.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#030712', fontFamily: 'Inter_700Bold' }}>{p.name}{!p.active ? '  · Inactive' : ''}</Text>
                <Text style={{ color: '#6b7280', fontSize: 12 }}>{p.role} · User ID: {p.phone || 'No Mobile Registered'}</Text>
              </View>
              <Text style={{ color: '#b45309', fontFamily: 'Inter_700Bold', fontSize: 18 }}>{eq.toFixed(2)}%</Text>
            </View>
            <View style={{ marginTop: 10 }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {[
                  ['Capital Commitment', formatINR(p.initial)],
                  ['Actual Investment', formatINR(p.invested)],
                  ['Variance (+ / −)', `${diff > 0 ? '+' : ''}${formatIndianCompact(diff)}`],
                  ['Expected Land Allocation', `${Math.round((eq / 100) * sellable).toLocaleString('en-IN')} Sq.Yds`],
                  ['Expected Profit Share', formatINR(Math.round((eq / 100) * expectedProfit))],
                  ['Drawings', formatINR(p.drawings)],
                ].map(([k, v]) => <View key={k} style={{ flexBasis: '48%', flexGrow: 1, backgroundColor: '#f9fafb', borderRadius: 10, paddingVertical: 7, paddingHorizontal: 9 }}><Text numberOfLines={1} style={{ color: '#6b7280', fontSize: 9, fontFamily: 'Inter_700Bold', textTransform: 'uppercase' }}>{k}</Text><Text numberOfLines={1} adjustsFontSizeToFit style={{ color: '#111827', fontFamily: 'Inter_600SemiBold', fontSize: 13, marginTop: 2 }}>{v}</Text></View>)}
              </View>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, borderTopWidth: 1, borderColor: '#f3f4f6', paddingTop: 8 }}>
              <Text style={{ color: '#6b7280', fontSize: 12 }}>Net Balance</Text>
              <Text style={{ color: nb >= 0 ? '#047857' : '#be123c', fontFamily: 'Inter_700Bold' }}>{formatINR(nb)} · {nb >= 0 ? 'Receivable' : 'Due to Syndicate'}</Text>
            </View>
            {isAcct ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                <Pressable onPress={() => void toggleStatus(p)} disabled={!!busy} accessibilityRole="button" accessibilityLabel={p.active ? `${p.name} is active. Deactivate` : `${p.name} is inactive. Activate`}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: p.active ? '#6ee7b7' : '#fda4af', backgroundColor: p.active ? '#ecfdf5' : '#fff1f2', opacity: busy === `status:${p.id}` ? 0.6 : 1 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: p.active ? '#10b981' : '#f43f5e' }} />
                  <Text style={{ color: p.active ? '#065f46' : '#be123c', fontFamily: 'Inter_700Bold', fontSize: 12 }}>{p.active ? 'Active' : 'Inactive'}</Text>
                </Pressable>
                <Btn label="Reset PIN" icon="key" variant="ghost" disabled={!!busy} onPress={() => setResetFor(p.id)} />
                <Btn label="Adjust" icon="sliders" variant="ghost" disabled={!!busy} onPress={() => setAdjust({ id: p.id, name: p.name, role: p.role, capital: String(p.initial), equity: String(p.fixed) })} />
              </View>
            ) : null}
          </Card>
        );
      })}

      {resetP ? (
        <Dialog title="Reset Partner PIN" onClose={() => setResetFor(null)}>
          <Text style={{ color: c.foreground, fontFamily: 'Inter_700Bold' }}>{resetP.name}</Text>
          <Text style={{ color: c.mutedForeground, marginBottom: 10 }}>Partner User ID (Mobile): {resetP.phone}</Text>
          <Text style={{ color: c.foreground, fontSize: 13, lineHeight: 19 }}>The server issues a one-time temporary 6-digit PIN, shown once after this reset.{'\n'}On their next login, the partner will be automatically prompted to set a new PIN before entering the portal.</Text>
          <DialogFooter><Btn label="Confirm Reset" loading={busy === `reset:${resetP.id}`} onPress={() => void resetPin(resetP)} /></DialogFooter>
        </Dialog>
      ) : null}

      {adjust ? (() => { const p = partners.find((x) => x.id === adjust.id); return (
        <Dialog title={`Adjust Ledger: ${adjust.name}`} onClose={() => setAdjust(null)}>
          <Field label="Partner name" value={adjust.name} onChangeText={(v) => setAdjust({ ...adjust, name: v })} />
          <Field label="Project Role / Designation" value={adjust.role} onChangeText={(v) => setAdjust({ ...adjust, role: v })} />
          <Field label="Committed base capital (₹)" value={adjust.capital} onChangeText={(v) => setAdjust({ ...adjust, capital: v })} keyboardType="numeric" hint={`Committed base capital: ${formatINR(nv(adjust.capital))} (${formatIndianCompact(nv(adjust.capital))})`} />
          {p ? <Text style={{ color: c.mutedForeground, fontSize: 12, marginBottom: 10 }}>Actual invested {formatINR(p.invested)} · difference {formatIndianCompact(p.invested - nv(adjust.capital))} · net balance {formatINR(p.invested + p.expenses - p.drawings)}</Text> : null}
          <Field label="Agreed Fixed Share %" value={adjust.equity} onChangeText={(v) => setAdjust({ ...adjust, equity: v })} keyboardType="numeric" />
          <Text style={{ color: c.foreground, fontSize: 13, marginBottom: 6 }}>Cumulative Partner Drawings: {formatINR(p ? p.drawings : 0)} (from posted drawing entries in the Project Statement)</Text>
          <DialogFooter><Btn label="Save" loading={busy === `adjust:${adjust.id}`} onPress={saveAdjust} /></DialogFooter>
        </Dialog>
      ); })() : null}

      {adding ? (
        <Dialog title="Add Partner to Project" onClose={() => setAdding(null)}>
          {adding.err ? <Banner tone="error" title={adding.err} /> : null}
          <Field label="Partner Full Name *" value={adding.name} onChangeText={(v) => setAdding({ ...adding, name: v, err: '' })} />
          <Field label="Mobile Number (User ID) *" value={adding.phone} onChangeText={(v) => setAdding({ ...adding, phone: v, err: '' })} keyboardType="phone-pad" hint="The server issues a one-time temporary 6-digit PIN after the partner is added." />
          <Field label="Project Role / Designation" value={adding.role} onChangeText={(v) => setAdding({ ...adding, role: v })} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}><Field label="Equity Share (%)" value={adding.equity} onChangeText={(v) => setAdding({ ...adding, equity: v })} keyboardType="numeric" /></View>
            <View style={{ flex: 1 }}><Field label="Capital Invested (₹)" value={adding.capital} onChangeText={(v) => setAdding({ ...adding, capital: v })} keyboardType="numeric" /></View>
          </View>
          <DialogFooter><Btn label="Add Partner" loading={busy === 'add'} onPress={saveAdd} /></DialogFooter>
        </Dialog>
      ) : null}

      <CredentialSheet access={access[0] ?? null} onDone={() => setAccess((a) => a.slice(1))} />
    </View>
  );
}
