import { MasterOptions } from '../../../adapter/config';
import { ProjectDrawingForm } from '../modals/ProjectDrawingForm';
import React, { useState, useMemo, useEffect } from 'react';
import {
  Project,
  TenantFirm,
  FirmAccount,
  FirmAccountTransaction,
  FieldExpenseLog,
  Plot,
  ApartmentUnit,
  SyndicatePartner,
  IndividualInvestmentRecord
} from '../../types';
import {
  FileText,
  Search,
  Filter,
  ArrowDownLeft,
  ArrowUpRight,
  User,
  Calendar,
  Landmark,
  Download,
  Printer,
  PlusCircle,
  CheckCircle2,
  RotateCcw,
  PencilLine,
  Layers,
  Coins,
  ChevronDown,
  X,
  FileCheck2,
  RefreshCw,
  Building,
  Receipt,
  Wallet
} from 'lucide-react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { enrolledMatches, enrolledPeople, sortStatement, type StatementSortKey } from '../../../adapter/statementOrdering';
import { formatINR } from '../../utils/formatters';
import { type CorrectionField, type PostingState, countsForCash, postingLabel, runningBalances, statementTotals } from '../../../adapter/financialCorrections';
import { FinancialCorrectionDialog, type FinancialDialogMode } from './FinancialCorrectionDialog';

export interface UnifiedProjectTransaction {
  affectsCash?: boolean;
  accountId?: string;
  id: string;
  source: 'bank_account' | 'field_expense' | 'plot_booking' | 'apartment_booking';
  date: string;
  type: 'credit' | 'debit';
  amount: number;
  category: string;
  categoryLabel: string;
  description: string;
  referenceNo: string;
  accountName: string;
  accountTypeLabel: string;
  enrolledBy: string;
  postingState?: PostingState | string;
  kind?: string;
  revision?: number;
  canReferBack?: boolean;
  canResubmit?: boolean;
  correctionReason?: string;
  correctionData?: Record<string, any>;
  correctionFields?: CorrectionField[];
  paymentMode?: string;
  runningBalance?: number;
  notes?: string;
}

interface ProjectStatementModuleProps {
  onReferBackFinancial?: (entry: UnifiedProjectTransaction, reason: string, requestId: string) => Promise<boolean>;
  onResubmitFinancial?: (entry: UnifiedProjectTransaction, data: Record<string, any>, requestId: string) => Promise<boolean>;
  onRecordDrawing?: (data: any) => void | boolean | Promise<boolean>;
  project?: Project | null;
  firm: TenantFirm;
  accounts: FirmAccount[];
  fieldExpenses: FieldExpenseLog[];
  plots: Plot[];
  apartmentUnits: ApartmentUnit[];
  partners: SyndicatePartner[];
  individualInvestments?: IndividualInvestmentRecord[];
  onOpenRecordTransactionModal?: () => void;
  onOpenEnrollExpenseModal?: () => void;
  onOpenIndividualInvestmentModal?: () => void;
  onOpenDrawingRequest?: () => void;
}

