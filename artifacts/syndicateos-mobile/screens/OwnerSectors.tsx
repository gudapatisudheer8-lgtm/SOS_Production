import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { getConfiguration, type SectorConfiguration, type Workspace } from '@workspace/api-client-react';
import { PreviewInterface } from '@/screens/SectorInterface';
import { Badge, Chips, Banner, Btn, Card, Confirm, Empty, Field, H1, Label } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { errMessage } from '@/lib/session';
import { useRun } from '@/lib/workspace';

const HELP =
  'A release is JSON: { sectorId, label, interfaces, grants }. Each interface has a role (ACCOUNTANT or PARTNER), a title and screens. Each screen has a key, label and components. Component keys: summary, project-list, project-form, partner-list, partner-form. Form components list fields { key, label, kind: text|number|date|select|boolean, required, constraints {min,max,maxLength}, options [{value,label}] } where key is "name", "location" or "details.YOUR_FIELD". Actions are { key, label } such as project.create, project.update, partner.add. Grants are { role, permission, scope: FIRM|MEMBER_PROJECTS }. Do not include releaseId, version, state or revision on a new draft.';

const template = (sectorId: string) =>
  JSON.stringify(
    {
      sectorId,
      label: 'Draft release',
      interfaces: [
        {
          role: 'ACCOUNTANT',
          title: 'Accountant desk',
          screens: [
            {
              key: 'projects',
              label: 'Projects',
              components: [
                { key: 'project-list', props: {}, fields: [], actions: [] },
                { key: 'project-form', props: {}, fields: [{ key: 'name', label: 'Project name', kind: 'text', required: true, constraints: { maxLength: 120 }, options: [] }], actions: [{ key: 'project.create', label: 'Create project' }, { key: 'project.update', label: 'Save changes' }] },
              ],
            },
          ],
        },
      ],
      grants: [{ role: 'ACCOUNTANT', permission: 'project.create', scope: 'FIRM' }],
    },
    null,
    2,
  );

function Preview({ cfg }: { cfg: SectorConfiguration }) {
  const c = useColors();
  return (
    <View style={{ marginTop: 12 }}>
      <Label>PREVIEW FROM SERVER · {cfg.label} · v{cfg.version} · {cfg.state}</Label>
      {cfg.interfaces.map((i) => (
        <View key={i.role} style={{ marginBottom: 8 }}>
          <Text style={{ color: c.foreground, fontFamily: 'Inter_700Bold' }}>{i.role}: {i.title}</Text>
          {i.screens.map((s) => (
            <View key={s.key} style={{ marginLeft: 12, marginTop: 4 }}>
              <Text style={{ color: c.foreground }}>{s.label}</Text>
              {s.components.map((m, n) => (
                <Text key={n} style={{ color: c.mutedForeground, marginLeft: 12, fontSize: 12 }}>
                  {m.key}{m.fields.length ? ` · ${m.fields.map((f) => f.label).join(', ')}` : ''}{m.actions.length ? ` · actions: ${m.actions.map((a) => a.label).join(', ')}` : ''}
                </Text>
              ))}
            </View>
          ))}
        </View>
      ))}
      <Text style={{ color: c.mutedForeground, fontSize: 12 }}>{cfg.grants.length} grant{cfg.grants.length === 1 ? '' : 's'}</Text>
    </View>
  );
}

