import { erpSetup } from '@/lib/erpSetup';
import React, { useState } from 'react';
import { Linking, Text, View } from 'react-native';
import type { ErpRecord, ProjectErp } from '@workspace/api-client-react';
import { Badge, Banner, Btn, Chips, Field, Label } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { useErpCommands } from '@/lib/erp';
import { errMessage } from '@/lib/session';
import { formatINR } from '@/lib/sourceCalc';
import { label, live, recLabel, str, tone, type ErpCtx } from '@/screens/ErpScreens';

const nv = (x: unknown) => { const n = Number(x); return Number.isFinite(n) ? n : 0; };
/** Source ConstructionModule milestone ladder (cumulative completion). Token Advance precedes construction. */
export const milestonesOf = (erp: ProjectErp) => erpSetup(erp).milestones;
export const stagePct = (erp: ProjectErp, m: string): number | null => milestonesOf(erp)?.find((x) => x.name === m)?.done ?? null;
export const RECEIPT_CATEGORY = { plots: 'plot_booking_advance', units: 'flat_booking_advance' } as const;

export function waLink(text: string, phone?: string): string {
  const t = encodeURIComponent(text);
  const d = (phone ?? '').replace(/\D/g, '');
  if (d.length >= 10) return `https://wa.me/${d.length === 10 ? '91' + d : d}?text=${t}`;
  return `https://api.whatsapp.com/send?text=${t}`;
}
/** Only ever called from an explicit button press. Nothing is sent in the background. */
export const openWa = (text: string, phone?: string) => { void Linking.openURL(waLink(text, phone)); };

export function InventoryStage({ erp, rec, ctx }: { erp: ProjectErp; rec: ErpRecord; ctx: ErpCtx }) {
  const c = useColors();
  const cmd = useErpCommands(erp.projectId);
  const isPlot = rec.kind === 'plots';
  const status = str(rec.data.status);
  const accountant = ctx.account.role === 'ACCOUNTANT';
  const bookings = erp.records.filter((r) => r.kind === 'bookings' && live(r) && r.data.inventoryId === rec.id);
  const approved = bookings.find((b) => b.status === 'approved');
  const pend = bookings.find((b) => b.status === 'pending');
  const [ms, setMs] = useState(str(rec.data.paymentMilestone || rec.data.currentMilestone));
  const [doc, setDoc] = useState(str(rec.data.officialDocValue));
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const nextStatus = isPlot ? (status === 'reserved' ? 'sold' : null) : status === 'booked' ? 'registered' : null;
  const go = async (p: { status: string; paymentMilestone?: string; currentMilestone?: string }) => {
    if (doc.trim() !== '' && !(Number(doc) >= 0)) { setMsg({ ok: false, t: 'Official document value must be a number.' }); return; }
    setBusy(true); setMsg(null);
    try { await cmd.inventoryStage(rec.id, rec.revision, { ...p, ...(doc.trim() !== '' ? { officialDocValue: Number(doc) } : {}) }); setMsg({ ok: true, t: 'Updated.' }); }
    catch (e) { setMsg({ ok: false, t: errMessage(e) }); } finally { setBusy(false); }
  };
  return (
    <View style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderColor: c.border }}>
      <Label>{isPlot ? 'PLOT LIFECYCLE' : 'APARTMENT LIFECYCLE'}</Label>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 6 }}><Badge text={status || 'unset'} tone={tone(status)} />{approved ? <Badge text="approved booking" tone="ok" /> : pend ? <Badge text="booking pending review" tone="warn" /> : <Badge text="no booking" tone="muted" />}</View>
      {!isPlot ? <Text style={{ color: c.mutedForeground, fontSize: 12, marginBottom: 6 }}>Milestone: {str(rec.data.currentMilestone || rec.data.milestoneStage) || 'not set'}{str(rec.data.paymentMilestone) ? ` · payment milestone ${str(rec.data.paymentMilestone)}` : ''}</Text> : null}
      {!accountant ? <Text style={{ color: c.mutedForeground, fontSize: 12 }}>Stage changes are made by the accountant. This view is read-only for partners.</Text> : (
        <View>
          {!isPlot && !milestonesOf(erp) ? <Banner tone="warn" title="Milestone rules are not configured" text="This project's release defines no construction milestones, so stage updates are unavailable." /> : null}{!isPlot && milestonesOf(erp) ? <Chips label="Construction milestone" options={(milestonesOf(erp) ?? []).map((m) => ({ value: m.name, label: `${m.name}${m.call ? ` (${m.call}%)` : ''}` }))} value={ms} onChange={setMs} /> : null}
          <Field label="Official registration document value (Rs, optional)" value={doc} onChangeText={setDoc} keyboardType="numeric" />
          {!isPlot && status && status !== 'available' ? <Btn label="Update milestone" variant="ghost" loading={busy} disabled={!ms} onPress={() => void go({ status, currentMilestone: ms })} /> : null}
          <View style={{ height: 6 }} />
          {nextStatus ? (
            <View>
              {!approved ? <Banner tone="warn" title="Approved booking required" text={`${isPlot ? 'Selling' : 'Registering'} needs an approved booking for this ${isPlot ? 'plot' : 'unit'}.`} /> : null}
              <Btn label={isPlot ? 'Mark plot sold' : 'Mark apartment registered'} loading={busy} disabled={!approved || (!isPlot && !ms)} onPress={() => void go({ status: nextStatus, ...(ms ? { paymentMilestone: ms } : {}) })} />
              {!isPlot && !ms ? <Text style={{ color: c.mutedForeground, fontSize: 12 }}>Choose the registration milestone first.</Text> : null}
            </View>
          ) : <Text style={{ color: c.mutedForeground, fontSize: 12 }}>{isPlot ? 'Reserved plots with an approved booking can be marked sold.' : 'Booked units with an approved booking can be registered.'}</Text>}
          {msg ? <Banner tone={msg.ok ? 'ok' : 'error'} title={msg.t} /> : null}
        </View>
      )}
    </View>
  );
}