export const ProjectStatementModule: React.FC<ProjectStatementModuleProps> = ({
  onRecordDrawing,
  onReferBackFinancial,
  onResubmitFinancial,
  project,
  firm,
  accounts,
  fieldExpenses,
  plots,
  apartmentUnits,
  partners,
  individualInvestments = [],
  onOpenRecordTransactionModal,
  onOpenEnrollExpenseModal,
  onOpenIndividualInvestmentModal,
  onOpenDrawingRequest,
}) => {
  const [drawingOpen, setDrawingOpen] = useState(false);
  // Top filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [flowFilter, setFlowFilter] = useState<'all' | 'credit' | 'debit'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [accountFilter, setAccountFilter] = useState<string>('all');
  const [enrolledByFilter, setEnrolledByFilter] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<StatementSortKey>('date');
  const [dialog, setDialog] = useState<{ mode: FinancialDialogMode; entry: UnifiedProjectTransaction } | null>(null);
  const [dateFilter, setDateFilter] = useState<'all' | 'month' | 'last30' | 'custom'>('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  useEffect(() => {
    setEnrolledByFilter(null);
    setDialog(null);
  }, [project?.id, firm.id]);
  const changeSort = (key: StatementSortKey) => {
    if (sortKey === key) setSortOrder((order) => order === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortOrder(key === 'date' || key === 'amount' ? 'desc' : 'asc'); }
  };
  const sortableHeading = (key: StatementSortKey, label: string, right = false) => (
    <th className={`py-3.5 px-4 ${right ? 'text-right' : ''}`}
      aria-sort={sortKey === key ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" onClick={() => changeSort(key)}
        className={`inline-flex items-center gap-1.5 whitespace-nowrap hover:text-amber-800 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${sortKey === key ? 'text-amber-800' : ''}`}
        title={`Sort by ${label}`} aria-label={`Sort by ${label}`}>
        {label}
        {sortKey !== key ? <ArrowUpDown className="h-3 w-3" /> : sortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      </button>
    </th>
  );

  const targetFirmId = firm?.id || project?.firmId;

  // Filter accounts belonging strictly to this project or general firm pool
  const projectAccounts = useMemo(() => {
    return accounts.filter(
      (a) =>
        (!targetFirmId || !a.firmId || a.firmId === targetFirmId) &&
        (project ? (!a.linkedProjectId || a.linkedProjectId === 'all' || a.linkedProjectId === project.id) : true)
    );
  }, [accounts, targetFirmId, project?.id]);

  // Aggregate all transactions into a unified, normalized transaction list
  const allProjectTransactions: UnifiedProjectTransaction[] = useMemo(() => {
    if (project?.financialStatement) return project.financialStatement;
    if (!project) return [];
    const list: UnifiedProjectTransaction[] = [];

    // 1. Bank Account Transactions from project accounts
    projectAccounts.forEach((acc) => {
      if (acc.recentTransactions) {
        acc.recentTransactions.forEach((tx) => {
          // If transaction is tagged to a specific project, verify match
          if (project && tx.projectName && !tx.projectName.toLowerCase().includes(project.name.toLowerCase()) && !project.name.toLowerCase().includes(tx.projectName.toLowerCase())) {
            // Belongs to another specific project
            if (tx.projectName.trim() && project.name.trim()) {
              return;
            }
          }

          let catLabel = 'General Banking';
          if (tx.category === 'plot_booking_advance') catLabel = 'Plot Booking Advance';
          else if (tx.category === 'flat_booking_advance') catLabel = 'Flat Booking Advance';
          else if (tx.category === 'partner_capital') catLabel = 'Partner Capital Inflow';
          else if (tx.category === 'vendor_payout') catLabel = 'Vendor / Contractor Payout';
          else if (tx.category === 'contractor_payout') catLabel = 'Contractor Running Bill';
          else if (tx.category === 'field_imprest') catLabel = 'Site Petty Cash Imprest';
          else if (tx.category === 'partner_draw') catLabel = 'Partner Dividend / Draw';
          else if (tx.category === 'cash_withdrawal') catLabel = 'Site Cash Withdrawal';
          else if (tx.category === 'statutory_fee') catLabel = 'Statutory Govt Fee';

          let accTypeLabel = 'Current Operational';
          if (acc.accountType === 'rera_escrow') accTypeLabel = 'RERA Escrow';
          else if (acc.accountType === 'syndicate_capital_pool') accTypeLabel = 'Syndicate Capital Pool';
          else if (acc.accountType === 'field_petty_cash') accTypeLabel = 'Field Cash Vault';
          else if (acc.accountType === 'tax_statutory') accTypeLabel = 'Tax & Statutory Escrow';

          list.push({
            id: tx.id || `tx-acc-${Math.random()}`,
            source: 'bank_account',
            date: tx.date,
            type: tx.type,
            amount: tx.amount,
            category: tx.category,
            categoryLabel: catLabel,
            description: tx.description,
            referenceNo: tx.referenceNo || `REF-${acc.bankName.slice(0, 3)}-${tx.id.slice(-4)}`,
            accountName: `${acc.bankName} (${acc.accountNumber.slice(-4)})`,
            accountTypeLabel: accTypeLabel,
            enrolledBy: tx.enrolledBy || tx.partnerName || `${firm.accountantName || 'Accountant'} (Accountant)`,
            postingState: (tx.status || 'approved') === 'approved' ? 'posted' : 'legacy_unposted',
            affectsCash: (tx.status || 'approved') === 'approved',
            paymentMode: tx.paymentMode || (acc.accountType === 'field_petty_cash' ? 'Cash' : 'RTGS / NEFT'),
            runningBalance: tx.balanceAfter,
            notes: tx.notes,
          });
        });
      }
    });

    // 2. Field & Site Expenses for this project
    const pExpenses = fieldExpenses.filter(
      (e) =>
        (project ? (!e.projectId || e.projectId === project.id) : true) &&
        (!targetFirmId || !e.firmId || e.firmId === targetFirmId)
    );
    pExpenses.forEach((exp) => {
      // Prevent duplicate if already captured via bank account transaction
      const hasBankTx = list.some(
        (t) =>
          t.source === 'bank_account' &&
          t.type === 'debit' &&
          (t.referenceNo === `EXP-${exp.id.slice(-6).toUpperCase()}` ||
            (t.amount === exp.amount && t.date === exp.date && t.description.toLowerCase().includes(exp.category.toLowerCase())))
      );
      if (hasBankTx) return;

      list.push({
        id: `field-exp-${exp.id}`,
        source: 'field_expense',
        date: exp.date,
        type: 'debit',
        amount: exp.amount,
        category: `field_${exp.category.toLowerCase().replace(/\s+/g, '_')}`,
        categoryLabel: `Site: ${exp.category}`,
        description: exp.note || `Site field expense voucher for ${exp.category}`,
        referenceNo: `SITE-VOUCH-${exp.id.slice(-6).toUpperCase()}`,
        accountName: exp.bankAccountName || 'Site Petty Cash Treasury',
        accountTypeLabel: exp.paymentSource === 'project_bank' ? 'Project Bank Account' : 'Field Imprest Vault',
        enrolledBy: `${exp.partnerName} (Field Partner)`,
        postingState: (exp.status) === 'approved' ? 'posted' : 'legacy_unposted',
        affectsCash: (exp.status) === 'approved',
        paymentMode: exp.paymentMode || 'Cash / Spot Voucher',
        notes: exp.taxInvoiceNo ? `GST Invoice #${exp.taxInvoiceNo}` : undefined,
      });
    });

    // 3. Customer Plot Booking Advances (if not already recorded in bank txs)
    const activePlots = plots.filter((p) => (project ? p.projectId === project.id : true) && (!targetFirmId || !p.firmId || p.firmId === targetFirmId));
    activePlots.forEach((plt) => {
      if (plt.advanceReceived && plt.advanceReceived > 0 && plt.status !== 'available') {
        // Prevent duplicate if already listed in bank account transactions
        const hasExisting = list.some(
          (t) => t.amount === plt.advanceReceived && t.description.includes(`Plot #${plt.plotNumber}`)
        );
        if (!hasExisting) {
          const primaryAcc = projectAccounts[0];
          list.push({
            id: `plot-adv-${plt.id}`,
            source: 'plot_booking',
            date: plt.bookedAt || '2026-09-20',
            type: 'credit',
            amount: plt.advanceReceived,
            category: 'plot_booking_advance',
            categoryLabel: 'Plot Booking Advance',
            description: `Plot #${plt.plotNumber} booking advance received from ${plt.buyerName || 'Client'}`,
            referenceNo: plt.paymentRefNumber || `PLT-BOOK-${plt.plotNumber}`,
            accountName: primaryAcc ? `${primaryAcc.bankName} (${primaryAcc.accountNumber.slice(-4)})` : 'Pending Bank A/C Setup',
            accountTypeLabel: primaryAcc ? 'Project Bank Account' : 'Customer Advance',
            enrolledBy: 'Sales Liaison Partner',
            postingState: 'posted',
            affectsCash: true,
            paymentMode: plt.paymentMode || 'RTGS / Bank Transfer',
            notes: plt.paymentMilestone ? `Stage: ${plt.paymentMilestone}` : undefined,
          });
        }
      }
    });

    // 4. Customer Apartment Unit Booking Advances
    const activeUnits = apartmentUnits.filter((u) => (project ? u.projectId === project.id : true) && (!targetFirmId || !u.firmId || u.firmId === targetFirmId));
    activeUnits.forEach((unit) => {
      if (unit.advanceReceived && unit.advanceReceived > 0 && unit.status !== 'available') {
        const hasExisting = list.some(
          (t) => t.amount === unit.advanceReceived && t.description.includes(`Unit #${unit.unitNumber}`)
        );
        if (!hasExisting) {
          const primaryAcc = projectAccounts[0];
          list.push({
            id: `unit-adv-${unit.id}`,
            source: 'apartment_booking',
            date: '2026-09-18',
            type: 'credit',
            amount: unit.advanceReceived,
            category: 'flat_booking_advance',
            categoryLabel: 'Flat Booking Advance',
            description: `Flat #${unit.unitNumber} (${unit.flatType}) booking advance from ${unit.buyerName || 'Buyer'}`,
            referenceNo: `FLAT-BOOK-${unit.unitNumber}`,
            accountName: primaryAcc ? `${primaryAcc.bankName} (${primaryAcc.accountNumber.slice(-4)})` : 'Pending Bank A/C Setup',
            accountTypeLabel: primaryAcc ? 'Project Bank Account' : 'Customer Advance',
            enrolledBy: 'Site Sales Coordinator',
            postingState: 'posted',
            affectsCash: true,
            paymentMode: 'Bank Transfer / Cheque',
            notes: unit.currentMilestone ? `Milestone: ${unit.currentMilestone}` : undefined,
          });
        }
      }
    });

    // 5. Partner Individual Capital Investments (Cash Vaults & Bank)
    const pInvestments = (individualInvestments || []).filter(
      (inv) =>
        (!targetFirmId || !inv.firmId || inv.firmId === targetFirmId) &&
        (project ? !inv.projectId || inv.projectId === project.id : true)
    );
    pInvestments.forEach((inv) => {
      // Check if already captured via bank account transaction
      const hasExistingTx = list.some(
        (t) =>
          t.source === 'bank_account' &&
          (t.referenceNo === inv.referenceNo ||
            (t.amount === inv.amount && t.date === inv.date && t.description.includes(inv.partnerName)))
      );
      if (!hasExistingTx) {
        list.push({
          id: `inv-${inv.id}`,
          source: 'bank_account',
          date: inv.date,
          type: 'credit',
          amount: inv.amount,
          category: 'partner_capital',
          categoryLabel: 'Partner Capital Inflow',
          description: `Capital Contribution: ${inv.purpose} by ${inv.partnerName}`,
          referenceNo: inv.referenceNo || `CAP-INV-${inv.id.slice(-6).toUpperCase()}`,
          accountName: inv.accountName || (inv.accountType === 'cash' ? 'Syndicate Cash Safe Vault' : 'Project Bank Account'),
          accountTypeLabel: inv.accountType === 'cash' ? 'Cash Vault Depository' : 'Commercial Escrow / Bank',
          enrolledBy: inv.enrolledBy || `${inv.partnerName} (Partner)`,
          postingState: (inv.status || 'approved') === 'approved' ? 'posted' : 'legacy_unposted',
          affectsCash: (inv.status || 'approved') === 'approved',
          paymentMode: inv.paymentMode || (inv.accountType === 'cash' ? 'Cash' : 'Bank Wire'),
          notes: inv.notes,
        });
      }
    });

    return list;
  }, [projectAccounts, fieldExpenses, plots, apartmentUnits, individualInvestments, project, firm, targetFirmId]);

  // Apply User-Friendly Top Filters
  const filteredTransactions = useMemo(() => {
    return sortStatement(allProjectTransactions
      .filter((tx) => {
        if (!enrolledMatches(tx, enrolledByFilter)) return false;
        // Flow Filter (Credit vs Debit)
        if (flowFilter !== 'all' && tx.type !== flowFilter) return false;

        // Category Filter
        if (categoryFilter !== 'all') {
          if (categoryFilter === 'booking_advances') {
            if (!tx.category.includes('advance') && !tx.category.includes('booking')) return false;
          } else if (categoryFilter === 'site_expenses') {
            if (!tx.category.includes('field_') && !tx.category.includes('imprest')) return false;
          } else if (categoryFilter === 'partner_capital_draws') {
            if (!tx.category.includes('partner') && !tx.category.includes('capital') && !tx.category.includes('draw')) return false;
          } else if (categoryFilter === 'contractor_vendor') {
            const isMatch =
              tx.category.includes('vendor') ||
              tx.category.includes('contractor') ||
              tx.category.includes('materials') ||
              tx.category.includes('earthwork') ||
              tx.category.includes('roads') ||
              tx.category.includes('liaison') ||
              tx.category.includes('statutory') ||
              tx.description.toLowerCase().includes('contractor') ||
              tx.description.toLowerCase().includes('vendor') ||
              tx.description.toLowerCase().includes('civil') ||
              tx.description.toLowerCase().includes('earthwork');
            if (!isMatch) return false;
          }
        }

        // Account Filter
        if (accountFilter !== 'all') {
          if (accountFilter === 'rera_escrow') {
            if (!tx.accountTypeLabel.toLowerCase().includes('rera') && !tx.accountName.toLowerCase().includes('rera')) return false;
          } else if (accountFilter === 'petty_cash') {
            if (!tx.accountTypeLabel.toLowerCase().includes('cash') && !tx.accountName.toLowerCase().includes('cash')) return false;
          } else if (accountFilter === 'operational') {
            if (!tx.accountTypeLabel.toLowerCase().includes('operational') && !tx.accountTypeLabel.toLowerCase().includes('current')) return false;
          }
        }

        // Global Search Term Filter
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase();
          const matchDesc = tx.description.toLowerCase().includes(q);
          const matchRef = tx.referenceNo.toLowerCase().includes(q);
          const matchEnrolled = tx.enrolledBy.toLowerCase().includes(q);
          const matchAccount = tx.accountName.toLowerCase().includes(q);
          const matchCat = tx.categoryLabel.toLowerCase().includes(q);
          if (!matchDesc && !matchRef && !matchEnrolled && !matchAccount && !matchCat) {
            return false;
          }
        }

        return true;
      }), sortKey, sortOrder);
  }, [allProjectTransactions, flowFilter, categoryFilter, accountFilter, searchTerm, enrolledByFilter, sortKey, sortOrder]);
  const enrolledByOptions = useMemo(() => enrolledPeople(allProjectTransactions), [allProjectTransactions]);

  // Aggregate Metrics for Statement
  // Cash effect follows the server's affectsCash flag only; reversals and replaced
  // entries remain readable without being counted twice.
  const { inflows: totalInflows, outflows: totalOutflows, net: netCashFlow } = statementTotals(filteredTransactions);
  const balances = useMemo(() => runningBalances(allProjectTransactions), [allProjectTransactions]);
  const approvedCount = filteredTransactions.filter((t) => countsForCash(t)).length;
  const pendingCount = filteredTransactions.filter((t) => t.postingState === 'legacy_unposted' || t.postingState === 'referred_back').length;

  const bankAccounts = useMemo(() => {
    return projectAccounts.filter((a) => a.accountType !== 'field_petty_cash');
  }, [projectAccounts]);

  const cashAccounts = useMemo(() => {
    return projectAccounts.filter((a) => a.accountType === 'field_petty_cash');
  }, [projectAccounts]);

  const totalBankBalance = useMemo(() => {
    return bankAccounts.reduce((sum, acc) => sum + (acc.currentBalance || 0), 0);
  }, [bankAccounts]);

  const totalCashBalance = useMemo(() => {
    const directCash = cashAccounts.reduce((sum, acc) => sum + (acc.currentBalance || 0), 0);
    const cashCredits = allProjectTransactions
      .filter((t) => t.type === 'credit' && countsForCash(t) && (t.paymentMode?.toLowerCase().includes('cash') || t.accountName.toLowerCase().includes('cash') || t.accountTypeLabel.toLowerCase().includes('cash')))
      .reduce((sum, t) => sum + t.amount, 0);
    const cashDebits = allProjectTransactions
      .filter((t) => t.type === 'debit' && countsForCash(t) && (t.paymentMode?.toLowerCase().includes('cash') || t.accountName.toLowerCase().includes('cash') || t.accountTypeLabel.toLowerCase().includes('cash')))
      .reduce((sum, t) => sum + t.amount, 0);
    const netCashTxs = cashCredits - cashDebits;
    return Math.max(directCash, netCashTxs, 0);
  }, [cashAccounts, allProjectTransactions]);

  const canDraw = !!(project?.canRecordDrawings && onRecordDrawing);
  const actionBtn = 'flex items-center justify-center gap-1.5 px-3.5 py-2.5 min-h-[40px] rounded-2xl font-black text-xs transition-all shadow-sm cursor-pointer active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-1';

  // Export to CSV Function
  const handleExportCSV = () => {
    const headers = [
      'Date',
      'Transaction Ref',
      'Type',
      'Category',
      'Description',
      'Account / Treasury',
      'Enrolled By',
      'Posting',
      'Affects Cash',
      'Amount (INR)',
      'Payment Mode'
    ];

    const rows = filteredTransactions.map((t) => [
      t.date,
      `"${t.referenceNo}"`,
      t.type.toUpperCase(),
      `"${t.categoryLabel}"`,
      `"${t.description.replace(/"/g, '""')}"`,
      `"${t.accountName}"`,
      `"${t.enrolledBy.replace(/"/g, '""')}"`,
      `"${postingLabel(t.postingState)}"`,
      countsForCash(t) ? 'YES' : 'NO',
      t.amount,
      `"${t.paymentMode || 'N/A'}"`
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${project ? project.code : firm.code}_Project_Statement_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print Statement Function
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {canDraw && project && <ProjectDrawingForm key={project.id} project={project} accounts={accounts} partners={partners} onSave={onRecordDrawing!} open={drawingOpen} onOpenChange={setDrawingOpen} />}
      {dialog && (
        <FinancialCorrectionDialog
          key={`${dialog.mode}-${dialog.entry.id}`}
          mode={dialog.mode}
          entry={dialog.entry}
          project={project}
          accounts={accounts}
          partners={partners}
          plots={plots}
          onClose={() => setDialog(null)}
          onReferBack={onReferBackFinancial}
          onResubmit={onResubmitFinancial}
        />
      )}
      {/* ======================================================== */}
      {/* 1. PROJECT STATEMENT HEADER & ACTION BUTTONS             */}
      {/* ======================================================== */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-gray-200">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-gray-100">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-950 border border-emerald-300">
                Official Project Treasury &amp; Ledger Statement
              </span>
              <span className="text-xs font-mono font-bold text-gray-500">
                Project Code: <strong className="text-gray-900">{project ? project.code : 'Consolidated'}</strong>
              </span>
              <span className="text-xs text-gray-300">•</span>
              <span className="text-xs text-gray-600 font-medium">
                Venture: <strong className="text-gray-900">{project ? project.name : 'All Firm Ventures'}</strong>
              </span>
            </div>

            <h3 className="text-xl sm:text-2xl font-black text-gray-950 flex items-center gap-2 mt-1">
              <FileText className="w-6 h-6 text-emerald-600" />
              <span>Project Account Statement &amp; Recorded Transactions</span>
            </h3>

            <p className="text-xs text-gray-500 mt-1">
              Consolidated real-time passbook recording every customer booking advance, partner capital infusion, verified site outlay, and contractor disbursement. Every entry is recorded the moment it is saved; mistakes are fixed by referring back (a visible reversal) or by a corrected replacement, with the full history kept.
            </p>
          </div>

          {/* Top Actions: Export CSV, Print, and Quick Entry CTA */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {onOpenEnrollExpenseModal && (
              <button
                id="btn-stmt-enroll-expense"
                type="button"
                onClick={onOpenEnrollExpenseModal}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-[#FFB800] hover:bg-amber-400 text-gray-950 font-black text-xs transition-all shadow-sm border border-amber-600/30 cursor-pointer active:scale-95"
                title="Enroll a project expense debited from bank account"
              >
                <Receipt className="w-3.5 h-3.5 text-gray-950" />
                <span>+ Enroll Project Expenses</span>
              </button>
            )}

            {onOpenIndividualInvestmentModal && (
              <button
                id="btn-stmt-add-investment"
                data-testid="button-stmt-add-investment"
                type="button"
                onClick={onOpenIndividualInvestmentModal}
                className={`${actionBtn} bg-gray-900 hover:bg-black text-white`}
                title="Record a partner capital investment for this project"
              >
                <PlusCircle className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
                <span>+ Add Investment</span>
              </button>
            )}

            {onOpenDrawingRequest && (
              <button
                id="btn-stmt-drawing-request"
                data-testid="button-stmt-drawing-request"
                type="button"
                onClick={onOpenDrawingRequest}
                className={`${actionBtn} bg-white hover:bg-amber-50 text-gray-950 border border-amber-400`}
              >
                <PlusCircle className="w-3.5 h-3.5 text-amber-700" aria-hidden="true" />
                <span>+ Drawing Request</span>
              </button>
            )}

            {canDraw && !onOpenDrawingRequest && (
              <button
                id="btn-stmt-record-drawing"
                data-testid="button-stmt-record-drawing"
                type="button"
                aria-expanded={drawingOpen}
                onClick={() => setDrawingOpen((v) => !v)}
                className={`${actionBtn} bg-white hover:bg-amber-50 text-gray-950 border border-amber-400`}
                title="Record a partner drawing"
              >
                <PlusCircle className="w-3.5 h-3.5 text-amber-700" aria-hidden="true" />
                <span>{drawingOpen ? 'Close Drawing Form' : '+ Record Partner Drawing'}</span>
              </button>
            )}

            <button
              id="btn-export-csv"
              type="button"
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs transition-colors shadow-2xs cursor-pointer"
              title="Download consolidated CSV statement for Excel or Tally"
            >
              <Download className="w-4 h-4 text-gray-700" />
              <span>Export CSV</span>
            </button>

            <button
              id="btn-print-statement"
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs transition-colors shadow-2xs cursor-pointer"
              title="Print clean project account statement"
            >
              <Printer className="w-4 h-4 text-gray-700" />
              <span>Print</span>
            </button>
          </div>
        </div>

        {/* ======================================================== */}
        {/* 2. SUMMARY METRICS CARDS                                 */}
        {/* ======================================================== */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mt-5">
          {/* Card 1: Total Project Transactions */}
          <div className="bg-gray-50/80 rounded-2xl p-4 border border-gray-200 flex flex-col justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
              <FileCheck2 className="w-4 h-4 text-gray-700" />
              <span>Total Transactions</span>
            </span>
            <div className="my-2">
              <span className="text-2xl font-black text-gray-950">
                {filteredTransactions.length}
              </span>
              <span className="text-xs text-gray-500 ml-1">Entries</span>
            </div>
            <div className="text-[11px] font-semibold text-emerald-700 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{approvedCount} Affect cash</span>
              </span>
              {pendingCount > 0 && (
                <span className="px-1.5 py-0.2 bg-amber-100 text-amber-900 border border-amber-300 rounded-full font-bold text-[10px]">
                  {pendingCount} Needs correction
                </span>
              )}
            </div>
          </div>

          {/* Card 2: Total Inflows (Credits) */}
          <div className="bg-emerald-50/60 rounded-2xl p-4 border border-emerald-200 flex flex-col justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
              <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
              <span>Total Inflows (Credits)</span>
            </span>
            <div className="my-2">
              <span className="text-2xl font-black text-emerald-700 font-mono">
                {formatINR(totalInflows)}
              </span>
            </div>
            <div className="text-[11px] text-emerald-800">
              Customer advances, bookings &amp; partner capital
            </div>
          </div>

          {/* Card 3: Total Outflows (Debits) */}
          <div className="bg-rose-50/60 rounded-2xl p-4 border border-rose-200 flex flex-col justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-rose-800 flex items-center gap-1.5">
              <ArrowUpRight className="w-4 h-4 text-rose-600" />
              <span>Total Outflows (Debits)</span>
            </span>
            <div className="my-2">
              <span className="text-2xl font-black text-rose-700 font-mono">
                {formatINR(totalOutflows)}
              </span>
            </div>
            <div className="text-[11px] text-rose-800">
              Site outlays, vendor bills &amp; drawings
            </div>
          </div>

          {/* Card 4: Net Treasury & Liquid Bank Balance */}
          <div className="bg-amber-50/60 rounded-2xl p-4 border border-amber-200 flex flex-col justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-900 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-amber-700" />
                <span>Net Treasury Balance</span>
              </span>
              <span className="text-[10px] font-bold text-gray-500">Bank + Cash</span>
            </span>
            <div className="my-2">
              <span
                className={`text-2xl font-black font-mono ${
                  netCashFlow >= 0 ? 'text-gray-950' : 'text-rose-700'
                }`}
              >
                {netCashFlow >= 0 ? `+${formatINR(netCashFlow)}` : `-${formatINR(Math.abs(netCashFlow))}`}
              </span>
            </div>
            <div className="text-[11px] font-bold flex items-center justify-between gap-1 flex-wrap pt-1 border-t border-amber-200/80">
              <span className="text-blue-800 font-mono flex items-center gap-1">
                <Landmark className="w-3 h-3 text-blue-600" />
                <span>Bank: {formatINR(totalBankBalance)}</span>
              </span>
              <span className="text-emerald-800 font-mono flex items-center gap-1">
                <Wallet className="w-3 h-3 text-emerald-600" />
                <span>Cash: {formatINR(totalCashBalance)}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Project Bank & Cash Accounts Live Strip */}
        <div className="mt-4 pt-3.5 border-t border-gray-200/80">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold text-gray-600 flex items-center gap-1">
              <Landmark className="w-3.5 h-3.5 text-gray-800" />
              <span>Project Treasury Strip:</span>
            </span>
            {/* Bank Accounts */}
            {bankAccounts.map((acc) => (
              <div key={acc.id} className="flex items-center gap-2 bg-blue-50/80 px-3 py-1 rounded-xl border border-blue-200 shadow-2xs text-xs">
                <Landmark className="w-3.5 h-3.5 text-blue-700" />
                <span className="font-bold text-gray-900">{acc.bankName}</span>
                <span className="text-[10px] font-mono text-gray-500">••••{acc.accountNumber.slice(-4)}</span>
                <span className="font-black text-blue-800 font-mono">{formatINR(acc.currentBalance)}</span>
              </div>
            ))}
            {/* Cash Safe Vault Accounts */}
            {cashAccounts.map((acc) => (
              <div key={acc.id} className="flex items-center gap-2 bg-emerald-50/90 px-3 py-1 rounded-xl border border-emerald-300 shadow-2xs text-xs">
                <Wallet className="w-3.5 h-3.5 text-emerald-700" />
                <span className="font-bold text-emerald-950">{acc.accountName || 'Cash in Hand (Safe Vault)'}</span>
                <span className="font-black text-emerald-800 font-mono">{formatINR(acc.currentBalance)}</span>
              </div>
            ))}
            {/* If no separate cash account configured, display the calculated Available Cash in Hand card */}
            {cashAccounts.length === 0 && (
              <div className="flex items-center gap-2 bg-emerald-50/90 px-3 py-1 rounded-xl border border-emerald-300 shadow-2xs text-xs">
                <Wallet className="w-3.5 h-3.5 text-emerald-700" />
                <span className="font-bold text-emerald-950">Cash in Hand (Safe Vault):</span>
                <span className="font-black text-emerald-800 font-mono">{formatINR(totalCashBalance)}</span>
              </div>
            )}
            {/* Combined summary pill */}
            <div className="ml-auto text-[11px] font-bold text-gray-600 hidden md:flex items-center gap-1.5">
              <span>Total Available Liquid Funds:</span>
              <span className="font-mono text-gray-950 font-black px-2 py-0.5 bg-gray-100 rounded-lg border border-gray-300">
                {formatINR(totalBankBalance + totalCashBalance)}
              </span>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* 3. USER-FRIENDLY TOP FILTERS BAR                         */}
        {/* ======================================================== */}
        <div className="mt-6 pt-5 border-t border-gray-200 space-y-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-gray-800 flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-amber-600" />
              <span>Statement Filters &amp; Search</span>
            </span>
            <span className="text-xs text-gray-500 font-medium">
              Showing <strong>{filteredTransactions.length}</strong> of{' '}
              {allProjectTransactions.length} entries
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            {/* Filter 1: Search Box */}
            <div className="lg:col-span-2 relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="statement-search-input"
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search narration, ref #, enrolled person, or account..."
                className="w-full pl-10 pr-9 py-2.5 bg-gray-50 border border-gray-300 rounded-2xl text-xs font-semibold text-gray-950 focus:bg-white focus:ring-2 focus:ring-[#FFB800] outline-none"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Filter 2: Flow Type (All / Inflows / Outflows) */}
            <div>
              <select
                id="statement-flow-filter"
                value={flowFilter}
                onChange={(e) => setFlowFilter(e.target.value as any)}
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-2xl text-xs font-bold text-gray-950 focus:bg-white focus:ring-2 focus:ring-[#FFB800] outline-none cursor-pointer"
              >
                <option value="all">All Flows (Inflow &amp; Outflow)</option>
                <option value="credit">Inflows Only (Credits / Capital)</option>
                <option value="debit">Outflows Only (Debits / Expenses)</option>
              </select>
            </div>

            {/* Filter 3: Account Type / Vault Filter */}
            <div>
              <select
                id="statement-account-filter"
                value={accountFilter}
                onChange={(e) => setAccountFilter(e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-2xl text-xs font-bold text-gray-950 focus:bg-white focus:ring-2 focus:ring-[#FFB800] outline-none cursor-pointer"
              >
                <option value="all">All Accounts &amp; Vaults</option>
                <MasterOptions group="statement_account_groups" />
              </select>
            </div>

            {/* Filter 4: Category Filter */}
            <div>
              <select
                id="statement-category-filter"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-2xl text-xs font-bold text-gray-950 focus:bg-white focus:ring-2 focus:ring-[#FFB800] outline-none cursor-pointer"
              >
                <option value="all">All Categories</option>
                <MasterOptions group="statement_categories" />
              </select>
            </div>
            <div>
              <label htmlFor="statement-enrolled-by-filter" className="sr-only">Enrolled By</label>
              <select id="statement-enrolled-by-filter" aria-label="Enrolled By"
                value={enrolledByFilter === null ? 'all' : `person:${enrolledByFilter}`}
                onChange={(e) => setEnrolledByFilter(e.target.value === 'all' ? null : e.target.value.slice(7))}
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-2xl text-xs font-bold text-gray-950 focus:bg-white focus:ring-2 focus:ring-[#FFB800] outline-none cursor-pointer">
                <option value="all">Enrolled By: Everyone</option>
                {enrolledByOptions.map((person) => <option key={person} value={`person:${person}`}>{person || 'No recorded name'}</option>)}
              </select>
            </div>

          </div>

          {/* Quick Active Filter Pills & Reset */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-gray-400 font-semibold mr-1">Quick Flow:</span>
              <button
                type="button"
                onClick={() => setFlowFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors ${
                  flowFilter === 'all'
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setFlowFilter('credit')}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors ${
                  flowFilter === 'credit'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                }`}
              >
                + Inflows ({allProjectTransactions.filter((t) => t.type === 'credit').length})
              </button>
              <button
                type="button"
                onClick={() => setFlowFilter('debit')}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors ${
                  flowFilter === 'debit'
                    ? 'bg-rose-600 text-white'
                    : 'bg-rose-50 text-rose-800 hover:bg-rose-100'
                }`}
              >
                - Outflows ({allProjectTransactions.filter((t) => t.type === 'debit').length})
              </button>

              <span className="text-[11px] text-gray-400 font-semibold ml-2 mr-1">Vault:</span>
              <button
                type="button"
                onClick={() => setAccountFilter('all')}
                className={`px-2 py-1 rounded-lg font-bold text-[11px] transition-colors ${
                  accountFilter === 'all'
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setAccountFilter('rera_escrow')}
                className={`px-2 py-1 rounded-lg font-bold text-[11px] transition-colors flex items-center gap-1 ${
                  accountFilter === 'rera_escrow'
                    ? 'bg-blue-600 text-white'
                    : 'bg-blue-50 text-blue-800 hover:bg-blue-100'
                }`}
              >
                <Landmark className="w-3 h-3" />
                <span>Bank ({allProjectTransactions.filter((t) => !t.paymentMode?.toLowerCase().includes('cash') && !t.accountName.toLowerCase().includes('cash')).length})</span>
              </button>
              <button
                type="button"
                onClick={() => setAccountFilter('petty_cash')}
                className={`px-2 py-1 rounded-lg font-bold text-[11px] transition-colors flex items-center gap-1 ${
                  accountFilter === 'petty_cash'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                }`}
              >
                <Wallet className="w-3 h-3" />
                <span>Cash in Hand ({allProjectTransactions.filter((t) => t.paymentMode?.toLowerCase().includes('cash') || t.accountName.toLowerCase().includes('cash')).length})</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => changeSort('date')}
                className="text-xs text-gray-600 hover:text-gray-950 font-bold flex items-center gap-1 cursor-pointer"
              >
                <span>{sortKey === 'date' ? `Date: ${sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}` : 'Sort by Date'}</span>
                <RefreshCw className="w-3 h-3 text-gray-400" />
              </button>

              {(searchTerm || flowFilter !== 'all' || categoryFilter !== 'all' || accountFilter !== 'all' || enrolledByFilter !== null) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setFlowFilter('all');
                    setAccountFilter('all');
                    setCategoryFilter('all');
                    setEnrolledByFilter(null);
                  }}
                  className="text-xs text-amber-800 hover:underline font-bold"
                >
                  Clear All Filters
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 4. STATEMENT TRANSACTIONS TABLE                         */}
      {/* ======================================================== */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
        {filteredTransactions.length === 0 ? (
          <div className="py-16 px-4 text-center">
            <Receipt className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h4 className="text-base font-bold text-gray-800">No project transactions match your criteria</h4>
            <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
              No project transactions match your criteria. Try adjusting your search keywords or resetting your flow and category filters above to view all readable passbook entries.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setFlowFilter('all');
                setCategoryFilter('all');
                setAccountFilter('all');
                setEnrolledByFilter(null);
              }}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gray-950 text-white font-bold text-xs shadow-sm hover:bg-gray-800 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#FFB800]" />
              <span>Reset All Filters</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-black uppercase tracking-wider text-[10px]">
                <tr>
                  {sortableHeading('date', 'Date')}
                  {sortableHeading('referenceNo', 'Voucher / Ref #')}
                  {sortableHeading('description', 'Narration & Category')}
                  {sortableHeading('accountName', 'Account / Treasury')}
                  {sortableHeading('enrolledBy', 'Enrolled By')}
                  <th className="py-3.5 px-4">Actions</th>
                  {sortableHeading('amount', 'Amount', true)}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredTransactions.map((tx) => (
                  <tr
                    key={tx.id}
                    className="hover:bg-amber-50/30 transition-colors group"
                  >
                    {/* 1. Date */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 font-bold text-gray-900">
                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                        <span>{tx.date}</span>
                      </div>
                      <span className="text-[10px] text-gray-400 block font-mono">
                        {tx.paymentMode || 'RTGS / Bank'}
                      </span>
                    </td>

                    {/* 2. Voucher / Ref # */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="font-mono font-bold text-gray-800 bg-gray-100 px-2 py-0.5 rounded-md border border-gray-200 text-[11px] block max-w-fit">
                        {tx.referenceNo}
                      </span>
                    </td>

                    {/* 3. Description & Category */}
                    <td className="py-3.5 px-4 max-w-xs sm:max-w-sm">
                      <div className="font-bold text-gray-950 truncate block">
                        {tx.description}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] font-bold text-amber-900 bg-amber-100/70 px-2 py-0.2 rounded-md">
                          {tx.categoryLabel}
                        </span>
                        {tx.notes && (
                          <span className="text-[10px] text-gray-500 italic truncate max-w-[180px]">
                            • {tx.notes}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* 4. Account / Treasury */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Landmark className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                        <span className="font-bold text-gray-900">{tx.accountName}</span>
                      </div>
                      <span className="text-[10px] text-gray-500 block">
                        {tx.accountTypeLabel}
                      </span>
                    </td>

                    {/* 5. Enrolled By (Person who enrolled the entry) */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-amber-100 text-amber-950 flex items-center justify-center font-black text-[9px] shrink-0 border border-amber-300">
                          <User className="w-3 h-3" />
                        </div>
                        <span className="font-bold text-gray-900">{tx.enrolledBy}</span>
                      </div>
                    </td>

                    {/* 6. Actions */}
                    <td className="py-3.5 px-4 whitespace-nowrap" data-testid={`cell-actions-${tx.id}`}>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black border ${
                        tx.postingState === 'reversal' ? 'bg-rose-50 text-rose-800 border-rose-200'
                        : tx.postingState === 'superseded' || tx.postingState === 'referred_back' ? 'bg-gray-100 text-gray-600 border-gray-300'
                        : tx.postingState === 'legacy_unposted' ? 'bg-amber-50 text-amber-900 border-amber-300'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-200'}`} data-testid={`text-posting-${tx.id}`}>
                        {postingLabel(tx.postingState)}
                      </span>
                      {tx.correctionReason && <span className="block text-[10px] text-gray-500 mt-0.5 max-w-[180px] truncate" title={tx.correctionReason}>{tx.correctionReason}</span>}
                      <div className="flex gap-1.5 mt-1">
                        {tx.canReferBack && onReferBackFinancial && (
                          <button type="button" data-testid={`button-refer-back-${tx.id}`} onClick={() => setDialog({ mode: 'refer-back', entry: tx })}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100 font-bold text-[10px]">
                            <RotateCcw className="w-3 h-3" /> Refer Back
                          </button>
                        )}
                        {tx.canResubmit && onResubmitFinancial && (
                          <button type="button" data-testid={`button-resubmit-${tx.id}`} onClick={() => setDialog({ mode: 'resubmit', entry: tx })}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100 font-bold text-[10px]">
                            <PencilLine className="w-3 h-3" /> Correct &amp; Resubmit
                          </button>
                        )}
                      </div>
                    </td>

                    {/* 8. Amount */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <span
                        className={`text-sm font-black font-mono block ${
                          tx.type === 'credit' ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {tx.type === 'credit' ? '+' : '-'}
                        {formatINR(tx.amount)}
                      </span>
                      {!countsForCash(tx) && <span className="text-[10px] text-gray-400 block">Not in balance</span>}
                      {balances.has(tx.id) && (
                        <span className="text-[10px] text-gray-400 block font-mono">
                          Bal: {formatINR(balances.get(tx.id) as number)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Statement Footer */}
        <div className="bg-gray-50 px-5 py-3.5 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-gray-500">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>
              Real-time multi-bank and ground operational synchronization active for <strong>{project ? project.name : firm.name}</strong>.
            </span>
          </div>

          <div className="flex items-center gap-4 text-gray-700">
            <span>
              Inflows: <strong className="text-emerald-700 font-mono font-bold">+{formatINR(totalInflows)}</strong>
            </span>
            <span>•</span>
            <span>
              Outflows: <strong className="text-rose-700 font-mono font-bold">-{formatINR(totalOutflows)}</strong>
            </span>
            <span>•</span>
            <span>
              Net: <strong className="text-gray-950 font-mono font-bold">{formatINR(netCashFlow)}</strong>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
