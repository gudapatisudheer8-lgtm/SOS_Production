import React, { useState } from 'react';
import { Text, View } from 'react-native';
import type { Firm, Workspace } from '@workspace/api-client-react';
import { Badge, Banner, Btn, Card, Chips, Confirm, CredentialSheet, Empty, Field, H1, Label } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { errMessage } from '@/lib/session';
import { useRun } from '@/lib/workspace';

type Access = { mobile: string; reused: boolean; temporaryCredential?: string; expiresAt?: string };

const published = (ws: Workspace, sectorId: string) =>
  ws.sectors.find((s) => s.id === sectorId)?.releases.filter((r) => r.state === 'PUBLISHED') ?? [];

function CreateFirm({ ws, onAccess }: { ws: Workspace; onAccess: (a: Access) => void }) {
  const run = useRun();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: '', clientCode: '', accountantName: '', accountantMobile: '' });
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const eligible = ws.sectors.filter((s) => published(ws, s.id).length > 0);

  const submit = async () => {
    if (!f.name.trim() || !f.clientCode.trim() || !f.accountantName.trim() || !f.accountantMobile.trim())
      return setErr('All firm and accountant fields are required.');
    setBusy(true);
    setErr(null);
    try {
      const res = await run('firm.create', {
        name: f.name.trim(),
        clientCode: f.clientCode.trim(),
        accountantName: f.accountantName.trim(),
        accountantMobile: f.accountantMobile.trim(),
        assignments: Object.entries(picks).map(([sectorId, releaseId]) => ({ sectorId, releaseId })),
      });
      setF({ name: '', clientCode: '', accountantName: '', accountantMobile: '' });
      setPicks({});
      setOpen(false);
      if (res.access) onAccess(res.access);
    } catch (e) {
      setErr(errMessage(e));
    } finally {
      setBusy(false);
    }
  };
  if (!open) return <Btn label="New firm" icon="plus" onPress={() => setOpen(true)} testID="button-new-firm" />;
  return (
    <Card>
      <Text style={{ fontSize: 17, fontFamily: 'Inter_700Bold', marginBottom: 12 }}>Create firm</Text>
      <Field label="Firm name" value={f.name} onChangeText={(v) => setF({ ...f, name: v })} />
      <Field label="Client code" value={f.clientCode} onChangeText={(v) => setF({ ...f, clientCode: v })} hint="Accountants enter this at login." />
      <Field label="Accountant name" value={f.accountantName} onChangeText={(v) => setF({ ...f, accountantName: v })} />
      <Field label="Accountant mobile" value={f.accountantMobile} onChangeText={(v) => setF({ ...f, accountantMobile: v })} keyboardType="phone-pad" />
      <Label>SECTORS (PUBLISHED RELEASES ONLY)</Label>
      {eligible.length === 0 ? (
        <Text style={{ opacity: 0.6, marginBottom: 12 }}>No sector has a published release yet. You can assign sectors later.</Text>
      ) : (
        eligible.map((s) => {
          const rels = published(ws, s.id);
          const on = picks[s.id] !== undefined;
          return (
            <View key={s.id} style={{ marginBottom: 8 }}>
              <Chips
                options={[{ value: 'on', label: `${on ? 'Assigned' : 'Assign'}: ${s.name}` }]}
                value={on ? 'on' : ''}
                onChange={() => setPicks((p) => { const n = { ...p }; if (on) delete n[s.id]; else n[s.id] = rels[rels.length - 1].id; return n; })}
              />
              {on ? <Chips options={rels.map((r) => ({ value: r.id, label: `${r.label} v${r.version}` }))} value={picks[s.id]} onChange={(v) => setPicks((p) => ({ ...p, [s.id]: v }))} /> : null}
            </View>
          );
        })
      )}
      {err ? <Banner tone="error" title={err} /> : null}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Btn label="Create firm" onPress={submit} loading={busy} />
        <Btn label="Cancel" variant="ghost" onPress={() => setOpen(false)} />
      </View>
    </Card>
  );
}

