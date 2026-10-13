import { useEffect, useRef, useState } from 'react';
import { api, newRequestId } from '../../../adapter/api';
import type { Plot, Project } from '../../types';

export interface RegistrationSlot {
  revision: number; state: 'none' | 'scheduled' | 'cancelled' | 'completed';
  date?: string; time?: string; startsAt?: string; location?: string; reminderMinutes?: number[];
}
export function indiaAppointment(date: string, time: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return NaN;
  const stamp = Date.parse(`${date}T${time}:00+05:30`);
  // JS can normalize impossible dates, so roundtrip in the business timezone.
  if (!Number.isFinite(stamp) || new Date(stamp + 330 * 60000).toISOString().slice(0, 16) !== `${date}T${time}`) return NaN;
  return stamp;
}

/** Independent buttons inside the existing payment form: never submit a financial entry. */
export function RegistrationAppointment({ plot, project, stage, onLoadedStage }: {
  plot: Plot; project?: Project; stage?: string; onLoadedStage: (stage: Plot['paymentMilestone']) => void;
}) {
  const [saved, setSaved] = useState<RegistrationSlot | null>(null);
  const [policy, setPolicy] = useState<any>(null);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [leads, setLeads] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const request = useRef<{ fingerprint: string; id: string } | null>(null);
  const path = plot.projectId && plot.__recordId
    ? `/erp/${encodeURIComponent(plot.projectId)}/plots/${encodeURIComponent(plot.__recordId)}/registration` : null;
  useEffect(() => {
    let alive = true;
    setSaved(null); setError('');
    if (!path) return;
    api<any>(path).then((result) => {
      if (!alive) return;
      const slot: RegistrationSlot = result.appointment;
      setSaved(slot); setPolicy(result.policy);
      setDate(slot.date || ''); setTime(slot.time || ''); setLocation(slot.location || '');
      setLeads((slot.reminderMinutes || result.policy.defaultReminderMinutes).map(String));
      if (slot.state === 'scheduled') onLoadedStage('Registration Pending');
    }).catch((e) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [path, reloadKey]);
  const visible = stage === 'Registration Pending' || saved?.state === 'scheduled';
  if (!visible) return null;
  const starts = indiaAppointment(date, time);
  const futureLeads = leads.filter((lead) => Number(lead) > 0 && starts - Number(lead) * 60000 > Date.now());
  const save = async (action: 'save' | 'cancel') => {
    if (!path || !saved || busy) return;
    setError(''); setNotice('');
    if (action === 'save') {
      if (!Number.isFinite(starts) || starts <= Date.now()) { setError('Choose a valid future date and time in India.'); return; }
      if (!location.trim() || location.trim().length > policy.maxLocationLength) { setError('Enter the registration location within the displayed limit.'); return; }
      const minutes = leads.map(Number);
      if (minutes.some((n) => !Number.isInteger(n) || n <= 0 || n > policy.maxReminderMinutes) || new Set(minutes).size !== minutes.length) {
        setError(`Enter unique whole reminder minutes between 1 and ${policy.maxReminderMinutes}.`); return;
      }
    }
    const body = { revision: saved.revision, action, date, time, location: location.trim(), reminderMinutes: leads.map(Number) };
    const fingerprint = JSON.stringify(body);
    if (request.current?.fingerprint !== fingerprint) request.current = { fingerprint, id: newRequestId() };
    setBusy(true);
    try {
      const result = await api<any>(path, { method: 'PUT', body: { ...body, requestId: request.current.id } });
      setSaved(result.appointment); request.current = null;
      if (action === 'save') onLoadedStage('Registration Pending');
      setNotice(action === 'save' ? 'Registration slot saved. No payment or receipt was created.' : 'Registration slot cancelled. Pending reminders stopped; payments are unchanged.');
      window.dispatchEvent(new Event('sos-notifications-refresh'));
      window.dispatchEvent(new Event('sos-registration-changed'));
    } catch (e: any) { setError(e.message || 'The slot could not be saved. Retry safely or reload the saved slot.'); }
    finally { setBusy(false); }
  };
  return <section aria-label="Registration appointment" data-testid="registration-appointment"
    onKeyDown={(e) => {
      // Enter in appointment inputs must never implicitly submit the surrounding payment form.
      if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'BUTTON') e.preventDefault();
    }} className="rounded-2xl border border-blue-200 bg-blue-50 p-4 space-y-3">
    <h4 className="font-black text-blue-950">Registration appointment · India time (Asia/Kolkata)</h4>
    <p>{project?.name} · {plot.plotNumber} · {plot.bookingPayments?.buyerName || plot.buyerName || 'Book a customer first'}</p>
    {!plot.bookingPayments && <p className="font-bold">Save the customer booking first, then reopen this form to schedule registration.</p>}
    {saved && saved.state !== 'none' && <p role="status" className="font-bold">Saved slot: {saved.state} · {saved.date} {saved.time} IST · {saved.location}</p>}
    <div className="grid sm:grid-cols-2 gap-3">
      <label className="font-bold">Registration date
        <input aria-label="Registration date" type="date" value={date} onChange={(e) => setDate(e.target.value)}
          className="block w-full mt-1 rounded-lg border border-gray-300 bg-white p-2" />
      </label>
      <label className="font-bold">Registration time (IST)
        <input aria-label="Registration time (IST)" type="time" value={time} onChange={(e) => setTime(e.target.value)}
          className="block w-full mt-1 rounded-lg border border-gray-300 bg-white p-2" />
      </label>
    </div>
    <label className="block font-bold">Registration location (required)
      <input aria-label="Registration location (required)" aria-required="true" value={location} maxLength={policy?.maxLocationLength}
        placeholder="Sub-registrar office / full meeting address" onChange={(e) => setLocation(e.target.value)}
        className="block w-full mt-1 rounded-lg border border-gray-300 bg-white p-2" />
    </label>
    <fieldset className="space-y-2">
      <legend className="font-bold">Reminders — recommended 24 hours and 1 hour before; editable</legend>
      {leads.map((lead, i) => <div key={i} className="flex items-center gap-2">
        <label className="flex items-center gap-2">Minutes before registration
          <input aria-label={`Reminder ${i + 1} minutes before`} type="number" min="1" max={policy?.maxReminderMinutes} value={lead}
            onChange={(e) => setLeads((items) => items.map((v, index) => index === i ? e.target.value : v))}
            className="w-24 rounded-lg border border-gray-300 bg-white p-2" />
        </label>
        <button type="button" onClick={() => setLeads((items) => items.filter((_, index) => index !== i))} className="font-bold underline">Remove</button>
      </div>)}
      <button type="button" disabled={!policy || leads.length >= policy.maxReminders} onClick={() => setLeads((items) => [...items, ''])} className="font-bold underline disabled:opacity-40">Add reminder</button>
    </fieldset>
    {Number.isFinite(starts) && <p role="status">
      Future reminders: {futureLeads.length ? futureLeads.map((lead) => `${lead} minutes before`).join(', ') : 'none'}.
      {futureLeads.length < leads.length && ' Lead times already passed will be skipped, not sent late.'}
    </p>}
    <p className="text-blue-800">Appointment saving does not change the agreed price, customer, payments or plot sale status. Browser push requires enabling alerts in the bell; the bell is always available.</p>
    {error && <p role="alert" className="font-bold text-red-700">{error}</p>}
    {notice && <p role="status" className="font-bold text-emerald-800">{notice}</p>}
    <div className="flex flex-wrap gap-2">
      <button type="button" data-testid="save-registration" disabled={busy || !saved || !plot.bookingPayments || saved.state === 'completed'}
        onClick={() => void save('save')} className="rounded-xl bg-blue-800 text-white font-bold px-4 py-2 disabled:opacity-40">
        {busy ? 'Saving…' : saved?.state === 'scheduled' ? 'Update registration slot only' : 'Save registration slot only'}
      </button>
      {saved?.state === 'scheduled' && <button type="button" data-testid="cancel-registration" disabled={busy}
        onClick={() => { if (confirm('Cancel this registration slot and its remaining reminders? Payments will not change.')) void save('cancel'); }}
        className="rounded-xl border border-red-300 text-red-800 font-bold px-3 py-2">Cancel slot</button>}
      <button type="button" disabled={busy} onClick={() => { request.current = null; setNotice(''); setReloadKey((key) => key + 1); }} className="font-bold underline">Reload saved slot</button>
    </div>
  </section>;
}