function Editor({ ws, sectorId, releaseId, onClose, onOpen }: { ws: Workspace; sectorId: string; releaseId: string | null; onClose: () => void; onOpen: (id: string) => void }) {
  const run = useRun();
  const [text, setText] = useState(releaseId ? '' : template(sectorId));
  const [meta, setMeta] = useState<{ revision: number; state: string } | null>(null);
  const [cfg, setCfg] = useState<SectorConfiguration | null>(null);
  const [loaded, setLoaded] = useState<string | null | undefined>(undefined);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error' | 'warn'; title: string; text?: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmPub, setConfirmPub] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [prevRole, setPrevRole] = useState<'ACCOUNTANT' | 'PARTNER'>('ACCOUNTANT');

  const load = async (id: string) => {
    setLoadErr(null);
    try {
      const r = await getConfiguration(id);
      setCfg(r);
      setMeta({ revision: r.revision, state: r.state });
      setText(JSON.stringify(r, null, 2));
    } catch (e) {
      setLoadErr(errMessage(e));
    }
  };
  if (loaded !== releaseId) {
    setLoaded(releaseId);
    setMeta(null);
    setCfg(null);
    setMsg(null);
    if (releaseId) void load(releaseId);
    else setText(template(sectorId));
  }
  const readOnly = meta?.state === 'PUBLISHED';

  const parse = (): Record<string, unknown> | null => {
    try {
      const v: unknown = JSON.parse(text);
      if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('Top level must be a JSON object.');
      return v as Record<string, unknown>;
    } catch (e) {
      setMsg({ tone: 'error', title: 'Invalid JSON', text: errMessage(e) });
      return null;
    }
  };
  const go = async (name: string, fn: () => Promise<void>) => {
    setBusy(name);
    setMsg(null);
    try { await fn(); } catch (e) { setMsg({ tone: 'error', title: `${name} failed`, text: errMessage(e) }); } finally { setBusy(null); }
  };
  const save = () => go('Save', async () => {
    const body = parse();
    if (!body) return;
    delete body.version;
    delete body.state;
    if (releaseId && meta) { body.releaseId = releaseId; body.revision = meta.revision; } else { delete body.releaseId; delete body.revision; }
    body.sectorId = sectorId;
    const res = await run('configuration.save', body);
    const ent = res.entity ?? {};
    const id = String(ent.releaseId ?? ent.id ?? releaseId ?? '');
    setMsg({ tone: 'ok', title: 'Draft saved' });
    if (id && id !== releaseId) { setLoaded(id); onOpen(id); }
    if (id) await load(id);
  });
  const validate = () => go('Validate', async () => {
    if (!releaseId || !meta) return setMsg({ tone: 'warn', title: 'Save the draft first' });
    const res = await run('configuration.validate', { releaseId });
    const errs = res.errors ?? [];
    setMsg(errs.length ? { tone: 'error', title: 'Validation found problems', text: errs.join('\n') } : { tone: 'ok', title: 'Valid', text: res.status });
  });
  const preview = () => go('Preview', async () => {
    if (!releaseId) return setMsg({ tone: 'warn', title: 'Save the draft first' });
    await load(releaseId);
    setShowPreview(true);
  });
  const publish = () => go('Publish', async () => {
    setConfirmPub(false);
    if (!releaseId || !meta) return;
    await run('configuration.publish', { releaseId, revision: meta.revision });
    setMsg({ tone: 'ok', title: 'Published', text: 'This release is now immutable. Clone it to make changes.' });
    await load(releaseId);
  });

  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 17, fontFamily: 'Inter_700Bold' }}>{releaseId ? 'Release editor' : 'New draft'}</Text>
        {meta ? <Badge text={`${meta.state} · rev ${meta.revision}`} tone={readOnly ? 'ok' : 'warn'} /> : null}
      </View>
      <Text style={{ fontSize: 12, lineHeight: 18, opacity: 0.65, marginVertical: 10 }}>{HELP}</Text>
      {loadErr ? <Banner tone="error" title="Could not load release" text={loadErr} action={releaseId ? { label: 'Retry', onPress: () => void load(releaseId) } : undefined} /> : null}
      <Field label="Configuration JSON" value={text} onChangeText={setText} multiline mono height={340} editable={!readOnly} hint={readOnly ? 'Published releases are read-only. Clone to a new draft to edit.' : undefined} />
      {msg ? <Banner tone={msg.tone} title={msg.title} text={msg.text} /> : null}
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {!readOnly ? <Btn label="Save draft" icon="save" onPress={save} loading={busy === 'Save'} /> : null}
        <Btn label="Validate" variant="ghost" onPress={validate} loading={busy === 'Validate'} disabled={!releaseId || readOnly} />
        <Btn label="Preview" variant="ghost" onPress={preview} loading={busy === 'Preview'} disabled={!releaseId} />
        {!readOnly ? <Btn label="Publish" variant="ghost" onPress={() => setConfirmPub(true)} disabled={!releaseId} /> : null}
        <Btn label="Close" variant="ghost" onPress={onClose} />
      </View>
      {cfg && showPreview ? (
        <View style={{ marginTop: 14 }}>
          <Banner tone="warn" title="Rendered preview" text="Shows the saved release as each role would see it, using real authorised project data. Forms are preview-only and run no commands." />
          <Chips label="Preview as" options={[{ value: 'ACCOUNTANT', label: 'Accountant' }, { value: 'PARTNER', label: 'Partner' }]} value={prevRole} onChange={setPrevRole} />
          <PreviewInterface cfg={cfg} role={prevRole} projects={ws.projects} />
        </View>
      ) : null}
      {cfg ? <Preview cfg={cfg} /> : null}
      {confirmPub ? <Confirm title="Publish release" text="Publishing makes this release immutable and available to assign to firms. Validate first." confirmLabel="Publish" onConfirm={() => void publish()} onCancel={() => setConfirmPub(false)} /> : null}
    </Card>
  );
}

