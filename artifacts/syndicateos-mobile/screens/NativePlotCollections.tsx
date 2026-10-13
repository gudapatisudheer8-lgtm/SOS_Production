import React, { useRef, useState } from 'react';
import { Modal, Platform, Pressable, Share, Text, View, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { getGetProjectErpQueryKey, type ProjectErp } from '@workspace/api-client-react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { Banner, Btn, Card, Field, Label, Select } from '@/components/ui';
import { nativeApi } from '@/lib/native-api';
import { newRequestId, useErp, useErpCommands } from '@/lib/erp';
import { useWorkspace } from '@/lib/workspace';
import { errMessage } from '@/lib/session';
import { formatINR } from '@/lib/sourceCalc';
import {
  accountForModeChange, balanceAfter, bookingBusinessDate, createRequestIdKeeper, defaultDepositAccount, isDefinitivePaymentRejection, quickTokens, validatePaymentDate,
  paymentPosition, plotPaymentSummary,
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
  const details = (current.projectSetup?.details || ctx.project?.details || {}) as Record<string, unknown>;
  const layoutSettings = (current.settings?.layoutCalculation || {}) as Record<string, unknown>;
  const floor = Number(details.floorRatePerSqYard ?? layoutSettings.floorRatePerSqYard ?? 0);
  const [buyer, setBuyer] = useState(summary?.buyerName || String(plot?.data.buyerName || ''));
  const [phone, setPhone] = useState(summary?.buyerPhone || String(plot?.data.buyerPhone || ''));
  const [rate, setRate] = useState(String(summary?.ratePerSqYard || plot?.data.ratePerSqYard || plot?.data.blockedRate || floor || ''));
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(bookingBusinessDate());
  const modes = resource?.fields.find(f => f.key === 'paymentMode')?.options || [];
  const savedMode = String(plot?.data.paymentMode || '');
  const [mode, setMode] = useState(modes.includes(savedMode) ? savedMode : '');
  // Active project accounts only (record posted/active and not frozen or closed), as on the web.
  const accounts = current.records.filter(r => r.kind === 'accounts' && r.status === 'approved' && !['frozen', 'closed'].includes(String(r.data.status || '')));
  const deposit = accounts.map(a => ({ id: a.id, accountType: String(a.data.accountType || ''), isPrimary: !!a.data.isPrimary }));
  const [account, setAccount] = useState(() => defaultDepositAccount(deposit, savedMode, String(plot?.data.bookingAccountId || '')));
  const [reference, setReference] = useState('');
  const notesKey = resource?.fields.some(f => f.key === 'terms') ? 'terms' : resource?.fields.some(f => f.key === 'notes') ? 'notes' : '';
  const [terms, setTerms] = useState(String(plot?.data.terms || plot?.data.notes || ''));
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
  const isFirstBooking = !summary && ['available', 'blocked', ''].includes(String(plot?.data.status || ''));
  const { width } = useWindowDimensions();
  const wide = width >= 560;
  const sold = ['sold', 'registered'].includes(String(plot?.data.status));
  const pricingRate = locked ? summary!.ratePerSqYard : Number(rate);
  const position = paymentPosition(summary, Number(plot?.data.areaSqYards || 0), pricingRate, isFirstBooking ? 0 : Number(plot?.data.advanceReceived || 0));
  const buyerName = locked ? summary!.buyerName : buyer;
  const buyerPhone = locked ? summary!.buyerPhone : phone;
  const reconciliation = summary?.reconciliationRequired ||
    (!isFirstBooking && !summary ? 'Saved booking payments could not be verified. Refresh and reopen this plot before collecting money.' : '');
  const pendingUnposted = !!plot?.data.pendingBookingId;
  const readOnly = !canSubmit || sold || !!reconciliation || uncertain || pendingUnposted;
  const fullyPaid = !reconciliation && Math.round(position.balance * 100) <= 0 && Math.round(position.totalValue * 100) > 0;
  const amountCheck = validatePayment(amount, position.balance);
  const belowFloor = !locked && Number(rate) < floor;
  const stageField = resource?.fields.find(f => f.key === 'paymentMilestone');
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
      if (!accounts.some(a => a.id === account)) return setError('Select an active project bank or cash account that received this payment.');
      if (!modes.includes(mode)) return setError('Select a configured payment mode.');
      const dateError = validatePaymentDate(date, bookingBusinessDate());
      if (dateError) return setError(dateError);
      const candidate: Record<string, unknown> = {
        inventoryId: initial, buyerName: buyerName.trim(), buyerPhone: buyerPhone.trim(),
        ratePerSqYard: pricingRate, advanceReceived: valid.amount, date,
        accountId: account, paymentMode: mode, paymentRefNumber: reference.trim(),
        // The selected configured stage is persisted with the payment; appointments use their own endpoint.
        paymentMilestone: stageField?.options?.includes(stage) ? stage : String(plot?.data.paymentMilestone || 'Token Advance'),
        bookingStatus: isFirstBooking ? 'reserved' : String(plot?.data.status || 'reserved'),
        // An appointment is stored through its own endpoint, never this field.
        ...(notesKey && terms.trim() ? { [notesKey]: terms.trim() } : {}),
      };
      const keys = new Set(resource?.fields.map(f => f.key));
      data = Object.fromEntries(Object.entries(candidate).filter(([key]) => keys.has(key)));
      requestId = keeper.current.idFor(JSON.stringify(data));
      attempt.current = { requestId, data };
    }
    const previouslyUncertain = uncertain;
    let writeAccepted = false;
    setBusy(true);
    try {
      await nativeApi(`/api/commands/erp.save`, { body: { data: { projectId: erp.projectId, kind: 'bookings', requestId, data } } });
      writeAccepted = true;
      setUncertain(true);
      if (!await recover(requestId)) setError('The server accepted this request, but its receipt is not yet visible. Check the saved receipt before recording anything else.');
    } catch (e) {
      const status = (e as { status?: number }).status;
      if (isDefinitivePaymentRejection(status, writeAccepted, previouslyUncertain)) {
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
  if (!plot) return <Dialog title="Plot unavailable" onClose={onClose}><Text>This plot is no longer available in the selected project.</Text></Dialog>;
  const balanceAfterEntry = balanceAfter(position.balance, amountCheck.ok, amount);
  const statusLabel = String(plot.data.status || 'available');
  const sqyd = Number(summary?.areaSqYards || plot.data.areaSqYards || 0);
  const dims = String(plot.data.dimensions || '').trim();
  const road = Number(plot.data.roadWidthFt || 0) > 0 ? String(plot.data.roadWidthFt) + ' Ft road' : Number(details.roadWidth || details.approachRoadWidthFt || 0) > 0 ? String(details.roadWidth || details.approachRoadWidthFt) + ' Ft main road' : 'Not recorded';
  const selectedAccount = accounts.find(a => a.id === account);
  const accountLabel = (a: typeof accounts[number]) => {
    const no = String(a.data.accountNumber || '');
    return [String(a.data.bankName || ''), String(a.data.accountName || a.data.name || 'Account')].filter(Boolean).join(' - ') + (no ? ' (•••• ' + no.slice(-4) + ')' : '') + ' | Balance: ' + formatINR(Number(current.balances.find(b => b.accountId === a.id)?.balance || 0));
  };
  const stageLabel = (v: string) => v === 'Registration Pending' ? 'Registration Slot Booked' : v;
  const row = (children: React.ReactNode) => <View style={{ flexDirection: wide ? 'row' : 'column', gap: wide ? 10 : 0 }}>{children}</View>;
  const col = (children: React.ReactNode) => <View style={{ flex: wide ? 1 : undefined, minWidth: 0 }}>{children}</View>;
  const closeLocked = busy || uncertain;
  const submitLabel = busy ? 'Saving payment...' : uncertain ? 'Retry SAME payment' : Math.round(position.balance * 100) <= 0 ? 'Nothing outstanding' : isFirstBooking ? 'Confirm Booking & Record Payment' : 'Record This Payment';

  return <Modal visible transparent animationType="slide" onRequestClose={() => { if (!closeLocked) onClose(); }}>
    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,.6)', justifyContent: 'center', paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8, paddingHorizontal: 8 }}>
      <View style={{ backgroundColor: '#fff', borderRadius: 22, width: '100%', maxWidth: 680, alignSelf: 'center', maxHeight: '98%', overflow: 'hidden' }}>
        <View style={{ backgroundColor: '#0f172a', padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: '#fbbf24', alignItems: 'center', justifyContent: 'center' }}>
            <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: 'Inter_900Black', fontSize: 13, color: '#0f172a' }}>#{String(plot.data.plotNumber || '').replace(/^Plot\s*#?/i, '')}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
              <Text style={{ color: '#fff', fontFamily: 'Inter_900Black', fontSize: 15 }}>{String(plot.data.plotNumber)} - {isFirstBooking ? 'Fast Customer Booking' : 'Customer Plot Collections'}</Text>
              <Text testID="booking-status-pill" style={{ fontSize: 10, fontFamily: 'Inter_900Black', textTransform: 'uppercase', color: statusLabel === 'available' ? '#6ee7b7' : statusLabel === 'reserved' || statusLabel === 'blocked' ? '#fcd34d' : '#fca5a5', borderWidth: 1, borderColor: 'rgba(252,211,77,.35)', borderRadius: 99, paddingHorizontal: 7, paddingVertical: 1 }}>{receipt ? 'Payment saved' : statusLabel}</Text>
            </View>
            <Text style={{ color: '#94a3b8', fontSize: 11, marginTop: 2 }}>{ctx.project?.name} • {sqyd} Sq. Yards ({Math.round(sqyd * 9 * 100) / 100} Sq.Ft){plot.data.registrationState === 'scheduled' ? ' • Registration slot booked' : ''}</Text>
          </View>
          <Pressable testID="booking-close" accessibilityRole="button" accessibilityLabel="Close plot booking form" disabled={closeLocked} onPress={onClose} hitSlop={8} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: closeLocked ? 0.4 : 1 }}>
            <Feather name="x" size={20} color="#cbd5e1" />
          </Pressable>
        </View>
        <KeyboardAwareScrollViewCompat keyboardShouldPersistTaps="handled" bottomOffset={24} style={{ flexShrink: 1 }} contentContainerStyle={{ padding: wide ? 18 : 12, paddingBottom: 20, gap: 12 }}>
          <View testID="plot-spec" style={{ backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 16, padding: 12, flexDirection: 'row', flexWrap: 'wrap', rowGap: 10 }}>
            {[['Directional facing', String(plot.data.facing || 'Not recorded')], ['Plot extent', sqyd + ' Sq.Yds (' + Math.round(sqyd * 9 * 100) / 100 + ' Sft)'], ['Dimensions', dims || 'Not recorded'], ['Road approach', road]].map(([l, v]) =>
              <View key={l} style={{ width: wide ? '25%' : '50%', paddingRight: 8 }}><Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: '#6b7280', textTransform: 'uppercase' }}>{l}</Text><Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: '#111827', marginTop: 2 }}>{v}</Text></View>)}
          </View>
          {!isFirstBooking && <View testID="panel-payment-position">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {([['Agreed total', position.totalValue, '#e2e8f0', '#fff', '#0f172a'], ['Collected', position.collected, '#a7f3d0', '#ecfdf5', '#064e3b'], ['Outstanding', position.balance, '#bfdbfe', '#eff6ff', '#172554']] as const).map(([l, v, bc, bg, fg]) =>
                <View key={l} style={{ flexGrow: 1, flexBasis: wide ? '30%' : '46%', minWidth: 0, borderWidth: 1, borderColor: bc, backgroundColor: bg, borderRadius: 14, padding: 9 }}><Text style={{ fontSize: 9, fontFamily: 'Inter_700Bold', color: fg, textTransform: 'uppercase' }}>{l}</Text><Text style={{ fontFamily: 'Inter_900Black', fontSize: 14, color: fg }}>{formatINR(Number(v))}</Text></View>)}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
              {locked && <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: '#1e293b', backgroundColor: '#f1f5f9', borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 }}>Agreed price locked at {formatINR(summary!.ratePerSqYard)}/Sq.Yd</Text>}
              {fullyPaid && <Text testID="status-fully-paid" style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: '#064e3b', backgroundColor: '#d1fae5', borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 }}>Fully paid - plot status remains {statusLabel}; mark sold/registered separately</Text>}
            </View>
          </View>}
          {!!error && <Banner tone="error" title="Please check" text={error} />}
          {!!notice && <Banner tone="ok" title={notice} />}
          {!!reconciliation && <Banner tone="warn" title="Booking reconciliation required" text={reconciliation} />}
          {pendingUnposted && <Banner tone="warn" title="Historical unposted receipt" text={'This ' + formatINR(Number(plot.data.advanceReceived || 0)) + ' receipt was saved before entries posted automatically and is not in the books. Its author can Correct & Resubmit it from Project Statements.'} />}
          {(summary?.receipts.length || 0) > 0 && <Card>
            <Label>PAYMENT HISTORY ({summary!.receipts.length})</Label>
            {summary!.receipts.map(r => { const note = receiptAnnotation(r); return <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 12 }}>{r.receiptNumber} <Text style={{ fontFamily: 'Inter_400Regular', color: '#6b7280' }}>{r.date} | {r.paymentMode}</Text></Text>
                <Text style={{ fontSize: 11, color: '#6b7280' }}>Paid to date {formatINR(r.totalCollected)} | Remaining {formatINR(r.balanceAfter)}</Text>
                {note ? <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: '#be123c', textTransform: 'uppercase' }}>{r.state}</Text> : null}
              </View>
              <Text style={{ fontFamily: 'Inter_900Black', color: note && r.state !== 'recorded' ? '#9ca3af' : '#065f46', textDecorationLine: note && r.state !== 'recorded' ? 'line-through' : 'none' }}>{formatINR(r.amount)}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={'View receipt ' + r.receiptNumber} onPress={() => setReceipt(r)} style={{ minHeight: 40, paddingHorizontal: 10, justifyContent: 'center', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10 }}><Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11 }}>View</Text></Pressable>
            </View>; })}
          </Card>}
          <Card>
            <Label>CUSTOMER & PURCHASER DETAILS</Label>
            {row(<>{col(<Field label="Customer / buyer full name *" value={buyerName} onChangeText={setBuyer} placeholder="e.g. M. Srinivasulu Naidu" editable={!locked && !readOnly && !busy} />)}
              {col(<Field label="Customer WhatsApp / mobile phone *" value={buyerPhone} onChangeText={setPhone} placeholder="e.g. 98480 12345" keyboardType="phone-pad" editable={!locked && !readOnly && !busy} />)}</>)}
          </Card>
          <Card style={{ borderColor: '#fde68a', backgroundColor: '#fffdf5' }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 6, marginBottom: 8 }}>
              <Label>{isFirstBooking ? 'PRICING & SPOT TOKEN ADVANCE' : 'RECORD NEXT PAYMENT'}</Label>
              <Text style={{ fontFamily: 'Inter_900Black', fontSize: 12, color: '#111827' }}>Total Value: {formatINR(position.totalValue)}</Text>
            </View>
            {row(<>{col(<Field label={'Agreed rate per Sq.Yard ' + (locked ? '(locked)' : '(Floor: ' + formatINR(floor) + ')')} value={locked ? String(summary!.ratePerSqYard) : rate} onChangeText={setRate} keyboardType="numeric" editable={!locked && !readOnly && !busy} error={belowFloor ? 'Below syndicate floor rate (' + formatINR(floor) + ').' : null} />)}
              {col(<View>
                <Field testID="input-payment-amount" label="Amount received THIS payment (Rs.)" value={amount} onChangeText={v => { setAmount(v); setError(''); }} keyboardType="numeric" placeholder={fullyPaid ? 'Nothing outstanding' : 'Enter amount'} editable={!readOnly && !busy && Math.round(position.balance * 100) > 0} error={amount.trim() && !amountCheck.ok ? amountCheck.error : null} />
                <Text testID="text-max-payable" style={{ fontSize: 11, color: '#4b5563', marginTop: -6, marginBottom: 8 }}>Max payable: <Text style={{ fontFamily: 'Inter_700Bold' }}>{formatINR(position.balance)}</Text></Text>
              </View>)}</>)}
            {row(<>{col(<View>
                <Field testID="input-payment-date" label="Payment date" value={date} onChangeText={setDate} hint="YYYY-MM-DD · India business date, not in the future" editable={!readOnly && !busy} error={validatePaymentDate(date, bookingBusinessDate())} />
                <Btn label={calendar ? 'Hide calendar' : 'Choose payment date'} icon="calendar" variant="ghost" disabled={readOnly || busy} onPress={() => setCalendar(x => !x)} />
                {calendar && !readOnly && <NativeCalendar value={date} onChange={v => { setDate(v); setCalendar(false); }} />}
              </View>)}{col(<View />)}</>)}
            <Label>QUICK TOKEN SELECTION</Label>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {quickTokens(position.balance).map(n => { const on = Number(amount) === n; return <Pressable key={n} accessibilityRole="button" accessibilityLabel={'Token ' + formatINR(n)} disabled={readOnly || busy} onPress={() => setAmount((Math.min(n * 100, Math.round(position.balance * 100)) / 100).toFixed(2))} style={{ minHeight: 40, paddingHorizontal: 10, justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: on ? '#059669' : '#d1d5db', backgroundColor: on ? '#059669' : '#fff', opacity: readOnly || busy ? 0.5 : 1 }}><Text style={{ fontFamily: 'Inter_700Bold', fontSize: 12, color: on ? '#fff' : '#374151' }}>{formatINR(n)}</Text></Pressable>; })}
              <Pressable accessibilityRole="button" accessibilityLabel="Full balance" disabled={readOnly || busy || Math.round(position.balance * 100) <= 0} onPress={() => setAmount(position.balance.toFixed(2))} style={{ minHeight: 40, paddingHorizontal: 10, justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: '#6ee7b7', backgroundColor: amount.trim() && Math.round(Number(amount) * 100) === Math.round(position.balance * 100) ? '#047857' : '#fff', opacity: readOnly || busy || position.balance <= 0 ? 0.4 : 1 }}><Text style={{ fontFamily: 'Inter_700Bold', fontSize: 12, color: amount.trim() && Math.round(Number(amount) * 100) === Math.round(position.balance * 100) ? '#fff' : '#065f46' }}>Full balance ({formatINR(position.balance)})</Text></Pressable>
            </View>
            {row(<>{col(<Select testID="select-payment-mode" label="Payment mode" options={modes.map(v => ({ value: v, label: v }))} value={mode} onChange={v => { if (busy || readOnly) return; setMode(v); setAccount(cur => accountForModeChange(deposit, v, cur)); }} />)}
              {col(<Field label="Cheque / UTR / reference #" value={reference} onChangeText={setReference} placeholder="e.g. UTR 9384729103 or Cheque #881923" editable={!readOnly && !busy} />)}</>)}
            {accounts.length ? <Select testID="select-deposit-account" label="Deposit bank / firm ledger account *" options={accounts.map(a => ({ value: a.id, label: accountLabel(a) }))} value={account} onChange={v => { if (!busy && !readOnly) setAccount(v); }} />
              : <Banner tone="warn" title="No active project account" text="Add an active project bank or cash account before recording customer money." />}
            {selectedAccount ? <Text style={{ fontSize: 11, color: '#6b7280', marginTop: -4, marginBottom: 10 }}>Account type: <Text style={{ fontFamily: 'Inter_700Bold', color: '#1f2937', textTransform: 'uppercase' }}>{String(selectedAccount.data.accountType || 'Not specified').replace(/_/g, ' ')}</Text> • IFSC: <Text style={{ fontFamily: 'Inter_700Bold', color: '#1f2937' }}>{String(selectedAccount.data.ifscCode || '—')}</Text> • Branch: <Text style={{ fontFamily: 'Inter_700Bold', color: '#1f2937' }}>{String(selectedAccount.data.branchName || '—')}</Text></Text> : null}
            <View style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#fde68a', borderRadius: 12, padding: 10, flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <View><Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: '#6b7280', textTransform: 'uppercase' }}>Outstanding after this payment</Text><Text testID="text-balance-after" style={{ fontFamily: 'Inter_900Black', fontSize: 15, color: '#172554' }}>{formatINR(balanceAfterEntry)}</Text></View>
              <View style={{ alignItems: 'flex-end', flexShrink: 1 }}><Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: '#6b7280', textTransform: 'uppercase' }}>Stage</Text><Text style={{ fontFamily: 'Inter_700Bold', fontSize: 12, color: '#1f2937', textAlign: 'right' }}>{stageLabel(stage)}</Text></View>
            </View>
          </Card>
          {row(<>{col(<View style={{ marginBottom: 10 }}>
              <Label>BOOKING STATUS (READ-ONLY)</Label>
              <View style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#f9fafb' }}><Text style={{ fontFamily: 'Inter_700Bold', textTransform: 'capitalize' }}>{statusLabel === 'available' || statusLabel === 'blocked' ? 'reserved' : statusLabel}</Text></View>
              <Text style={{ fontSize: 10, color: '#6b7280', marginTop: 4 }}>Recording a payment does not automatically mark the plot sold or registered.</Text>
            </View>)}
            {col(stageField?.options?.length ? <View>
              <Select testID="select-agreement-stage" label="Agreement stage" options={stageField.options.map(v => ({ value: v, label: stageLabel(v) }))} value={stage} onChange={v => { if (!busy && !uncertain && !sold) setStage(v); }} />
              {locked && ctx.account.role === 'ACCOUNTANT' && stage !== String(plot.data.paymentMilestone || '') && stage !== 'Registration Pending' &&
                <Btn label="Save agreement stage only" variant="ghost" disabled={busy || uncertain} onPress={() => void saveStage()} />}
            </View> : <View />)}</>)}
          {locked && (stage === 'Registration Pending' || plot.data.registrationState === 'scheduled') &&
            <NativeRegistrationSlot projectId={erp.projectId} inventoryId={initial} readOnly={!canSubmit || sold || uncertain} />}
          {!locked && stage === 'Registration Pending' && <Text style={{ fontSize: 12, color: '#92400e' }}>Record the first customer payment before scheduling the registration slot.</Text>}
          {notesKey ? <Field label="Agreement terms / field notes" value={terms} onChangeText={setTerms} placeholder="e.g. Balance within 30 days. Corner clearance agreed with customer." multiline editable={!readOnly && !busy} /> : null}
          {statusLabel !== 'available' && !pendingUnposted && <Text testID="release-guidance" style={{ fontSize: 11, color: '#6b7280' }}>Release / Cancel Booking: booked plots are protected on the server. To release this plot, refer back its booking receipt from Project Statements (original receipts stay in the audit history). No money is deleted.</Text>}
          {uncertain && <Btn label="Check saved receipt" loading={busy} onPress={() => void checkSaved()} />}
        </KeyboardAwareScrollViewCompat>
        <View style={{ padding: 12, flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 8, borderTopWidth: 1, borderTopColor: '#e5e7eb', backgroundColor: '#fafaf9' }}>
          <Btn label="Cancel" variant="ghost" disabled={closeLocked} onPress={onClose} />
          {pendingUnposted ? <Text style={{ alignSelf: 'center', fontFamily: 'Inter_700Bold', fontSize: 12, color: '#92400e' }}>Correct & resubmit from Project Statements</Text>
            : !sold && canSubmit && !reconciliation && <Btn testID="button-submit-payment" icon="check-circle" label={submitLabel} loading={busy} disabled={!uncertain && Math.round(position.balance * 100) <= 0} onPress={() => void submit()} />}
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
