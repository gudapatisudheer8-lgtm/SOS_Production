import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type {
  ConfigComponent,
  ConfigField,
  Project,
  SectorConfiguration,
  SessionAccount,
  Workspace,
  WorkspaceInterfacesItem,
} from '@workspace/api-client-react';
import { Badge, Btn, Banner, Card, Chips, CredentialSheet, Empty, Field, H1, Label } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { errMessage } from '@/lib/session';
import { useRun } from '@/lib/workspace';

type Mode = 'live' | 'readonly' | 'preview';
type Raw = string | boolean | null;
type Access = { mobile: string; reused: boolean; temporaryCredential?: string; expiresAt?: string };

const STATUSES = ['ACTIVE', 'COMPLETED', 'ARCHIVED'].map((v) => ({ value: v, label: v.charAt(0) + v.slice(1).toLowerCase() }));

const detailKey = (k: string) => k.slice('details.'.length);

/** Returns a problem description when the configured fields do not match the trusted command contract. */
function checkFields(fields: ConfigField[], required: string[], coreAllowed: string[], allowDetails: boolean): string | null {
  for (const r of required) if (!fields.some((f) => f.key === r)) return `Missing required field "${r}".`;
  const seen = new Set<string>();
  for (const f of fields) {
    if (seen.has(f.key)) return `Duplicate field key "${f.key}".`;
    seen.add(f.key);
    const okCore = coreAllowed.includes(f.key);
    const okDetail = allowDetails && f.key.startsWith('details.') && f.key.length > 'details.'.length;
    if (!okCore && !okDetail) return `Field key "${f.key}" is not supported by this form.`;
  }
  return null;
}

function InvalidConfig({ what, problem }: { what: string; problem: string }) {
  return <Banner tone="error" title={`Invalid configuration: ${what}`} text={`${problem} The release must be corrected by the owner; nothing has been substituted.`} />;
}

function readField(f: ConfigField, p: Project | null): Raw {
  let v: unknown;
  if (!p) v = undefined;
  else if (f.key === 'name') v = p.name;
  else if (f.key === 'location') v = p.location;
  else v = p.details?.[detailKey(f.key)];
  if (f.kind === 'boolean') return typeof v === 'boolean' ? v : null;
  if (v === null || v === undefined) return '';
  return String(v);
}

/** Returns [value, error]. Keeps 0, null and '' distinct. */
function parseField(f: ConfigField, raw: Raw): [unknown, string | null] {
  const k = f.constraints ?? {};
  const num = (x: unknown) => (typeof x === 'number' ? x : undefined);
  if (f.kind === 'boolean') {
    if (raw === null && f.required) return [null, `${f.label} is required.`];
    return [raw, null];
  }
  const t = typeof raw === 'string' ? raw : '';
  if (t.trim() === '') {
    if (f.required) return [null, `${f.label} is required.`];
    return [f.kind === 'text' ? t : null, null];
  }
  if (f.kind === 'number') {
    const n = Number(t);
    if (!Number.isFinite(n)) return [null, `${f.label} must be a number.`];
    if (num(k.min) !== undefined && n < (k.min as number)) return [null, `${f.label} must be at least ${k.min}.`];
    if (num(k.max) !== undefined && n > (k.max as number)) return [null, `${f.label} must be at most ${k.max}.`];
    return [n, null];
  }
  if (f.kind === 'date') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return [null, `${f.label} must be YYYY-MM-DD.`];
    return [t, null];
  }
  if (f.kind === 'select') {
    if (!f.options.some((o) => o.value === t)) return [null, `Choose a valid ${f.label}.`];
    return [t, null];
  }
  if (num(k.maxLength) !== undefined && t.length > (k.maxLength as number)) return [null, `${f.label} is limited to ${k.maxLength} characters.`];
  return [t, null];
}

