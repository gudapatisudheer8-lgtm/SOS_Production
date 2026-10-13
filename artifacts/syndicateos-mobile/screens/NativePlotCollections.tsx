import React, { useRef, useState } from 'react';
import { Modal, Platform, Share, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { getGetProjectErpQueryKey, type ProjectErp } from '@workspace/api-client-react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { Banner, Btn, Card, Chips, Field, Label } from '@/components/ui';
import { nativeApi } from '@/lib/native-api';
import { newRequestId, useErp, useErpCommands } from '@/lib/erp';
import { useWorkspace } from '@/lib/workspace';
import { errMessage } from '@/lib/session';
import { formatINR } from '@/lib/sourceCalc';
import {
  bookingBusinessDate, createRequestIdKeeper, paymentPosition, plotPaymentSummary,
  receiptAnnotation, receiptForRequest, receiptPrintHtml, receiptText, validatePayment,
  type BookingPaymentReceipt,
} from '@/lib/plot-payments';
import { Dialog, type ErpCtx } from '@/screens/ErpScreens';
import { NativeCalendar, NativeRegistrationSlot } from './NativeRegistrationSlot';

interface Props { erp: ProjectErp; ctx: ErpCtx; initial: string; onClose: () => void }

export function NativePlotCollections({ erp, ctx, initial, onClose }: Props) {
  const liveQuery = useErp(erp.projectId);
  const current = liveQuery.data || erp;
  const plot = current.records.find(r => r.id === initial && r.kind === 'plots');
  const summary = plotPaymentSummary(current, initial);
  const resource = current.resources.find(r => r.kind === 'bookings');
  const canSubmit = !!resource?.canCreate;
  const ws = useWorkspace(true).data;
  const qc = useQueryClient();
  const commands = useErpCommands(erp.projectId);
  const insets = useSafeAreaInsets();
  const [buyer, setBuyer] = useState(summary?.buyerName || String(plot?.data.buyerName || ''));
  const [phone, setPhone] = useState(summary?.buyerPhone || String(plot?.data.buyerPhone || ''));
  const [rate, setRate] = useState(String(summary?.ratePerSqYard || plot?.data.ratePerSqYard || ''));
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(bookingBusinessDate());
  const modes = resource?.fields.find(f => f.key === 'paymentMode')?.options || [];
  const [mode, setMode] = useState(modes[0] || '');
  const accounts = current.records.filter(r => r.kind === 'accounts' && r.status !== 'deleted');
  const [account, setAccount] = useState('');
  const [reference, setReference] = useState('');
  const [terms, setTerms] = useState(String(plot?.data.terms || ''));
  const [stage, setStage] = useState(String(plot?.data.paymentMilestone || 'Token Advance'));
  const [calendar, setCalendar] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [receipt, setReceipt] = useState<BookingPaymentReceipt | null>(null);
  const keeper = useRef(createRequestIdKeeper(newRequestId));
  const attempt = useRef<{ requestId: string; data: Record<string, unknown> } | null>(null);
  const locked = !!summary?.locked;
  const sold = ['sold', 'registered'].includes(String(plot?.data.status));
  const pricingRate = locked ? summary!.ratePerSqYard : Number(rate);
  const position = paymentPosition(summary, Number(plot?.data.areaSqYards || 0), pricingRate, Number(plot?.data.advanceReceived || 0));
  const buyerName = locked ? summary!.buyerName : buyer;
  const buyerPhone = locked ? summary!.buyerPhone : phone;
  const details = (current.projectSetup?.details || ctx.project?.details || {}) as Record<string, unknown>;
  const floor = Number(details.floorRatePerSqYard || 0);
  const reconciliation = summary?.reconciliationRequired ||
    (String(plot?.data.status) === 'reserved' && !summary ? 'The saved booking summary could not be verified. Reload before collecting money.' : '');
  const readOnly = !canSubmit || sold || !!reconciliation || uncertain;
  const receiptContext = {
    firmName: ws?.firms.find(f => f.id === ctx.project?.firmId)?.name || 'SyndicateOS',
    projectName: ctx.project?.name,
    plotNumber: String(plot?.data.plotNumber || ''),
    facing: String(plot?.data.facing || ''),
    lpOrReraNumber: String(details.lpOrReraNumber || ''),
  };

  const refresh = async () => {
    const saved = await nativeApi<ProjectErp>(`/api/erp/${encodeURIComponent(erp.projectId)}`);
    qc.setQueryData(getGetProjectErpQueryKey(erp.projectId), saved);
    return saved;
  };
  const recover = async (requestId: string) => {
    const fresh = await refresh();
    const issued = receiptForRequest(fresh, initial, requestId);
    if (!issued) return false;
    setReceipt(issued);
    setUncertain(false); setAmount(''); setReference('');
    attempt.current = null; keeper.current.reset();
    setNotice(issued.posted ? 'Payment recorded. Balance and receipt are updated.' : 'This payment was recorded and later corrected. Review the saved receipt history.');
    return true;
  };
  const checkSaved = async () => {
    if (!attempt.current) return;
    setBusy(true); setError('');
    try {
      if (!await recover(attempt.current.requestId)) {
        setError('No saved receipt for this request was found yet. Retry the SAME payment; do not enter a new one.');
      }
    } catch (e) { setError(errMessage(e)); }
    finally { setBusy(false); }
  };
  const submit = async () => {
    setError(''); setNotice('');
    let data: Record<string, unknown>;
    let requestId: string;
    if (uncertain && attempt.current) {
      ({ data, requestId } = attempt.current);
    } else {
      if (readOnly) return;
      const valid = validatePayment(amount, position.balance);
      if (!valid.ok) return setError(valid.error);
      if (!buyerName.trim() || !/^[+\d\s-]{7,16}$/.test(buyerPhone.trim())) return setError('Enter the customer name and a valid mobile number.');
      if (!(pricingRate > 0) || !Number.isFinite(pricingRate) || (!locked && pricingRate < floor)) return setError('Enter a valid rate at or above the protected floor rate.');
      if (!account) return setError('Select the exact project bank or cash account that received this payment.');
      if (!mode) return setError('Select a payment mode.');
      if (!/cash/i.test(mode) && !reference.trim()) return setError('Enter the payment reference for a non-cash receipt.');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError('Enter a valid payment date.');
      const candidate: Record<string, unknown> = {
        inventoryId: initial, buyerName: buyerName.trim(), buyerPhone: buyerPhone.trim(),
        ratePerSqYard: pricingRate, advanceReceived: valid.amount, date,
        accountId: account, paymentMode: mode, paymentRefNumber: reference.trim(),
        // Preserve the current stage when the configured field is mandatory;
        // scheduling or advancing it still uses the independent controls.
        paymentMilestone: String(plot?.data.paymentMilestone || 'Token Advance'),
        bookingStatus: String(plot?.data.status || 'reserved') === 'available' ? 'reserved' : String(plot?.data.status || 'reserved'),
        // An appointment is stored through its own endpoint, never this field.
        ...(resource?.fields.some(f => f.key === 'terms') && terms.trim() ? { terms: terms.trim() } : {}),
      };
      const keys = new Set(resource?.fields.map(f => f.key));
      data = Object.fromEntries(Object.entries(candidate).filter(([key]) => keys.has(key)));
      requestId = keeper.current.idFor(JSON.stringify(data));
      attempt.current = { requestId, data };
    }
    setBusy(true);
    try {
      await nativeApi(`/api/commands/erp.save`, { body: { data: { projectId: erp.projectId, kind: 'bookings', requestId, data } } });
      setUncertain(true);
      if (!await recover(requestId)) setError('The server accepted this request, but its receipt is not yet visible. Check the saved receipt before recording anything else.');
    } catch (e) {
      const status = (e as { status?: number }).status;
      if (status && status >= 400 && status < 500 && status !== 408 && status !== 429) {
        setUncertain(false);
        setError(errMessage(e));
      } else {
        setUncertain(true);
        try {
          if (!await recover(requestId)) setError('Payment confirmation is uncertain. Check the saved receipt or retry the same request. Your entered values are locked to prevent duplicate payments.');
        } catch { setError('Payment confirmation is uncertain. Check the saved receipt or retry the same request when the connection is restored.'); }
      }
    } finally { setBusy(false); }
  };
  const saveStage = async () => {
    if (!plot || ctx.account.role !== 'ACCOUNTANT' || busy || uncertain) return;
    setError(''); setBusy(true);
    try {
      await commands.inventoryStage(plot.id, plot.revision, { status: String(plot.data.status), paymentMilestone: stage });
      setNotice('Agreement stage updated. No payment was recorded.');
    } catch (e) { setError(errMessage(e)); }
    finally { setBusy(false); }
  };
  const shareReceipt = async (pdf: boolean) => {
    if (!receipt) return;
    setError('');
    try {
      if (!pdf) await Share.share({ title: receipt.receiptNumber, message: receiptText(receipt, receiptContext) });
      else {
        const html = receiptPrintHtml(receipt, receiptContext);
        if (Platform.OS === 'web') await Print.printAsync({ html });
        else {
          const file = await Print.printToFileAsync({ html });
          if (!await Sharing.isAvailableAsync()) throw new Error('Sharing is unavailable on this device.');
          await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', dialogTitle: receipt.receiptNumber });
        }
      }
    } catch (e) { setError(errMessage(e)); }
  };
  const stageOptions = resource?.fields.find(f => f.key === 'paymentMilestone')?.options || [];
  if (!plot) return <Dialog title="Plot unavailable" onClose={onClose}><Text>This plot is no longer available in the selected project.</Text></Dialog>;
  const after = amount.trim() && validatePayment(amount, position.balance).ok
    ? Math.max(0, (Math.round(position.balance * 100) - Math.round(Number(amount.replace(/,/g, '')) * 100)) / 100) : position.balance;

  return <Modal visible transparent animationType="slide" onRequestClose={() => { if (!busy && !uncertain) onClose(); }}>
    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,.55)', justifyContent: 'center', paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8, paddingHorizontal: 10 }}>
      <View style={{ backgroundColor: '#fff', borderRadius: 22, width: '100%', maxWidth: 620, alignSelf: 'center', maxHeight: '98%', overflow: 'hidden' }}>
        <View style={{ backgroundColor: '#101827', padding: 18 }}>
          <Text style={{ color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 17 }}>{String(plot.data.plotNumber)} · {locked ? 'Customer Plot Collections' : 'Fast Customer Booking'}</Text>
          <Text style={{ color: '#cbd5e1', fontSize: 12, marginTop: 4 }}>{ctx.project?.name} · {summary?.areaSqYards || String(plot.data.areaSqYards)} Sq.Yds · {String(plot.data.facing || '')}</Text>
          <Text style={{ color: '#d8b4fe', fontSize: 11, marginTop: 5 }}>{plot.data.registrationState === 'scheduled' ? 'Slot booked for registration' : sold ? 'Sold / registered' : locked ? 'Reserved · agreed pricing locked' : 'Available'}</Text>
        </View>
        <KeyboardAwareScrollViewCompat keyboardShouldPersistTaps="handled" bottomOffset={24} style={{ flexShrink: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
          {!!error && <Banner tone="error" title="Please check" text={error} />}
          {!!notice && <Banner tone="ok" title={notice} />}
          {!!reconciliation && <Banner tone="warn" title="Booking reconciliation required" text={reconciliation} />}
          <Card>
            <Label>CUSTOMER & PURCHASER DETAILS</Label>
            <Field label="Customer / buyer full name" value={buyerName} onChangeText={setBuyer} editable={!locked && !readOnly && !busy} />
            <Field label="Customer mobile phone" value={buyerPhone} onChangeText={setPhone} keyboardType="phone-pad" editable={!locked && !readOnly && !busy} />
          </Card>
          <Card style={{ borderColor: '#fde68a', backgroundColor: '#fffdf5' }}>
            <Label>AGREED PRICING & COLLECTIONS</Label>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 14 }}>
              {[['Total value', position.totalValue], ['Collected to date', position.collected], ['Balance due', position.balance]].map(([label, value]) =>
                <View key={String(label)} style={{ flexGrow: 1 }}><Text style={{ fontSize: 11, color: '#6b7280' }}>{label}</Text><Text style={{ fontFamily: 'Inter_700Bold', fontSize: 17, color: '#111827' }}>{formatINR(Number(value))}</Text></View>)}
            </View>
            <Field label={`Rate per Sq.Yard${locked ? ' · LOCKED' : floor ? ` · floor ${formatINR(floor)}` : ''}`} value={locked ? String(summary!.ratePerSqYard) : rate} onChangeText={setRate} keyboardType="numeric" editable={!locked && !readOnly && !busy} />
            {!sold && <><Field label="Amount received in THIS payment" value={amount} onChangeText={setAmount} keyboardType="numeric" editable={!readOnly && !busy} placeholder="Enter next instalment, not the total collected" />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                {[50000, 100000, 200000, 500000].filter(n => n <= position.balance).map(n =>
                  <Btn key={n} label={formatINR(n)} variant="ghost" disabled={readOnly || busy} onPress={() => setAmount(String(n))} />)}
                <Btn label={`Full balance ${formatINR(position.balance)}`} variant="ghost" disabled={readOnly || busy || !position.balance} onPress={() => setAmount(String(position.balance))} />
              </View>
              <Field label="Payment date" value={date} onChangeText={setDate} hint="YYYY-MM-DD · India business date" editable={!readOnly && !busy} />
              <Btn label={calendar ? 'Hide calendar' : 'Choose payment date'} variant="ghost" disabled={readOnly || busy} onPress={() => setCalendar(x => !x)} />
              {calendar && !readOnly && <NativeCalendar value={date} onChange={setDate} />}
              <Chips label="Payment mode" options={modes.map(value => ({ value, label: value }))} value={mode} onChange={value => { if (!busy && !readOnly) setMode(value); }} />
              <Field label="Cheque / UTR / reference" value={reference} onChangeText={setReference} editable={!readOnly && !busy} />
              <Chips label="Deposit bank / project ledger account" options={accounts.map(a => ({
                value: a.id, label: `${String(a.data.name || a.data.bankName || 'Account')} · ${formatINR(Number(current.balances.find(b => b.accountId === a.id)?.balance || 0))}`,
              }))} value={account} onChange={value => { if (!busy && !readOnly) setAccount(value); }} />
              <Text style={{ color: '#166534', fontFamily: 'Inter_600SemiBold', marginVertical: 10 }}>Outstanding after this payment: {formatINR(after)}</Text>
            </>}
          </Card>
          {locked && <Card>
            <Label>PAYMENT HISTORY & SAVED RECEIPTS</Label>
            {!summary?.receipts.length && <Text>No customer receipts are available.</Text>}
            {summary?.receipts.slice().reverse().map(r => <View key={r.id} style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
              <Text style={{ fontFamily: 'Inter_700Bold' }}>{r.date} · {formatINR(r.amount)}</Text>
              <Text style={{ fontSize: 11, color: '#6b7280', marginVertical: 4 }}>{r.receiptNumber}</Text>
              <Text style={{ fontSize: 12 }}>{r.paymentMode} · {r.accountName} · Balance {formatINR(r.balanceAfter)}</Text>
              {!!receiptAnnotation(r) && <Text style={{ fontSize: 11, color: '#b45309' }}>{receiptAnnotation(r)}</Text>}
              <Btn label="View receipt" variant="ghost" onPress={() => setReceipt(r)} />
            </View>)}
          </Card>}
          {stageOptions.length > 0 && locked && <Card>
            <Chips label="Agreement stage" options={stageOptions.map(value => ({
              value, label: value === 'Registration Pending' ? 'Registration Slot Booked' : value,
            }))} value={stage} onChange={value => { if (!busy && !uncertain) setStage(value); }} />
            {ctx.account.role === 'ACCOUNTANT' && stage !== 'Registration Pending' &&
              <Btn label="Save agreement stage only" variant="ghost" disabled={busy || uncertain} onPress={() => void saveStage()} />}
          </Card>}
          {locked && (stage === 'Registration Pending' || plot.data.registrationState === 'scheduled') &&
            <NativeRegistrationSlot projectId={erp.projectId} inventoryId={initial} readOnly={!canSubmit || sold || uncertain} />}
          {!locked && stage === 'Registration Pending' && <Text>Record the first customer payment before scheduling registration.</Text>}
          <Field label="Agreement terms / field notes" value={terms} onChangeText={setTerms} multiline editable={!readOnly && !busy} />
          {uncertain && <Btn label="Check saved receipt" loading={busy} onPress={() => void checkSaved()} />}
        </KeyboardAwareScrollViewCompat>
        <View style={{ padding: 14, flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 10, borderTopWidth: 1, borderTopColor: '#e5e7eb', backgroundColor: '#fafafa' }}>
          <Btn label="Close" variant="ghost" disabled={busy || uncertain} onPress={onClose} />
          {!sold && canSubmit && !reconciliation && <Btn label={uncertain ? 'Retry SAME payment' : locked ? 'Record this payment' : 'Book plot & record payment'} loading={busy} disabled={!uncertain && position.balance <= 0} onPress={() => void submit()} />}
        </View>
      </View>
    </View>
    {receipt && <Dialog title={`Saved receipt · ${receipt.receiptNumber}`} onClose={() => setReceipt(null)}>
      {!!error && <Banner tone="error" title="Receipt action failed" text={error} />}
      <Text style={{ fontFamily: 'Inter_700Bold', marginBottom: 12 }}>{receiptContext.firmName} · {receiptContext.projectName} · Plot {receiptContext.plotNumber}</Text>
      {[
        ['Customer', `${receipt.buyerName} · ${receipt.buyerPhone}`],
        ['Payment date', receipt.date], ['Area', `${receipt.areaSqYards} Sq.Yds`],
        ['Agreed rate', formatINR(receipt.ratePerSqYard)], ['Total value', formatINR(receipt.totalValue)],
        ['Paid previously', formatINR(receipt.previousCollected)], ['This payment', formatINR(receipt.amount)],
        ['Total paid at receipt', formatINR(receipt.totalCollected)], ['Balance after receipt', formatINR(receipt.balanceAfter)],
        ['Payment mode', receipt.paymentMode], ['Reference', receipt.paymentRefNumber || '—'],
        ['Received into', receipt.accountName], ['Recorded by', receipt.recordedBy],
      ].map(([label, value]) => <View key={label} style={{ flexDirection: 'row', gap: 12, justifyContent: 'space-between', paddingVertical: 7 }}><Text style={{ color: '#6b7280', flex: 1 }}>{label}</Text><Text selectable style={{ fontFamily: 'Inter_600SemiBold', flex: 1, textAlign: 'right' }}>{value}</Text></View>)}
      {!!receiptAnnotation(receipt) && <Banner tone="warn" title="Historical receipt" text={receiptAnnotation(receipt)!} />}
      <Btn label="Share customer receipt" disabled={!receipt.posted} onPress={() => void shareReceipt(false)} />
      <Btn label={Platform.OS === 'web' ? 'Print receipt' : 'Share receipt PDF'} variant="ghost" disabled={!receipt.posted} onPress={() => void shareReceipt(true)} />
    </Dialog>}
  </Modal>;
}
