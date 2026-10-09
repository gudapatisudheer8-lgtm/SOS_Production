import React, { useState } from 'react';
import { FirmAccount, FirmAccountType, TenantFirm, Project } from '../../types';
import {
  Landmark,
  PlusCircle,
  CreditCard,
  Building2,
  Wallet,
  ShieldCheck,
  Lock,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  ArrowUpRight,
  ArrowDownLeft,
  FileSpreadsheet,
  Star,
  ExternalLink,
  Coins,
  CheckCircle2,
  Sparkles,
  ArrowUpDown
} from 'lucide-react';
import { formatINR } from '../../utils/formatters';
import { RecordLedgerTransactionModal } from '../modals/RecordLedgerTransactionModal';

interface FirmAccountsBarProps {
  firm: TenantFirm;
  accounts: FirmAccount[];
  projects: Project[];
  activeProjectId: string;
  onOpenAddAccountModal: () => void;
  onOpenStatementModal: (account: FirmAccount) => void;
  onAddTransaction?: (accountId: string, tx: any) => void;
}

export const FirmAccountsBar: React.FC<FirmAccountsBarProps> = ({
  firm,
  accounts,
  projects,
  activeProjectId,
  onOpenAddAccountModal,
  onOpenStatementModal,
  onAddTransaction = () => {},
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isRecordTxModalOpen, setIsRecordTxModalOpen] = useState(false);
  const [preselectedAccountId, setPreselectedAccountId] = useState<string | undefined>(undefined);

  // Filter accounts belonging strictly to this firm, focused on active project
  const firmAccounts = accounts.filter((acc) => !acc.firmId || acc.firmId === firm.id);
  const activeProjectObj = projects.find((p) => p.id === activeProjectId);

  // Accounts strictly for this active project:
  // - Cash accounts (field_petty_cash) are universally accessible across all projects of the firm
  // - Bank accounts strictly belong to this active project and do not leak
  const projectAccounts = activeProjectId
    ? firmAccounts.filter(
        (acc) =>
          acc.accountType === 'field_petty_cash' ||
          acc.linkedProjectId === activeProjectId
      )
    : firmAccounts;

  // Filter by selected account type tab
  const displayedAccounts = projectAccounts.filter((acc) => {
    if (filterType === 'all') return true;
    return acc.accountType === filterType;
  });

  // Calculate separate bank liquidity vs available cash in hand strictly for project
  const bankAccounts = projectAccounts.filter((a) => a.accountType !== 'field_petty_cash');
  const bankLiquidityTotal = bankAccounts.reduce((sum, a) => sum + (a.currentBalance || 0), 0);
  const cashAccounts = projectAccounts.filter((a) => a.accountType === 'field_petty_cash');
  const availableCashTotal = cashAccounts.reduce((sum, a) => sum + (a.currentBalance || 0), 0);
  const totalLiquidity = bankLiquidityTotal + availableCashTotal;

  const reraEscrowTotal = projectAccounts
    .filter((a) => a.accountType === 'rera_escrow')
    .reduce((sum, a) => sum + (a.currentBalance || 0), 0);
  const syndicateCapitalTotal = projectAccounts
    .filter((a) => a.accountType === 'syndicate_capital_pool')
    .reduce((sum, a) => sum + (a.currentBalance || 0), 0);
  const operationalTotal = projectAccounts
    .filter((a) => a.accountType === 'current_operational')
    .reduce((sum, a) => sum + (a.currentBalance || 0), 0);
  const pettyCashTotal = projectAccounts
    .filter((a) => a.accountType === 'field_petty_cash')
    .reduce((sum, a) => sum + (a.currentBalance || 0), 0);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getAccountTypeBadge = (type: FirmAccountType) => {
    switch (type) {
      case 'rera_escrow':
        return { label: 'RERA Escrow', color: 'bg-emerald-100 text-emerald-900 border-emerald-300' };
      case 'syndicate_capital_pool':
        return { label: 'Capital Pool', color: 'bg-indigo-100 text-indigo-900 border-indigo-300' };
      case 'current_operational':
        return { label: 'Current A/c', color: 'bg-blue-100 text-blue-900 border-blue-300' };
      case 'field_petty_cash':
        return { label: 'Cash Vault', color: 'bg-amber-100 text-amber-900 border-amber-300' };
      case 'tax_statutory':
        return { label: 'Tax / GST', color: 'bg-purple-100 text-purple-900 border-purple-300' };
      default:
        return { label: 'General A/c', color: 'bg-gray-100 text-gray-900 border-gray-300' };
    }
  };

  const getBankColorBorder = (bankName: string) => {
    const b = bankName.toLowerCase();
    if (b.includes('state bank') || b.includes('sbi')) return 'border-t-4 border-t-sky-600';
    if (b.includes('hdfc')) return 'border-t-4 border-t-blue-800';
    if (b.includes('icici')) return 'border-t-4 border-t-amber-700';
    if (b.includes('axis')) return 'border-t-4 border-t-rose-700';
    if (b.includes('kotak')) return 'border-t-4 border-t-red-600';
    if (b.includes('cash') || b.includes('vault')) return 'border-t-4 border-t-emerald-600';
    return 'border-t-4 border-t-gray-700';
  };

  return (
    <div id="firm-accounts-bar" className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-gray-200 space-y-4">
      {/* Top Header of the Account Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#111827] text-[#FFB800] flex items-center justify-center font-black shadow-sm shrink-0">
            <Landmark className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-black text-gray-950 flex items-center gap-1.5">
                Project Bank Accounts &amp; Treasury
              </h3>
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-950 border border-amber-300">
                {projectAccounts.length} Accounts
              </span>
              <span className="text-xs text-gray-400">•</span>
              <span className="text-xs font-semibold text-gray-700 flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200">
                <Landmark className="w-3.5 h-3.5 text-blue-600" />
                <span>Bank:</span>
                <strong className="text-blue-900 font-mono">{formatINR(bankLiquidityTotal)}</strong>
              </span>
              <span className="text-xs font-semibold text-emerald-800 flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                <Wallet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Available Cash:</span>
                <strong className="text-emerald-950 font-mono">{formatINR(availableCashTotal)}</strong>
              </span>
              <span className="text-xs text-gray-400">•</span>
              <span className="text-xs font-semibold text-gray-600">
                Total: <strong className="text-gray-950 font-mono">{formatINR(totalLiquidity)}</strong>
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Dedicated statutory RERA escrow ledgers, operational accounts, and site cash vaults for{' '}
              <strong className="text-gray-900">{activeProjectObj ? `${activeProjectObj.name} (${activeProjectObj.code})` : firm.name}</strong>
            </p>
          </div>
        </div>

        {/* Right Action Buttons in the Bar */}
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          {/* RECORD INCOMING / OUTGOING BANK TRANSACTION BUTTON */}
          <button
            id="btn-record-bank-transaction"
            type="button"
            onClick={() => {
              setPreselectedAccountId(undefined);
              setIsRecordTxModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gray-950 hover:bg-gray-800 text-amber-400 font-bold text-xs shadow-sm hover:shadow transition-all shrink-0 cursor-pointer"
            title="Record an Incoming Credit (Inflow) or Outgoing Debit (Payout) on any Project Bank Account"
          >
            <ArrowUpDown className="w-4 h-4 text-[#FFB800]" />
            <span>+ Record Transaction</span>
          </button>

          {/* THE UI TO ADD PROJECT ACCOUNTS */}
          <button
            id="btn-add-firm-account"
            type="button"
            onClick={onOpenAddAccountModal}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#FFB800] hover:bg-amber-400 text-gray-950 font-black text-xs shadow-sm hover:shadow transition-all border border-amber-500/40 shrink-0 cursor-pointer"
            title="Add a new Dedicated Bank Account, RERA Escrow, or Syndicate Capital Account to this Project"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ Add Project Account</span>
          </button>

          {/* Toggle Expand/Collapse */}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2.5 rounded-2xl border border-gray-200 text-gray-600 hover:text-gray-950 hover:bg-gray-100 transition-colors cursor-pointer"
            title={isExpanded ? 'Collapse Accounts Bar' : 'Expand Accounts Bar'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded Account Bar Content */}
      {isExpanded && (
        <div className="space-y-4 pt-2 border-t border-gray-100">
          {/* Quick Filter Tabs & Liquidity Metric Chips */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
              {[
                { id: 'all', label: 'All Accounts', count: projectAccounts.length },
                { id: 'rera_escrow', label: 'RERA Escrow', count: projectAccounts.filter(a => a.accountType === 'rera_escrow').length },
                { id: 'syndicate_capital_pool', label: 'Capital Pool', count: projectAccounts.filter(a => a.accountType === 'syndicate_capital_pool').length },
                { id: 'current_operational', label: 'Commercial Current', count: projectAccounts.filter(a => a.accountType === 'current_operational').length },
                { id: 'field_petty_cash', label: 'Cash in Hand (Safe Vault)', count: projectAccounts.filter(a => a.accountType === 'field_petty_cash').length },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterType(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer ${
                    filterType === tab.id
                      ? 'bg-gray-950 text-white shadow-2xs'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    filterType === tab.id ? 'bg-amber-400 text-gray-950 font-black' : 'bg-white text-gray-600'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Statutory Compliance Indicator */}
            <div className="flex items-center gap-3 text-xs text-gray-500 hidden xl:flex">
              <span className="flex items-center gap-1 text-blue-700 font-semibold bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200">
                <Landmark className="w-3.5 h-3.5 text-blue-600" />
                Bank Balance: {formatINR(bankLiquidityTotal)}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 text-emerald-800 font-semibold bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                <Wallet className="w-3.5 h-3.5 text-emerald-600" />
                Available Cash: {formatINR(availableCashTotal)}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 text-indigo-700 font-semibold">
                <Coins className="w-3.5 h-3.5" />
                Total Treasury: {formatINR(totalLiquidity)}
              </span>
            </div>
          </div>

          {/* Grid of Accounts in the Bar */}
          {displayedAccounts.length === 0 ? (
            <div className="py-8 px-4 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-300">
              <Landmark className="w-10 h-10 text-gray-400 mx-auto mb-2" />
              <p className="text-sm font-bold text-gray-800">No project bank accounts registered in this category</p>
              <p className="text-xs text-gray-500 mt-1 mb-4">
                Register dedicated RERA escrow, capital pool, or current operational accounts for {activeProjectObj ? activeProjectObj.name : 'this project'}.
              </p>
              <button
                type="button"
                onClick={onOpenAddAccountModal}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FFB800] text-gray-950 font-black text-xs shadow-xs cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>+ Add Project Account Now</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {displayedAccounts.map((account) => {
                const badge = getAccountTypeBadge(account.accountType);
                const borderClass = getBankColorBorder(account.bankName);
                const linkedProject = projects.find((p) => p.id === account.linkedProjectId);

                return (
                  <div
                    key={account.id}
                    className={`bg-white rounded-2xl p-4 shadow-2xs border border-gray-200/90 hover:border-amber-400 hover:shadow-md transition-all flex flex-col justify-between ${borderClass}`}
                  >
                    <div>
                      {/* Top Badges & Primary Star */}
                      <div className="flex items-center justify-between gap-1 mb-2">
                        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${badge.color}`}>
                          {badge.label}
                        </span>

                        <div className="flex items-center gap-1">
                          {account.isPrimary && (
                            <span className="flex items-center gap-0.5 text-[9px] font-extrabold uppercase bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.5 rounded">
                              <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-600" />
                              Primary
                            </span>
                          )}
                          <span className="text-[10px] font-bold text-gray-400">
                            {account.bankName}
                          </span>
                        </div>
                      </div>

                      {/* Account Title */}
                      <h4 className="text-xs font-black text-gray-950 line-clamp-1" title={account.accountName}>
                        {account.accountName}
                      </h4>

                      {/* Account Number & IFSC with copy button */}
                      <div className="mt-2 bg-gray-50/90 p-2 rounded-xl border border-gray-100 flex items-center justify-between text-[11px]">
                        <div className="min-w-0">
                          <p className="font-mono font-bold text-gray-900 truncate">
                            {account.accountType === 'field_petty_cash'
                              ? account.accountNumber
                              : `•••• ${account.accountNumber.slice(-4) || account.accountNumber}`}
                          </p>
                          <p className="text-[10px] text-gray-500 font-mono uppercase truncate">
                            IFSC: {account.ifscCode}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopy(account.id, `${account.accountNumber} (${account.ifscCode})`)}
                          className="p-1 text-gray-400 hover:text-gray-900 transition-colors rounded hover:bg-gray-200"
                          title="Copy Account Number & IFSC"
                        >
                          {copiedId === account.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>

                      {/* Live Balance in Indian Rupees */}
                      <div className="mt-3">
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tight block">
                          Current Ledger Balance
                        </span>
                        <span className="text-base font-black font-mono text-gray-950 block">
                          {formatINR(account.currentBalance)}
                        </span>
                      </div>

                      {/* Linked Project info */}
                      <div className="mt-2 text-[10px] text-gray-500 flex items-center gap-1 truncate">
                        <span className="font-bold text-gray-600">Routing:</span>
                        <span className="truncate">
                          {account.linkedProjectId === 'all' || !account.linkedProjectId
                            ? 'All Firm Ventures'
                            : linkedProject ? linkedProject.name : 'Linked Project'}
                        </span>
                      </div>
                    </div>

                    {/* Bottom Card Footer Actions */}
                    <div className="pt-3 mt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenStatementModal(account)}
                        className="text-xs font-bold text-amber-800 hover:text-amber-950 flex items-center gap-1 transition-colors"
                      >
                        <FileSpreadsheet className="w-3 h-3 text-amber-700" />
                        <span>Passbook / Ledger</span>
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setPreselectedAccountId(account.id);
                            setIsRecordTxModalOpen(true);
                          }}
                          className="px-2 py-0.5 text-emerald-800 hover:text-emerald-950 text-[10px] font-bold bg-emerald-100/80 hover:bg-emerald-200 border border-emerald-300 rounded-md transition-colors"
                          title="Record Incoming Credit Deposit into this account"
                        >
                          + Inflow
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPreselectedAccountId(account.id);
                            setIsRecordTxModalOpen(true);
                          }}
                          className="px-2 py-0.5 text-rose-800 hover:text-rose-950 text-[10px] font-bold bg-rose-100/80 hover:bg-rose-200 border border-rose-300 rounded-md transition-colors"
                          title="Record Outgoing Debit Payout from this account"
                        >
                          - Outflow
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Record Ledger Transaction Modal */}
      <RecordLedgerTransactionModal
        isOpen={isRecordTxModalOpen}
        onClose={() => setIsRecordTxModalOpen(false)}
        firm={firm}
        accounts={accounts}
        projects={projects}
        preselectedAccountId={preselectedAccountId}
        onAddTransaction={onAddTransaction}
      />
    </div>
  );
};