function FieldInput({ f, value, onChange, error }: { f: ConfigField; value: Raw; onChange: (v: Raw) => void; error?: string }) {
  const c = useColors();
  const label = f.label + (f.required ? ' *' : '');
  if (f.kind === 'select') {
    return (
      <View>
        <Chips
          label={label}
          options={[...(f.required ? [] : [{ value: '', label: 'None' }]), ...f.options]}
          value={typeof value === 'string' ? value : ''}
          onChange={(v) => onChange(v)}
        />
        {error ? <Text style={{ color: c.destructive, fontSize: 12, marginBottom: 8 }}>{error}</Text> : null}
      </View>
    );
  }
  if (f.kind === 'boolean') {
    return (
      <View>
        <Chips
          label={label}
          options={[
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' },
            ...(f.required ? [] : [{ value: 'unset', label: 'Not set' }]),
          ]}
          value={value === true ? 'yes' : value === false ? 'no' : f.required ? '' : 'unset'}
          onChange={(v) => onChange(v === 'yes' ? true : v === 'no' ? false : null)}
        />
        {error ? <Text style={{ color: c.destructive, fontSize: 12, marginBottom: 8 }}>{error}</Text> : null}
      </View>
    );
  }
  const k = f.constraints ?? {};
  const hint = [
    f.kind === 'date' ? 'YYYY-MM-DD' : '',
    k.min !== undefined ? `min ${String(k.min)}` : '',
    k.max !== undefined ? `max ${String(k.max)}` : '',
    k.maxLength !== undefined ? `up to ${String(k.maxLength)} characters` : '',
  ].filter(Boolean).join(' · ');
  return (
    <Field
      label={label}
      value={typeof value === 'string' ? value : ''}
      onChangeText={onChange}
      keyboardType={f.kind === 'number' ? 'numeric' : 'default'}
      error={error}
      hint={hint || undefined}
    />
  );
}

interface Ctx {
  item: WorkspaceInterfacesItem;
  projects: Project[];
  selected: Project | null;
  select: (id: string | null) => void;
  role: SessionAccount['role'];
  mode: Mode;
}