export function OwnerSectors({ ws }: { ws: Workspace }) {
  const c = useColors();
  const run = useRun();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [edit, setEdit] = useState<{ sectorId: string; releaseId: string | null } | null>(null);

  const createSector = async () => {
    if (!code.trim() || !name.trim()) return setErr('Code and name are required.');
    setBusy('sector'); setErr(null);
    try { await run('sector.create', { code: code.trim(), name: name.trim() }); setCode(''); setName(''); }
    catch (e) { setErr(errMessage(e)); } finally { setBusy(null); }
  };
  const clone = async (sectorId: string, releaseId: string) => {
    setBusy(releaseId); setErr(null);
    try {
      const src = await getConfiguration(releaseId);
      const { releaseId: _r, version: _v, state: _s, revision: _rev, ...rest } = src;
      void _r; void _v; void _s; void _rev;
      const res = await run('configuration.save', { ...rest, label: `${src.label} (copy)` });
      const id = String(res.entity?.releaseId ?? res.entity?.id ?? '');
      setEdit({ sectorId, releaseId: id || null });
    } catch (e) { setErr(errMessage(e)); } finally { setBusy(null); }
  };

  return (
    <View>
      <H1 sub="Each sector is a database-configured interface. Edit drafts, validate, then publish.">Sectors</H1>
      <Card>
        <Text style={{ fontFamily: 'Inter_700Bold', marginBottom: 10 }}>Create sector</Text>
        <Field label="Code" value={code} onChangeText={setCode} />
        <Field label="Name" value={name} onChangeText={setName} />
        <Btn label="Create sector" icon="plus" onPress={createSector} loading={busy === 'sector'} />
      </Card>
      {err ? <Banner tone="error" title={err} /> : null}
      {edit ? <Editor ws={ws} key={edit.releaseId ?? 'new'} sectorId={edit.sectorId} releaseId={edit.releaseId} onClose={() => setEdit(null)} onOpen={(id) => setEdit({ sectorId: edit.sectorId, releaseId: id })} /> : null}
      {ws.sectors.length === 0 ? <Empty icon="grid" title="No sectors yet" text="Create a sector, then author its first release." /> : ws.sectors.map((s) => (
        <Card key={s.id}>
          <Text style={{ color: c.foreground, fontSize: 18, fontFamily: 'Inter_700Bold' }}>{s.name}</Text>
          <Text style={{ color: c.mutedForeground, fontSize: 12, marginBottom: 10 }}>{s.code}</Text>
          {s.releases.length === 0 ? <Text style={{ color: c.mutedForeground }}>No releases.</Text> : s.releases.map((r) => (
            <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', paddingVertical: 6 }}>
              <Text style={{ color: c.foreground, flex: 1, minWidth: 140 }}>{r.label} · v{r.version}</Text>
              <Badge text={r.state} tone={r.state === 'PUBLISHED' ? 'ok' : 'warn'} />
              <Btn label={r.state === 'DRAFT' ? 'Edit' : 'View'} variant="ghost" onPress={() => setEdit({ sectorId: s.id, releaseId: r.id })} />
              {r.state === 'PUBLISHED' ? <Btn label="Clone to draft" variant="ghost" onPress={() => void clone(s.id, r.id)} loading={busy === r.id} /> : null}
            </View>
          ))}
          <View style={{ marginTop: 8 }}><Btn label="New draft" icon="file-plus" variant="ghost" onPress={() => setEdit({ sectorId: s.id, releaseId: null })} /></View>
        </Card>
      ))}
    </View>
  );
}
