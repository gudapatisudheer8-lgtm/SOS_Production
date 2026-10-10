import type { FieldExpenseLog } from '../original/types';

/** Reconciliation and approval are server decisions, not expense-form inputs. */
export function expenseInput(expense: FieldExpenseLog, bankAccountId?: string): Record<string, any> {
  const data: Record<string, any> = { ...expense };
  for (const key of ['status', 'reconciledDate', 'reconciledBy', 'approvedByPartners',
    'requiresManagingPartnerSignoff', 'hasVoiceNote', 'bankAccountId']) delete data[key];
  if (expense.paymentSource === 'project_bank') {
    data.accountId = bankAccountId || expense.bankAccountId || data.accountId;
    // The authenticated recorder is resolved by the API; this UI sentinel is not a partner UUID.
    if (data.partnerId === 'accountant') delete data.partnerId;
  } else {
    if (data.partnerId === 'accountant' || !data.partnerId) {
      throw new Error('Choose the project partner who paid from their own funds.');
    }
    delete data.accountId;
  }
  return data;
}