function ProjectList({ ctx }: { ctx: Ctx }) {
  const c = useColors();
  if (!ctx.projects.length)
    return <Empty icon="folder" title="No projects yet" text="Projects in this sector will appear here once they exist." />;
  return (
    <View>
      {ctx.projects.map((p) => {
        const on = ctx.selected?.id === p.id;
        return (
          <Pressable key={p.id} onPress={() => ctx.select(on ? null : p.id)} accessibilityRole="button">
            <Card style={{ borderColor: on ? c.primary : c.border, borderWidth: on ? 2 : 1 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                <Text style={{ color: c.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 16, flex: 1 }}>{p.name}</Text>
                <Badge text={p.status} tone={p.status === 'ACTIVE' ? 'ok' : 'muted'} />
              </View>
              <Text style={{ color: c.mutedForeground, marginTop: 4 }}>{p.location || 'No location'}</Text>
              <Text style={{ color: c.mutedForeground, fontSize: 12, marginTop: 6 }}>
                {p.partners.length} partner{p.partners.length === 1 ? '' : 's'} · {on ? 'selected' : 'tap to select'}
              </Text>
            </Card>
          </Pressable>
        );
      })}
    </View>
  );
}

function Summary({ ctx }: { ctx: Ctx }) {
  const c = useColors();
  const by = (s: string) => ctx.projects.filter((p) => p.status === s).length;
  const partners = ctx.projects.reduce((n, p) => n + p.partners.length, 0);
  const stats: [string, number][] = [
    ['Projects', ctx.projects.length],
    ['Active', by('ACTIVE')],
    ['Completed', by('COMPLETED')],
    ['Archived', by('ARCHIVED')],
    ['Partner links', partners],
  ];
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
      {stats.map(([l, n]) => (
        <Card key={l} style={{ minWidth: 120, flexGrow: 1, marginBottom: 0 }}>
          <Text style={{ color: c.foreground, fontSize: 28, fontFamily: 'Inter_700Bold' }}>{n}</Text>
          <Text style={{ color: c.mutedForeground, fontSize: 12 }}>{l}</Text>
        </Card>
      ))}
    </View>
  );
}

function ReadOnlyNote() {
  return <Empty icon="lock" title="Read-only" text="This sector is disabled for the firm. Existing records stay visible, but changes are not available." />;
}

function PreviewNote() {
  return <Banner tone="warn" title="Preview only" text="This form shows the configured layout. Nothing is submitted from here." />;
}

function NeedProject() {
  return <Empty icon="mouse-pointer" title="Select a project first" text="Choose a project from the project list, then return here." />;
}

function PartnerList({ ctx }: { ctx: Ctx }) {
  const c = useColors();
  if (!ctx.selected) return <NeedProject />;
  const ps = ctx.selected.partners;
  return (
    <View>
      <Label>{`PARTNERS IN ${ctx.selected.name.toUpperCase()}`}</Label>
      {ps.length === 0 ? (
        <Empty icon="users" title="No partners on this project" />
      ) : (
        ps.map((p) => (
          <Card key={p.identityId} style={{ padding: 12 }}>
            <Text style={{ color: c.foreground, fontFamily: 'Inter_600SemiBold' }}>{p.displayName}</Text>
            {p.mobile ? <Text style={{ color: c.mutedForeground, fontSize: 13 }}>{p.mobile}</Text> : null}
          </Card>
        ))
      )}
    </View>
  );
}

function ProjectForm({ ctx, comp }: { ctx: Ctx; comp: ConfigComponent }) {
  const run = useRun();
  const editing = ctx.selected;
  const fields = comp.fields;
  const problem = useMemo(() => checkFields(fields, ['name'], ['name', 'location'], true), [fields]);
  const [vals, setVals] = useState<Record<string, Raw>>({});
  const [status, setStatus] = useState<string | null>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null | undefined>(undefined);
  const key = editing ? `${editing.id}:${editing.revision}` : null;
  if (loadedFor !== key) {
    const init: Record<string, Raw> = {};
    fields.forEach((f) => (init[f.key] = readField(f, editing)));
    setVals(init);
    setStatus(editing?.status ?? null);
    setErrs({});
    setLoadedFor(key);
  }
  if (problem) return <InvalidConfig what="project form" problem={problem} />;
  if (ctx.mode === 'readonly') return <ReadOnlyNote />;
  const preview = ctx.mode === 'preview';
  const wanted = editing ? 'project.update' : 'project.create';
  const action = comp.actions.find((a) => a.key === wanted);
  const known = comp.actions.filter((a) => a.key !== 'project.create' && a.key !== 'project.update');

  const submit = async () => {
    if (preview) return;
    const e: Record<string, string> = {};
    const details: Record<string, unknown> = { ...(editing?.details ?? {}) };
    let name = '';
    let location: string | null = null;
    for (const f of fields) {
      const [v, err] = parseField(f, vals[f.key] ?? (f.kind === 'boolean' ? null : ''));
      if (err) e[f.key] = err;
      else if (f.key === 'name') name = String(v ?? '');
      else if (f.key === 'location') location = v === null || v === '' ? null : String(v);
      else details[detailKey(f.key)] = v;
    }
    setErrs(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    setMsg(null);
    try {
      if (editing) {
        await run('project.update', { projectId: editing.id, revision: editing.revision, name, location, status: status ?? editing.status, details });
        setMsg({ ok: true, text: 'Project updated.' });
      } else {
        await run('project.create', { sectorId: ctx.item.sectorId, name, location, details });
        setMsg({ ok: true, text: 'Project created.' });
        setVals({});
        setLoadedFor(undefined);
      }
    } catch (err) {
      setMsg({ ok: false, text: errMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <Text style={{ fontSize: 17, fontFamily: 'Inter_700Bold', marginBottom: 12 }}>
        {editing ? `Edit ${editing.name}` : 'New project'}
      </Text>
      {preview ? <PreviewNote /> : null}
      {editing ? <Btn label="Start a new project instead" variant="ghost" onPress={() => ctx.select(null)} /> : null}
      <View style={{ height: 12 }} />
      {fields.map((f) => (
        <FieldInput key={f.key} f={f} value={vals[f.key] ?? (f.kind === 'boolean' ? null : '')} error={errs[f.key]} onChange={(v) => setVals((s) => ({ ...s, [f.key]: v }))} />
      ))}
      {editing ? <Chips label="Status" options={STATUSES} value={status ?? ''} onChange={setStatus} /> : null}
      {msg ? <Banner tone={msg.ok ? 'ok' : 'error'} title={msg.text} /> : null}
      {action ? (
        <Btn label={action.label} onPress={submit} loading={busy} disabled={preview} />
      ) : (
        <Banner tone="warn" title="Action not configured" text={`This interface does not include a ${wanted} action, so this form is read-only.`} />
      )}
      {known.length ? <Text style={{ color: '#718078', fontSize: 12, marginTop: 8 }}>Other configured actions are not supported yet: {known.map((a) => a.label).join(', ')}.</Text> : null}
    </Card>
  );
}

function PartnerForm({ ctx, comp }: { ctx: Ctx; comp: ConfigComponent }) {
  const run = useRun();
  const fields = comp.fields;
  const problem = useMemo(() => checkFields(fields, ['name', 'mobile'], ['name', 'mobile'], false), [fields]);
  const [vals, setVals] = useState<Record<string, Raw>>({});
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [access, setAccess] = useState<Access | null>(null);
  if (problem) return <InvalidConfig what="partner form" problem={problem} />;
  if (ctx.mode === 'readonly') return <ReadOnlyNote />;
  if (!ctx.selected) return <NeedProject />;
  const preview = ctx.mode === 'preview';
  const action = comp.actions.find((a) => a.key === 'partner.add');

  const submit = async () => {
    if (preview) return;
    const e: Record<string, string> = {};
    const out: Record<string, unknown> = {};
    for (const f of fields) {
      const [v, err] = parseField(f, vals[f.key] ?? (f.kind === 'boolean' ? null : ''));
      if (err) e[f.key] = err;
      else out[f.key] = v;
    }
    setErrs(e);
    if (Object.keys(e).length || !ctx.selected) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await run('partner.add', { projectId: ctx.selected.id, name: out.name, mobile: out.mobile });
      setVals({});
      setMsg({ ok: true, text: 'Partner added.' });
      if (res.access) setAccess(res.access);
    } catch (err) {
      setMsg({ ok: false, text: errMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <Text style={{ fontSize: 17, fontFamily: 'Inter_700Bold', marginBottom: 12 }}>{ctx.selected.name}</Text>
      {preview ? <PreviewNote /> : null}
      {fields.map((f) => (
        <FieldInput key={f.key} f={f} value={vals[f.key] ?? (f.kind === 'boolean' ? null : '')} error={errs[f.key]} onChange={(v) => setVals((x) => ({ ...x, [f.key]: v }))} />
      ))}
      {msg ? <Banner tone={msg.ok ? 'ok' : 'error'} title={msg.text} /> : null}
      {action ? <Btn label={action.label} onPress={submit} loading={busy} disabled={preview} /> : <Banner tone="warn" title="Action not configured" text="This form has no partner.add action." />}
      <CredentialSheet access={access} onDone={() => setAccess(null)} />
    </Card>
  );
}

function Render({ comp, ctx }: { comp: ConfigComponent; ctx: Ctx }) {
  switch (comp.key) {
    case 'summary': return <Summary ctx={ctx} />;
    case 'project-list': return <ProjectList ctx={ctx} />;
    case 'project-form': return <ProjectForm ctx={ctx} comp={comp} />;
    case 'partner-list': return <PartnerList ctx={ctx} />;
    case 'partner-form': return <PartnerForm ctx={ctx} comp={comp} />;
    default: return <Banner tone="warn" title="Unsupported component" text={`"${String(comp.key)}" is not in the component registry.`} />;
  }
}

function InterfaceView({ item, projects, role, mode }: { item: WorkspaceInterfacesItem; projects: Project[]; role: SessionAccount['role']; mode: Mode }) {
  const c = useColors();
  const iface = item.configuration.interfaces.find((i) => i.role === role);
  const [screenKey, setScreenKey] = useState<string | null>(null);
  const [selId, setSelId] = useState<string | null>(null);
  const selected = projects.find((p) => p.id === selId) ?? null;
  if (!iface || iface.screens.length === 0)
    return <Empty icon="layout" title="No screens configured" text={`Release "${item.configuration.label}" defines no ${role.toLowerCase()} interface.`} />;
  const screen = iface.screens.find((s) => s.key === screenKey) ?? iface.screens[0];
  const ctx: Ctx = { item, projects, selected, select: setSelId, role, mode };
  return (
    <View>
      <H1 sub={`${selected ? `Selected: ${selected.name} · ` : ''}${projects.length} project${projects.length === 1 ? '' : 's'}`}>{iface.title}</H1>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {iface.screens.map((s) => {
          const on = s.key === screen.key;
          return (
            <Pressable key={s.key} onPress={() => setScreenKey(s.key)} accessibilityRole="tab"
              style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10, backgroundColor: on ? c.secondary : 'transparent' }}>
              <Text style={{ color: on ? c.secondaryForeground : c.mutedForeground, fontFamily: 'Inter_600SemiBold' }}>{s.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {screen.components.length === 0 ? <Empty icon="box" title="This screen has no components" /> : null}
      {screen.components.map((comp, i) => <Render key={`${screen.key}-${i}`} comp={comp} ctx={ctx} />)}
    </View>
  );
}

export function SectorWorkspace({ ws, account }: { ws: Workspace; account: SessionAccount }) {
  const c = useColors();
  const role = account.role;
  const projectsOf = (i: WorkspaceInterfacesItem) => ws.projects.filter((p) => p.firmId === i.firmId && p.sectorId === i.sectorId);
  // Disabled assignments stay visible (read-only) while they still hold historical projects.
  const items = ws.interfaces.filter((i) => i.configuration.interfaces.some((x) => x.role === role) && (i.enabled || projectsOf(i).length > 0));
  const [sel, setSel] = useState<string | null>(null);
  if (items.length === 0)
    return <Empty icon="inbox" title="No interface assigned" text="Your firm has no enabled sector interface for your role yet. The owner assigns sectors to firms." />;
  const keyOf = (i: WorkspaceInterfacesItem) => `${i.firmId}:${i.sectorId}`;
  const item = items.find((i) => keyOf(i) === sel) ?? items[0];
  const firmName = (id: string) => ws.firms.find((f) => f.id === id)?.name ?? 'Firm';
  return (
    <View>
      {items.length > 1 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          {items.map((i) => {
            const on = keyOf(i) === keyOf(item);
            return (
              <Pressable key={keyOf(i)} onPress={() => setSel(keyOf(i))} accessibilityRole="button"
                style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: on ? c.primary : c.border, backgroundColor: on ? c.primary : c.card }}>
                <Text style={{ color: on ? c.primaryForeground : c.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>{i.sectorName}{i.enabled ? '' : ' · Disabled'}</Text>
                <Text style={{ color: on ? c.primaryForeground : c.mutedForeground, fontSize: 11 }}>{firmName(i.firmId)} · {i.configuration.label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <Text style={{ color: c.mutedForeground, fontSize: 12, marginBottom: 8 }}>{firmName(item.firmId)} · {item.sectorName} · {item.configuration.label}{item.enabled ? '' : ' · Disabled, read-only'}</Text>
      )}
      <InterfaceView key={keyOf(item) + item.releaseId} item={item} projects={projectsOf(item)} role={role} mode={item.enabled ? 'live' : 'readonly'} />
    </View>
  );
}

/** Renders a fetched configuration for a role. Forms are preview-only and never run commands. */
export function PreviewInterface({ cfg, role, projects }: { cfg: SectorConfiguration; role: SessionAccount['role']; projects: Project[] }) {
  const item: WorkspaceInterfacesItem = { firmId: 'preview', sectorId: cfg.sectorId, releaseId: cfg.releaseId, sectorName: cfg.label, enabled: true, configuration: cfg };
  return <InterfaceView key={`${cfg.releaseId}:${cfg.revision}:${role}`} item={item} projects={projects.filter((p) => p.sectorId === cfg.sectorId)} role={role} mode="preview" />;
}
