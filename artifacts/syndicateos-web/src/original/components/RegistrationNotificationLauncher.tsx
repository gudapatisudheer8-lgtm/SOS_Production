import { useEffect, useState } from 'react';
import { api } from '../../adapter/api';
import { CustomerPlotBookingModal } from './modals/CustomerPlotBookingModal';
import type { Plot, Project, TenantFirm, FirmAccount } from '../types';

/** A notification opens the original booking form, never a new page or a guessed numeric plot id. */
export function RegistrationNotificationLauncher({ identityKey, firm, projects, plots, accounts, onSelectProject, onUpdatePlot }: {
  identityKey: string; firm?: TenantFirm; projects: Project[]; plots: Plot[]; accounts: FirmAccount[];
  onSelectProject: (id: string) => void; onUpdatePlot: (plot: Plot) => void | boolean | Promise<boolean>;
}) {
  const [target, setTarget] = useState<{ projectId: string; inventoryId: string } | null>(null);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    setTarget(null); setVerified(false); setError('');
    const open = (value: any) => {
      if (typeof value?.projectId !== 'string' || typeof value?.inventoryId !== 'string') return;
      setTarget({ projectId: value.projectId, inventoryId: value.inventoryId }); setVerified(false); setError('');
    };
    const listener = (e: Event) => open((e as CustomEvent).detail);
    const worker = (e: MessageEvent) => { if (e.data?.type === 'sos-open-registration') open(e.data); };
    window.addEventListener('sos-open-registration', listener);
    navigator.serviceWorker?.addEventListener('message', worker);
    const url = new URL(window.location.href);
    const projectId = url.searchParams.get('registrationProject'), inventoryId = url.searchParams.get('registrationPlot');
    if (projectId && inventoryId) {
      open({ projectId, inventoryId });
      url.searchParams.delete('registrationProject'); url.searchParams.delete('registrationPlot');
      history.replaceState(null, '', url);
    }
    return () => { window.removeEventListener('sos-open-registration', listener); navigator.serviceWorker?.removeEventListener('message', worker); };
  }, [identityKey]);
  useEffect(() => {
    if (!target) return;
    let alive = true;
    api(`/erp/${encodeURIComponent(target.projectId)}/plots/${encodeURIComponent(target.inventoryId)}/registration`)
      .then(() => { if (alive) { setVerified(true); onSelectProject(target.projectId); } })
      .catch((e) => { if (alive) setError(e.message || 'This plot is no longer available to your account.'); });
    return () => { alive = false; };
  }, [target]);
  const project = projects.find((p) => p.id === target?.projectId && p.firmId === firm?.id);
  const plot = plots.find((p) => p.__recordId === target?.inventoryId && p.projectId === project?.id && p.firmId === firm?.id);
  if (!target) return null;
  if (error || (verified && (!plot || !project || !firm))) return <div role="alert" className="fixed bottom-6 left-4 right-4 z-[80] bg-white border border-red-300 rounded-xl p-4 text-sm text-red-800">
    {error || 'The plot is not in the current firm workspace. Switch to its authorized firm and reopen the notification.'}
    <button type="button" className="ml-4 underline font-bold" onClick={() => setTarget(null)}>Close</button>
  </div>;
  if (!verified || !plot || !project || !firm) return null;
  return <CustomerPlotBookingModal key={`${identityKey}:${target.inventoryId}`} isOpen plot={plot} project={project} firm={firm}
    floorRate={project.floorRatePerSqYard} firmAccounts={accounts} onClose={() => setTarget(null)} onConfirmBooking={onUpdatePlot} />;
}
