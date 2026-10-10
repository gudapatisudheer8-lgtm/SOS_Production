import React, { useState } from 'react';
import type { Project, FirmAccount, SyndicatePartner } from '../../types';
import { formatINR } from '../../utils/formatters';

export function ProjectDrawingForm({ project, accounts, partners, onSave }: {
  project: Project; accounts: FirmAccount[]; partners: SyndicatePartner[];
  onSave: (data: any) => void | boolean | Promise<boolean>;
}) {
  const modes: string[] = project.financialForms?.drawings?.find((f) => f.key === 'payoutMode')?.options || [];
  const [open, setOpen] = useState(false);
  const [partnerId, setPartnerId] = useState('');
  const [mode, setMode] = useState(modes[0] || '');
  const [accountId, setAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [purpose, setPurpose] = useState('');
  const [destination, setDestination] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const available = accounts.filter((a) => a.linkedProjectId === project.id && a.status === 'active');
  const cashMode = mode === 'Field Vault Cash';
  const eligible = available.filter((a) => !!(a as any).isDefaultCash === cashMode);
  const selected = eligible.find((a) => a.id === accountId);
  const members = partners.filter((p) => project.partners.some((m) => m.partnerId === p.id));
  const inputClass = 'w-full rounded-xl border border-gray-200 p-2 text-sm';
  if (!open) return <button className="rounded-xl bg-amber-400 px-4 py-2 font-bold mb-3" onClick={() => setOpen(true)}>+ Record partner drawing</button>;
  return <form className="rounded-2xl border border-amber-200 bg-white p-4 mb-4" onSubmit={async (e) => {
    e.preventDefault();
    if (saving || !selected || !partnerId || !(Number(amount) > 0)) return;
    setSaving(true);
    try {
      const ok = await onSave({ projectId: project.id, partnerId, sourceAccountId: selected.id,
        amount: Number(amount), date, payoutMode: mode, purpose, destinationAccountDetails: destination });
      if (ok !== false) { setOpen(false); setAmount(''); setPurpose(''); setDestination(''); }
    } finally { setSaving(false); }
  }}>
    <h3 className="font-bold mb-3">Record partner drawing</h3>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <label>Partner<select required className={inputClass} value={partnerId} onChange={(e) => setPartnerId(e.target.value)}>
        <option value="">Select project partner</option>{members.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select></label>
      <label>Payment method<select required className={inputClass} value={mode} onChange={(e) => { setMode(e.target.value); setAccountId(''); }}>
        {modes.map((m) => <option key={m}>{m}</option>)}
      </select></label>
      <label>Project account<select required className={inputClass} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
        <option value="">Select account</option>{eligible.map((a) => <option key={a.id} value={a.id}>{a.accountName} — {formatINR(a.currentBalance)}</option>)}
      </select></label>
      <label>Amount (₹)<input required min="0.01" step="0.01" type="number" className={inputClass} value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
      <label>Date<input required type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} /></label>
      <label>Destination / handover details<input required className={inputClass} value={destination} onChange={(e) => setDestination(e.target.value)} /></label>
      <label className="sm:col-span-2">Purpose<textarea required className={inputClass} value={purpose} onChange={(e) => setPurpose(e.target.value)} /></label>
    </div>
    <p className="text-xs text-gray-600 my-3">Pending independent approval. The selected account is debited only when payment clears.</p>
    <button type="submit" disabled={saving || !selected} className="rounded-xl bg-amber-400 px-4 py-2 font-bold disabled:opacity-50">{saving ? 'Saving…' : 'Submit drawing'}</button>
    <button type="button" className="ml-3" disabled={saving} onClick={() => setOpen(false)}>Cancel</button>
  </form>;
}
