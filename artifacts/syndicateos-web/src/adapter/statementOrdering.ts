export type StatementSortKey = 'date' | 'referenceNo' | 'description' | 'accountName' | 'enrolledBy' | 'amount';
export type StatementSortOrder = 'asc' | 'desc';

interface SortableEntry {
  id: string; date: string; referenceNo: string; description: string;
  accountName: string; enrolledBy: string; amount: number; type: 'credit' | 'debit';
}
const compareText = (a: string, b: string) => (a || '').localeCompare(b || '', undefined, { numeric: true, sensitivity: 'base' });
const timestamp = (date: string) => Date.parse(date) || 0;

/** Returns a new view order; journal entries and chronological running balances stay unchanged. */
export function sortStatement<T extends SortableEntry>(entries: T[], key: StatementSortKey, order: StatementSortOrder): T[] {
  const direction = order === 'asc' ? 1 : -1;
  return [...entries].sort((a, b) => {
    const comparison = key === 'date' ? timestamp(a.date) - timestamp(b.date)
      : key === 'amount' ? (a.type === 'debit' ? -a.amount : a.amount) - (b.type === 'debit' ? -b.amount : b.amount)
      : compareText(a[key], b[key]);
    return direction * comparison || timestamp(b.date) - timestamp(a.date) || compareText(a.id, b.id);
  });
}
export const enrolledPeople = (entries: { enrolledBy: string }[]) =>
  [...new Set(entries.map((entry) => entry.enrolledBy || ''))].sort(compareText);

export const enrolledMatches = (entry: { enrolledBy: string }, person: string | null) =>
  person === null || (entry.enrolledBy || '') === person;