/** Approved receipt history for a booking plus a new ledger credit. Link field `bookingId` is assumed and listed as a backend need. */
export function BookingReceipts({ erp, booking, ctx }: { erp: ProjectErp; booking: ErpRecord; ctx: ErpCtx }) {
  const c = useColors();
  const cmd = useErpCommands(erp.projectId);
  const inv = erp.records.find((r) => r.id === booking.data.inventoryId);
  const cat = inv?.kind === 'units' ? RECEIPT_CATEGORY.units : RECEIPT_CATEGORY.plots;
  const tres = erp.resources.find((r) => r.kind === 'transactions');
  const cats: string[] = [RECEIPT_CATEGORY.plots, RECEIPT_CATEGORY.units];
  const all = erp.records.filter((r) => r.kind === 'transactions' && live(r) && r.data.bookingId === booking.id && cats.includes(str(r.data.category)));
  const ok = all.filter((r) => r.status === 'approved');
  const total = ok.reduce((n, r) => n + nv(r.data.amount), 0);
  const accts = erp.records.filter((r) => r.kind === 'accounts' && live(r));
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ amount: '', accountId: '', date: new Date().toISOString().slice(0, 10), paymentMode: 'Cash', ref: '', note: '' });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof v) => (x: string) => setV((o) => ({ ...o, [k]: x }));
  const submit = async () => {
    if (!(Number(v.amount) > 0)) return setErr('Amount must be greater than zero.');
    if (!v.accountId) return setErr('Choose the bank or cash account that received it.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v.date)) return setErr('Date must be YYYY-MM-DD.');
    if (v.paymentMode !== 'Cash' && !v.ref.trim()) return setErr('Reference number is required for non-cash receipts.');
    setBusy(true); setErr(null);
    try {
      await cmd.save('transactions', { type: 'credit', category: cat, amount: Number(v.amount), accountId: v.accountId, date: v.date, bookingId: booking.id, paymentMode: v.paymentMode, ...(v.ref.trim() ? { paymentRefNumber: v.ref.trim() } : {}), ...(v.note.trim() ? { description: v.note.trim() } : {}) });
      setOpen(false); setV((o) => ({ ...o, amount: '', ref: '', note: '' }));
    } catch (e) { setErr(errMessage(e)); } finally { setBusy(false); }
  };
  const share = () => openWa(`Receipt summary for ${str(booking.data.buyerName)}${inv ? `, ${inv.kind === 'plots' ? 'Plot' : 'Flat'} ${label(inv)}` : ''}\nBooking advance: ${formatINR(nv(booking.data.advanceReceived))}\nApproved receipts: ${ok.length}, total ${formatINR(total)}.`, str(booking.data.buyerPhone));
  return (
    <View style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderColor: c.border }}>
      <Label>APPROVED RECEIPT HISTORY</Label>
      <Text style={{ color: c.foreground, fontFamily: 'Inter_700Bold' }}>{formatINR(total)} <Text style={{ color: c.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 12 }}>across {ok.length} approved receipt(s) · booking advance {formatINR(nv(booking.data.advanceReceived))}</Text></Text>
      {all.length === 0 ? <Text style={{ color: c.mutedForeground, fontSize: 12, marginTop: 4 }}>No receipts recorded against this booking.</Text> : all.map((r) => <View key={r.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}><Text style={{ color: c.foreground, fontSize: 13, flex: 1 }}>{str(r.data.date)} · {recLabel(erp.records, r.data.accountId)} · {str(r.data.paymentMode)}</Text><View style={{ flexDirection: 'row', gap: 6 }}><Text style={{ color: c.foreground }}>{formatINR(nv(r.data.amount))}</Text><Badge text={r.status} tone={tone(r.status)} /></View></View>)}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        {tres?.canCreate ? <Btn label={open ? 'Cancel receipt' : 'Record receipt'} variant="ghost" icon="plus" onPress={() => setOpen(!open)} /> : null}
        <Btn label="Share via WhatsApp" variant="ghost" icon="send" onPress={share} />
      </View>
      {open ? (
        <View style={{ marginTop: 8 }}>
          <Field label="Amount received (Rs)" value={v.amount} onChangeText={set('amount')} keyboardType="numeric" />
          <Chips label="Received into" options={accts.map((a) => ({ value: a.id, label: label(a) }))} value={v.accountId} onChange={set('accountId')} />
          <Chips label="Payment mode" options={['Cash', 'Cheque', 'RTGS / NEFT', 'UPI'].map((m) => ({ value: m, label: m }))} value={v.paymentMode} onChange={set('paymentMode')} />
          <Field label="Reference number" value={v.ref} onChangeText={set('ref')} />
          <Field label="Date" value={v.date} onChangeText={set('date')} hint="YYYY-MM-DD" />
          <Field label="Note" value={v.note} onChangeText={set('note')} />
          {err ? <Banner tone="error" title={err} /> : null}
          <Banner tone="warn" title={`Saved as credit, ${cat}, pending review`} />
          <Btn label="Submit receipt" loading={busy} onPress={submit} />
        </View>
      ) : null}
    </View>
  );
}
