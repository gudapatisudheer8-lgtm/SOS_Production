export interface PlotLike {
  projectId?: string;
  status: string;
}
export interface AccountLike {
  firmId?: string;
  linkedProjectId?: string;
  accountType: string;
  currentBalance?: number;
}

export interface PlotCounts {
  total: number;
  available: number;
  booked: number;
  sold: number;
  blocked: number;
}

/**
 * Live plot counts for one project, matching the accountant dashboard:
 * every 'reserved' plot (including token reservations) counts as booked.
 */
export function computePlotCounts(plots: PlotLike[], projectId?: string): PlotCounts {
  const c: PlotCounts = { total: 0, available: 0, booked: 0, sold: 0, blocked: 0 };
  if (!projectId) return c;
  for (const p of plots) {
    if (p.projectId !== projectId) continue;
    c.total += 1;
    if (p.status === 'available') c.available += 1;
    else if (p.status === 'reserved') c.booked += 1;
    else if (p.status === 'sold') c.sold += 1;
    else if (p.status === 'blocked') c.blocked += 1;
  }
  return c;
}

export interface ProjectBalance {
  bank: number;
  cash: number;
  net: number;
  accountCount: number;
}

/** Net BANK + CASH from real currentBalance, strictly scoped to firm + project. */
export function computeProjectBalance(accounts: AccountLike[], firmId?: string, projectId?: string): ProjectBalance {
  const b: ProjectBalance = { bank: 0, cash: 0, net: 0, accountCount: 0 };
  if (!firmId || !projectId) return b;
  for (const a of accounts) {
    if (a.firmId !== firmId || a.linkedProjectId !== projectId) continue;
    const amt = Number(a.currentBalance) || 0;
    if (a.accountType === 'field_petty_cash') b.cash += amt;
    else b.bank += amt;
    b.accountCount += 1;
  }
  b.net = b.bank + b.cash;
  return b;
}
