// Replaces the original Express/SQL sync helpers used by SyndicateEquityModule with
// real Spring API commands. Unsupported operations throw so the UI never reports false success.
import { command, describeAccess } from '../../adapter/erp';

export async function resetPartnerPinInSql(
  _phone: string,
  partnerId?: string
): Promise<{ success: boolean; message?: string }> {
  if (!partnerId) throw new Error('Partner identity is missing.');
  const r: any = await command('credentials.reset', { identityId: partnerId });
  const notice = describeAccess(r?.access);
  if (notice) window.dispatchEvent(new CustomEvent('sos-notice', { detail: notice }));
  return { success: true, message: notice || 'Credential reset.' };
}

export async function togglePartnerStatusInSql(
  _phone: string,
  _partnerId: string | undefined,
  _status: 'active' | 'inactive'
): Promise<{ success: boolean; message?: string }> {
  throw new Error('Not supported by backend: partner activation/deactivation has no API command.');
}
