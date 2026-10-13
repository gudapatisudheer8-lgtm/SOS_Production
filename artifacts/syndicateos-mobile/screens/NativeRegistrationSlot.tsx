import React, { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getGetProjectErpQueryKey } from '@workspace/api-client-react';
import { nativeApi } from '@/lib/native-api';
import { newRequestId } from '@/lib/erp';
import { Banner, Btn, Card, Chips, Field, Label } from '@/components/ui';
import { errMessage } from '@/lib/session';

export interface NativeSlot {
  revision: number; state: 'none' | 'scheduled' | 'cancelled' | 'completed';
  date?: string; time?: string; location?: string; reminderMinutes?: number[];
}
interface SlotResponse {
  appointment: NativeSlot;
  policy: { defaultReminderMinutes: number[]; maxReminderMinutes: number; maxReminders: number; maxLocationLength: number };
}

/** A real native calendar. Uses business dates, not the phone's UTC day. */
export function NativeCalendar({ value, onChange }: { value: string; onChange: (date: string) => void }) {
  const now = new Date();
  const [month, setMonth] = useState(() => /^\d{4}-(0[1-9]|1[0-2])/.test(value)
    ? new Date(`${value.slice(0, 7)}-01T12:00:00`) : new Date(now.getFullYear(), now.getMonth(), 1));
  const year = month.getFullYear(), mon = month.getMonth();
  const offset = new Date(year, mon, 1).getDay();
  const days = new Date(year, mon + 1, 0).getDate();
  const date = (day: number) => `${year}-${String(mon + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return <View style={{ padding: 10, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 14, marginBottom: 12 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
      <Btn label="‹" variant="ghost" onPress={() => setMonth(new Date(year, mon - 1, 1))} />
      <Text style={{ fontFamily: 'Inter_700Bold' }}>{month.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</Text>
      <Btn label="›" variant="ghost" onPress={() => setMonth(new Date(year, mon + 1, 1))} />
    </View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => <Text key={day} style={{ width: '14.285%', textAlign: 'center', color: '#6b7280', paddingBottom: 8 }}>{day}</Text>)}
      {Array.from({ length: offset + days }, (_, i) => i < offset
        ? <View key={`blank-${i}`} style={{ width: '14.285%' }} />
        : <Pressable key={i} accessibilityRole="button" accessibilityLabel={`Select ${date(i - offset + 1)}`}
          accessibilityState={{ selected: value === date(i - offset + 1) }}
          onPress={() => onChange(date(i - offset + 1))}
          style={{ width: '14.285%', minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: value === date(i - offset + 1) ? '#ffbf00' : 'transparent' }}>
          <Text>{i - offset + 1}</Text>
        </Pressable>)}
    </View>
  </View>;
}

function SlotEditor({ projectId, inventoryId, response, readOnly }: {
  projectId: string; inventoryId: string; response: SlotResponse; readOnly: boolean;
}) {
  const slot = response.appointment;
  const [date, setDate] = useState(slot.date || '');
  const [time, setTime] = useState(slot.time || '');
  const [location, setLocation] = useState(slot.location || '');
  const [leads, setLeads] = useState<number[]>(slot.reminderMinutes || response.policy.defaultReminderMinutes);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const qc = useQueryClient();
  const attempt = useRef<{ fingerprint: string; requestId: string } | null>(null);
  const path = `/api/erp/${projectId}/plots/${inventoryId}/registration`;
  const save = async (action: 'save' | 'cancel') => {
    setError(''); setNotice('');
    if (action === 'save') {
      const timestamp = Date.parse(`${date}T${time}:00+05:30`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time) ||
        !Number.isFinite(timestamp) || new Date(timestamp + 330 * 60000).toISOString().slice(0, 16) !== `${date}T${time}` ||
        timestamp <= Date.now()) return setError('Select a valid future date and time in India time.');
      if (!location.trim()) return setError('Registration location is required.');
    }
    const body = { action, revision: slot.revision, date, time, location: location.trim(), reminderMinutes: leads };
    const fingerprint = JSON.stringify(body);
    if (attempt.current?.fingerprint !== fingerprint) attempt.current = { fingerprint, requestId: newRequestId() };
    setBusy(true);
    try {
      const result = await nativeApi<{ appointment: NativeSlot }>(path, { method: 'PUT', body: { ...body, requestId: attempt.current.requestId } });
      // Apply the confirmed response before refreshing other projections. A
      // failed refresh must not turn a saved appointment into a new request.
      qc.setQueryData(['native-registration', projectId, inventoryId], { ...response, appointment: result.appointment });
      setNotice(action === 'save' ? 'Registration slot saved. Project partners and accountants are notified.' : 'Registration slot cancelled.');
      void qc.invalidateQueries({ queryKey: getGetProjectErpQueryKey(projectId) });
      void qc.invalidateQueries({ queryKey: ['native-notifications'] });
    } catch (e) { setError(errMessage(e)); }
    finally { setBusy(false); }
  };
  return <Card style={{ backgroundColor: '#faf5ff', borderColor: '#e9d5ff' }}>
    <Label>REGISTRATION APPOINTMENT</Label>
    <Text style={{ fontFamily: 'Inter_700Bold', color: '#7e22ce', marginBottom: 12 }}>{slot.state === 'scheduled' ? 'Slot booked for registration' : slot.state === 'completed' ? 'Registration completed' : 'Book a registration slot'}</Text>
    <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>India time (Asia/Kolkata). Saving a slot does not record a payment or mark the plot sold.</Text>
    {!!error && <Banner tone="error" title="Slot not saved" text={error} />}
    {!!notice && <Banner tone="ok" title={notice} />}
    {!readOnly && slot.state !== 'completed' && <NativeCalendar value={date} onChange={setDate} />}
    <Field label="Registration date" value={date} onChangeText={setDate} hint="YYYY-MM-DD" editable={!readOnly && !busy && slot.state !== 'completed'} />
    <Field label="Registration time" value={time} onChangeText={setTime} hint="24-hour time, e.g. 10:30" editable={!readOnly && !busy && slot.state !== 'completed'} />
    <Field label="Registration location" value={location} onChangeText={setLocation} editable={!readOnly && !busy && slot.state !== 'completed'} />
    {!readOnly && slot.state !== 'completed' && <>
      <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>Remind partners and accountants before the appointment:</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {[...new Set([1440, 120, 60, ...response.policy.defaultReminderMinutes, ...leads])].filter(n => n <= response.policy.maxReminderMinutes).map(n =>
          <Btn key={n} label={`${leads.includes(n) ? '✓ ' : ''}${n >= 1440 ? `${n / 1440} day` : `${n} min`}`}
            variant={leads.includes(n) ? 'primary' : 'ghost'} disabled={busy}
            onPress={() => setLeads(old => old.includes(n) ? old.filter(x => x !== n) : old.length < response.policy.maxReminders ? [...old, n] : old)} />)}
      </View>
      <View style={{ height: 12 }} />
      <Btn label={slot.state === 'scheduled' ? 'Update registration slot' : 'Save registration slot'} loading={busy} onPress={() => void save('save')} />
      {slot.state === 'scheduled' && <Btn label="Cancel registration slot" variant="danger" disabled={busy} onPress={() => void save('cancel')} />}
    </>}
  </Card>;
}

export function NativeRegistrationSlot({ projectId, inventoryId, readOnly }: { projectId: string; inventoryId: string; readOnly: boolean }) {
  const query = useQuery({
    queryKey: ['native-registration', projectId, inventoryId],
    queryFn: () => nativeApi<SlotResponse>(`/api/erp/${projectId}/plots/${inventoryId}/registration`),
  });
  if (query.isLoading) return <Text>Loading registration appointment…</Text>;
  if (query.isError || !query.data) return <Banner tone="error" title="Registration appointment unavailable" text={errMessage(query.error)} action={{ label: 'Retry', onPress: () => void query.refetch() }} />;
  return <SlotEditor key={`${inventoryId}-${query.data.appointment.revision}`} projectId={projectId} inventoryId={inventoryId} response={query.data} readOnly={readOnly} />;
}