function FirmCard({ firm, ws, onAccess }: { firm: Firm; ws: Workspace; onAccess: (a: Access) => void }) {
  const c = useColors();
  const run = useRun();
  const [edit, setEdit] = useState(false);
  const [name, setName] = useState(firm.name);
  const [status, setStatus] = useState<string>(firm.status);
  const [assign, setAssign] = useState(false);
  const [sectorId, setSectorId] = useState('');
  const [releaseId, setReleaseId] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [confirm, setConfirm] = useState<null | { kind: 'assign' } | { kind: 'reset'; id: string; who: string } | { kind: 'status' }>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const items = ws.interfaces.filter((i) => i.firmId === firm.id);
  const partners = Array.from(
    new Map(
      ws.projects.filter((p) => p.firmId === firm.id).flatMap((p) => p.partners).map((x) => [x.identityId, x] as const),
    ).values(),
  );
  const relLabel = (sid: string, rid: string) => {
    const r = ws.sectors.find((s) => s.id === sid)?.releases.find((x) => x.id === rid);
    return r ? `${r.label} v${r.version}` : rid;
  };

  const exec = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErr(null);
    try { await fn(); } catch (e) { setErr(errMessage(e)); } finally { setBusy(false); setConfirm(null); }
  };
  const save = () => exec(async () => {
    await run('firm.update', { firmId: firm.id, name: name.trim(), status, revision: firm.revision });
    setEdit(false);
  });
  const doAssign = () => exec(async () => {
    await run('firm.assignSector', { firmId: firm.id, sectorId, releaseId, enabled });
    setAssign(false);
  });
  const doReset = (id: string) => exec(async () => {
    const res = await run('credentials.reset', { identityId: id });
    if (res.access) onAccess(res.access);
  });

  const rels = published(ws, sectorId);
  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <Text style={{ color: c.foreground, fontSize: 18, fontFamily: 'Inter_700Bold', flex: 1 }}>{firm.name}</Text>
        <Badge text={firm.status} tone={firm.status === 'ACTIVE' ? 'ok' : 'warn'} />
      </View>
      <Text style={{ color: c.mutedForeground, marginTop: 2 }}>Client code {firm.clientCode}</Text>

      <Label>{'\nACCOUNTANTS'}</Label>
      {firm.accountants.length === 0 ? <Text style={{ color: c.mutedForeground }}>None</Text> : firm.accountants.map((a) => (
        <View key={a.identityId} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
          <Text style={{ color: c.foreground }}>{a.displayName} · {a.mobile}</Text>
          <Btn label="Reset credential" variant="ghost" icon="key" onPress={() => setConfirm({ kind: 'reset', id: a.identityId, who: a.displayName })} />
        </View>
      ))}

      <Label>{'\nPARTNERS (FROM PROJECTS)'}</Label>
      {partners.length === 0 ? <Text style={{ color: c.mutedForeground }}>None</Text> : partners.map((a) => (
        <View key={a.identityId} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
          <Text style={{ color: c.foreground }}>{a.displayName}{a.mobile ? ` · ${a.mobile}` : ''}</Text>
          <Btn label="Reset credential" variant="ghost" icon="key" onPress={() => setConfirm({ kind: 'reset', id: a.identityId, who: a.displayName })} />
        </View>
      ))}

      <Label>{'\nSECTOR INTERFACES'}</Label>
      {items.length === 0 ? <Text style={{ color: c.mutedForeground }}>No sectors assigned.</Text> : items.map((i) => (
        <View key={i.sectorId} style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
          <Text style={{ color: c.foreground }}>{i.sectorName}</Text>
          <Text style={{ color: c.mutedForeground, fontSize: 12 }}>{relLabel(i.sectorId, i.releaseId)}</Text>
          <Badge text={i.enabled ? 'Enabled' : 'Disabled'} tone={i.enabled ? 'ok' : 'muted'} />
        </View>
      ))}

      {err ? <View style={{ marginTop: 10 }}><Banner tone="error" title={err} /></View> : null}

      {edit ? (
        <View style={{ marginTop: 14 }}>
          <Field label="Firm name" value={name} onChangeText={setName} />
          <Chips label="Status" options={[{ value: 'ACTIVE', label: 'Active' }, { value: 'SUSPENDED', label: 'Suspended' }]} value={status} onChange={setStatus} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Btn label="Save" loading={busy} onPress={() => (status !== firm.status && status === 'SUSPENDED' ? setConfirm({ kind: 'status' }) : void save())} />
            <Btn label="Cancel" variant="ghost" onPress={() => setEdit(false)} />
          </View>
        </View>
      ) : null}

      {assign ? (
        <View style={{ marginTop: 14 }}>
          <Chips label="Sector" options={ws.sectors.map((s) => ({ value: s.id, label: s.name }))} value={sectorId} onChange={(v) => { setSectorId(v); setReleaseId(''); }} />
          {sectorId ? (rels.length ? <Chips label="Published release" options={rels.map((r) => ({ value: r.id, label: `${r.label} v${r.version}` }))} value={releaseId} onChange={setReleaseId} /> : <Text style={{ color: c.warning, marginBottom: 10 }}>This sector has no published release.</Text>) : null}
          <Chips label="State" options={[{ value: 'on', label: 'Enabled' }, { value: 'off', label: 'Disabled' }]} value={enabled ? 'on' : 'off'} onChange={(v) => setEnabled(v === 'on')} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Btn label="Review assignment" disabled={!sectorId || !releaseId} onPress={() => setConfirm({ kind: 'assign' })} />
            <Btn label="Cancel" variant="ghost" onPress={() => setAssign(false)} />
          </View>
        </View>
      ) : null}

      {!edit && !assign ? (
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
          <Btn label="Edit / suspend" variant="ghost" icon="edit-2" onPress={() => { setName(firm.name); setStatus(firm.status); setEdit(true); }} />
          <Btn label="Assign sector" variant="ghost" icon="link" onPress={() => setAssign(true)} />
        </View>
      ) : null}

      {confirm?.kind === 'assign' ? <Confirm title="Confirm sector assignment" text={`${enabled ? 'Enable' : 'Disable'} ${ws.sectors.find((s) => s.id === sectorId)?.name} (${relLabel(sectorId, releaseId)}) for ${firm.name}? Accountants and partners of this firm will see this interface change.`} confirmLabel="Apply" onConfirm={() => void doAssign()} onCancel={() => setConfirm(null)} /> : null}
      {confirm?.kind === 'reset' ? <Confirm danger title="Reset credential" text={`Issue a new temporary credential for ${confirm.who}? Their current credential stops working.`} confirmLabel="Reset" onConfirm={() => void doReset(confirm.id)} onCancel={() => setConfirm(null)} /> : null}
      {confirm?.kind === 'status' ? <Confirm danger title="Suspend firm" text={`Suspend ${firm.name}? Its accountants and partners lose access until reactivated.`} confirmLabel="Suspend" onConfirm={() => void save()} onCancel={() => setConfirm(null)} /> : null}
    </Card>
  );
}

export function OwnerFirms({ ws }: { ws: Workspace }) {
  const [access, setAccess] = useState<Access | null>(null);
  return (
    <View>
      <H1 sub={`${ws.firms.length} firm${ws.firms.length === 1 ? '' : 's'} on this workspace`}>Firms</H1>
      <View style={{ marginBottom: 14 }}><CreateFirm ws={ws} onAccess={setAccess} /></View>
      {ws.firms.length === 0 ? <Empty icon="briefcase" title="No firms yet" text="Create a firm to onboard its accountant." /> : ws.firms.map((f) => <FirmCard key={f.id} firm={f} ws={ws} onAccess={setAccess} />)}
      <CredentialSheet access={access} onDone={() => setAccess(null)} />
    </View>
  );
}
