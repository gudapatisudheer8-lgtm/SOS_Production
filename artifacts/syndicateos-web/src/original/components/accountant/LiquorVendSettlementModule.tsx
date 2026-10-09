import React, { useState } from 'react';
import { LiquorDailySettlement, PartnerStockDraw, SyndicatePartner, TenantFirm } from '../../types';
import { formatINR, formatIndianCompact } from '../../utils/formatters';
import {
  Wine,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  Building,
  RotateCcw,
  Calendar,
  DollarSign
} from 'lucide-react';

interface LiquorVendSettlementModuleProps {
  firm: TenantFirm;
  partners: SyndicatePartner[];
  settlements: LiquorDailySettlement[];
  onAddSettlement: (settlement: LiquorDailySettlement) => void;
  partnerStockDraws: PartnerStockDraw[];
  onAddStockDraw: (draw: PartnerStockDraw) => void;
}

export const LiquorVendSettlementModule: React.FC<LiquorVendSettlementModuleProps> = ({
  firm,
  partners,
  settlements,
  onAddSettlement,
  partnerStockDraws,
  onAddStockDraw,
}) => {
  const [activeTab, setActiveTab] = useState<'counter_settlements' | 'partner_stock_draws'>('counter_settlements');

  // New Counter Settlement Form State
  const [showAddSettlementModal, setShowAddSettlementModal] = useState(false);
  const [counterName, setCounterName] = useState('Hanamkonda Main Chowrasta Vend #01');
  const [openingBottles, setOpeningBottles] = useState<number>(1400);
  const [receivedBottles, setReceivedBottles] = useState<number>(300);
  const [closingBottles, setClosingBottles] = useState<number>(1320);
  const [avgBottlePrice, setAvgBottlePrice] = useState<number>(900);
  const [cashCollected, setCashCollected] = useState<number>(270000);
  const [upiCollected, setUpiCollected] = useState<number>(72000);
  const [settledBy, setSettledBy] = useState('V. Srinivasa Chary (Accountant)');

  // New Partner Stock Draw Form State
  const [showAddStockDrawModal, setShowAddStockDrawModal] = useState(false);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>(partners[0]?.id || 'partner-a');
  const [stockDetails, setStockDetails] = useState('2 Cases (24 Bottles) 100 Pipers Blended Scotch');
  const [bottlesCount, setBottlesCount] = useState<number>(24);
  const [retailValuation, setRetailValuation] = useState<number>(43200);
  const [purpose, setPurpose] = useState('Syndicate institutional partner hospitality event');

  // Computed values for new settlement
  const computedBottlesSold = Math.max(0, openingBottles + receivedBottles - closingBottles);
  const computedGrossSales = computedBottlesSold * avgBottlePrice;
  const computedTotalCollected = cashCollected + upiCollected;
  const computedShortage = computedGrossSales - computedTotalCollected;

  // Aggregate metrics
  const totalGrossTurnover = settlements.reduce((acc, s) => acc + s.grossSalesValue, 0);
  const totalCashTurnover = settlements.reduce((acc, s) => acc + s.cashCollected, 0);
  const totalUpiTurnover = settlements.reduce((acc, s) => acc + s.upiCollected, 0);
  const totalStockDrawValuation = partnerStockDraws.reduce((acc, d) => acc + d.retailValuation, 0);

  const handleCreateSettlement = (e: React.FormEvent) => {
    e.preventDefault();
    const newRecord: LiquorDailySettlement = {
      id: `liq-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      counterName,
      openingBottles,
      receivedBottles,
      closingBottles,
      bottlesSold: computedBottlesSold,
      grossSalesValue: computedGrossSales,
      cashCollected,
      upiCollected,
      counterShortage: computedShortage > 0 ? computedShortage : 0,
      settledBy,
      status: computedShortage > 0 ? 'variance_flagged' : 'reconciled',
      bankDepositSlipNo: `SBI-DEP-${Math.floor(100000 + Math.random() * 900000)}`,
    };

    onAddSettlement(newRecord);
    setShowAddSettlementModal(false);
  };

  const handleCreateStockDraw = (e: React.FormEvent) => {
    e.preventDefault();
    const partner = partners.find((p) => p.id === selectedPartnerId) || partners[0];
    const newDraw: PartnerStockDraw = {
      id: `psd-${Date.now()}`,
      partnerId: partner.id,
      partnerName: partner.name,
      date: new Date().toISOString().split('T')[0],
      stockDetails,
      bottlesCount,
      retailValuation,
      purpose,
      deductedFromPayout: true,
      authorizedBy: 'Managing Partner Quorum (Signed)',
    };

    onAddStockDraw(newDraw);
    setShowAddStockDrawModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Module Overview Header */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
              Retail & Liquor Vends Syndicate Engine
            </span>
            <span className="text-xs text-gray-500 font-mono">Excise Depot: Warangal / Hanamkonda</span>
          </div>
          <h2 className="text-xl font-black text-gray-950 mt-1 flex items-center gap-2">
            <Wine className="w-6 h-6 text-[#FFB800]" />
            <span>Daily Counter Settlement & Partner Barter Engine</span>
          </h2>
          <p className="text-xs text-gray-600 mt-0.5">
            Real-time physical stock reconciliation: Opening + Receipts - Closing = Bottles Sold. Tracks Cash vs. Digital UPI and auto-deducts direct partner stock draws from monthly profit payouts.
          </p>
        </div>

        {/* Sub-Tabs: Counter Settlement vs Partner Barter */}
        <div className="flex items-center bg-[#F4F4F6] p-1.5 rounded-full border border-gray-200">
          <button
            onClick={() => setActiveTab('counter_settlements')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
              activeTab === 'counter_settlements'
                ? 'bg-[#111827] text-white shadow'
                : 'text-gray-600 hover:text-gray-950'
            }`}
          >
            Daily Counter Settlement
          </button>
          <button
            onClick={() => setActiveTab('partner_stock_draws')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
              activeTab === 'partner_stock_draws'
                ? 'bg-[#111827] text-white shadow'
                : 'text-gray-600 hover:text-gray-950'
            }`}
          >
            Partner Barter / Stock Log
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-200">
          <span className="text-[11px] font-bold uppercase text-gray-500 block">Gross Retail Turnover</span>
          <strong className="text-xl font-black text-gray-950 font-mono mt-1 block">
            {formatINR(totalGrossTurnover)}
          </strong>
          <span className="text-[10px] text-emerald-600 font-bold mt-0.5 block flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> Reconciled Across Outlets
          </span>
        </div>

        <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-200">
          <span className="text-[11px] font-bold uppercase text-gray-500 block">Cash Collected (Physical)</span>
          <strong className="text-xl font-black text-gray-950 font-mono mt-1 block">
            {formatINR(totalCashTurnover)}
          </strong>
          <span className="text-[10px] text-gray-500 block mt-0.5">Deposited in night drop vault</span>
        </div>

        <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-200">
          <span className="text-[11px] font-bold uppercase text-gray-500 block">Digital UPI / QR Volume</span>
          <strong className="text-xl font-black text-emerald-700 font-mono mt-1 block">
            {formatINR(totalUpiTurnover)}
          </strong>
          <span className="text-[10px] text-gray-500 block mt-0.5">Credited to firm current account</span>
        </div>

        <div className="bg-white p-5 rounded-3xl shadow-sm border border-amber-200 bg-[#FFFDF0]">
          <span className="text-[11px] font-bold uppercase text-amber-800 block">Partner Stock Draws Val.</span>
          <strong className="text-xl font-black text-amber-900 font-mono mt-1 block">
            {formatINR(totalStockDrawValuation)}
          </strong>
          <span className="text-[10px] text-amber-700 font-bold block mt-0.5">Deducted from profit payouts</span>
        </div>
      </div>

      {/* TAB 1: DAILY COUNTER SETTLEMENTS */}
      {activeTab === 'counter_settlements' && (
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-200 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-200">
            <div>
              <h3 className="text-base font-black text-gray-950">Daily Outlet Reconciliation Register</h3>
              <p className="text-xs text-gray-500">
                Opening Stock + Inward Stock Challans - Closing Stock = Total Units Sold.
              </p>
            </div>

            <button
              id="btn-add-liquor-settlement"
              onClick={() => setShowAddSettlementModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#FFB800] hover:bg-amber-400 text-gray-950 text-xs font-black rounded-full shadow transition-all active:scale-95 border border-amber-600/30"
            >
              <Plus className="w-4 h-4" />
              <span>Record Evening Settlement</span>
            </button>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider text-[11px]">
                  <th className="pb-3 px-3">Date & Counter</th>
                  <th className="pb-3 px-3">Stock Audit (Bottles)</th>
                  <th className="pb-3 px-3">Units Sold</th>
                  <th className="pb-3 px-3">Gross Sales (₹)</th>
                  <th className="pb-3 px-3">Cash vs. UPI (₹)</th>
                  <th className="pb-3 px-3">Variance / Shortage</th>
                  <th className="pb-3 px-3 text-right">Settlement Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {settlements.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3.5 px-3">
                      <div className="font-bold text-gray-900">{s.counterName}</div>
                      <div className="text-[11px] text-gray-500 flex items-center gap-1 font-mono">
                        <Calendar className="w-3 h-3" /> {s.date} • Settled by: {s.settledBy}
                      </div>
                    </td>

                    <td className="py-3.5 px-3 font-mono text-[11px] text-gray-700">
                      <div>Open: <strong>{s.openingBottles}</strong></div>
                      <div>Recv: <strong className="text-emerald-600">+{s.receivedBottles}</strong></div>
                      <div>Close: <strong>{s.closingBottles}</strong></div>
                    </td>

                    <td className="py-3.5 px-3 font-mono font-bold text-gray-900 text-sm">
                      {s.bottlesSold} <span className="text-[10px] text-gray-500 font-normal">units</span>
                    </td>

                    <td className="py-3.5 px-3 font-mono font-black text-gray-950 text-sm">
                      {formatINR(s.grossSalesValue)}
                    </td>

                    <td className="py-3.5 px-3 text-[11px]">
                      <div className="text-gray-900">Cash: <strong className="font-mono">{formatINR(s.cashCollected)}</strong></div>
                      <div className="text-emerald-700">UPI: <strong className="font-mono">{formatINR(s.upiCollected)}</strong></div>
                    </td>

                    <td className="py-3.5 px-3">
                      {s.counterShortage > 0 ? (
                        <span className="inline-flex items-center gap-1 text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded-full border border-red-200 text-[11px]">
                          <AlertTriangle className="w-3 h-3" /> Short: -{formatINR(s.counterShortage)}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 text-[11px]">
                          <CheckCircle2 className="w-3 h-3" /> Zero Shortage
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-3 text-right">
                      <span className="font-bold text-[11px] bg-gray-100 text-gray-800 px-2.5 py-1 rounded-full border border-gray-200 inline-block">
                        Bank Ref: {s.bankDepositSlipNo}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: PARTNER BARTER & DIRECT STOCK LOG */}
      {activeTab === 'partner_stock_draws' && (
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-200 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-200">
            <div>
              <h3 className="text-base font-black text-gray-950">Partner Inventory Barter & Direct Draws</h3>
              <p className="text-xs text-gray-500">
                Direct stock withdrawals by syndicate partners for personal/hospitality needs. Retail valuation is automatically deducted from monthly syndicate profit distributions.
              </p>
            </div>

            <button
              id="btn-add-partner-stock-draw"
              onClick={() => setShowAddStockDrawModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#FFB800] hover:bg-amber-400 text-gray-950 text-xs font-black rounded-full shadow transition-all active:scale-95 border border-amber-600/30"
            >
              <Plus className="w-4 h-4" />
              <span>Log Partner Stock Draw</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider text-[11px]">
                  <th className="pb-3 px-3">Partner Name</th>
                  <th className="pb-3 px-3">Date</th>
                  <th className="pb-3 px-3">Items / Stock Description</th>
                  <th className="pb-3 px-3">Bottles / Cases</th>
                  <th className="pb-3 px-3">Retail Valuation (₹)</th>
                  <th className="pb-3 px-3">Purpose</th>
                  <th className="pb-3 px-3 text-right">Profit Deduction</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {partnerStockDraws.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3.5 px-3 font-bold text-gray-900">
                      {d.partnerName}
                    </td>

                    <td className="py-3.5 px-3 text-gray-600 font-mono">
                      {d.date}
                    </td>

                    <td className="py-3.5 px-3 text-gray-900 font-medium">
                      {d.stockDetails}
                    </td>

                    <td className="py-3.5 px-3 font-mono font-bold text-gray-800">
                      {d.bottlesCount} bottles
                    </td>

                    <td className="py-3.5 px-3 font-mono font-black text-amber-900 text-sm">
                      {formatINR(d.retailValuation)}
                    </td>

                    <td className="py-3.5 px-3 text-gray-600 italic">
                      "{d.purpose}"
                    </td>

                    <td className="py-3.5 px-3 text-right">
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" /> Deducted from Payout
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: RECORD EVENING SETTLEMENT */}
      {showAddSettlementModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 max-w-lg w-full overflow-hidden">
            <div className="bg-[#FFB800] p-5 flex items-center justify-between border-b border-amber-500/40">
              <h3 className="font-black text-gray-950 text-base flex items-center gap-2">
                <Wine className="w-5 h-5" />
                <span>Evening Counter Settlement Log</span>
              </h3>
              <button
                onClick={() => setShowAddSettlementModal(false)}
                className="text-gray-900 font-bold p-1 rounded-full hover:bg-black/10"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSettlement} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-gray-700 font-bold mb-1">Select Outlet / Vend:</label>
                <select
                  value={counterName}
                  onChange={(e) => setCounterName(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2.5 font-medium text-gray-900 text-xs focus:ring-2 focus:ring-amber-500"
                >
                  <option value="Hanamkonda Main Chowrasta Vend #01">Hanamkonda Main Chowrasta Vend #01</option>
                  <option value="Warangal Station Road Outlet #02">Warangal Station Road Outlet #02</option>
                  <option value="Kazipet Highway Bypass Vend #03">Kazipet Highway Bypass Vend #03</option>
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-gray-700 font-bold mb-1">Opening Bottles:</label>
                  <input
                    type="number"
                    value={openingBottles}
                    onChange={(e) => setOpeningBottles(Number(e.target.value))}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2 text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-bold mb-1">Received (Challan):</label>
                  <input
                    type="number"
                    value={receivedBottles}
                    onChange={(e) => setReceivedBottles(Number(e.target.value))}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2 text-xs font-mono font-bold text-emerald-700"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-bold mb-1">Closing Physical:</label>
                  <input
                    type="number"
                    value={closingBottles}
                    onChange={(e) => setClosingBottles(Number(e.target.value))}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2 text-xs font-mono font-bold"
                  />
                </div>
              </div>

              {/* Dynamic Sold Calculation */}
              <div className="bg-[#FFFDF0] border border-amber-200 p-3 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-gray-500 block">Computed Units Sold</span>
                  <span className="text-lg font-black text-gray-950 font-mono">{computedBottlesSold} Bottles</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-gray-500 block">Gross Sales Expected</span>
                  <span className="text-lg font-black text-emerald-800 font-mono">{formatINR(computedGrossSales)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 font-bold mb-1">Cash In Till (₹):</label>
                  <input
                    type="number"
                    value={cashCollected}
                    onChange={(e) => setCashCollected(Number(e.target.value))}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2 text-xs font-mono font-bold text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-bold mb-1">UPI / QR Machine (₹):</label>
                  <input
                    type="number"
                    value={upiCollected}
                    onChange={(e) => setUpiCollected(Number(e.target.value))}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2 text-xs font-mono font-bold text-emerald-700"
                  />
                </div>
              </div>

              {/* Shortage alert */}
              {computedShortage > 0 ? (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-red-800 flex items-center justify-between text-xs font-bold">
                  <span className="flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    Spot Cash Shortage Detected:
                  </span>
                  <span className="font-mono text-red-700">-{formatINR(computedShortage)}</span>
                </div>
              ) : (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 flex items-center gap-1.5 text-xs font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Collections fully balanced against physical stock sold.</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddSettlementModal(false)}
                  className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#FFB800] hover:bg-amber-400 text-gray-950 font-black rounded-full shadow border border-amber-600/30"
                >
                  Save & Reconcile to Ledger
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: LOG PARTNER STOCK DRAW */}
      {showAddStockDrawModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 max-w-lg w-full overflow-hidden">
            <div className="bg-[#FFB800] p-5 flex items-center justify-between border-b border-amber-500/40">
              <h3 className="font-black text-gray-950 text-base flex items-center gap-2">
                <Wine className="w-5 h-5" />
                <span>Log Partner Stock Draw (Barter / Personal)</span>
              </h3>
              <button
                onClick={() => setShowAddStockDrawModal(false)}
                className="text-gray-900 font-bold p-1 rounded-full hover:bg-black/10"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateStockDraw} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-gray-700 font-bold mb-1">Withdrawing Partner:</label>
                <select
                  value={selectedPartnerId}
                  onChange={(e) => setSelectedPartnerId(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2.5 font-medium text-gray-900 text-xs focus:ring-2 focus:ring-amber-500"
                >
                  {partners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-gray-700 font-bold mb-1">Bottles / Cases Description:</label>
                <input
                  type="text"
                  value={stockDetails}
                  onChange={(e) => setStockDetails(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2 text-xs text-gray-900"
                  placeholder="e.g. 2 Cases Blenders Pride + 1 Case Antiquity"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 font-bold mb-1">Total Bottle Count:</label>
                  <input
                    type="number"
                    value={bottlesCount}
                    onChange={(e) => setBottlesCount(Number(e.target.value))}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2 text-xs font-mono font-bold text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-bold mb-1">Retail Valuation (₹):</label>
                  <input
                    type="number"
                    value={retailValuation}
                    onChange={(e) => setRetailValuation(Number(e.target.value))}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2 text-xs font-mono font-bold text-amber-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-700 font-bold mb-1">Purpose / Occasion:</label>
                <input
                  type="text"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2 text-xs text-gray-900"
                  placeholder="e.g. Private family reception or investor hospitality"
                />
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-[11px] leading-relaxed">
                * Note: This valuation of <strong>{formatINR(retailValuation)}</strong> will be automatically deducted from the partner's monthly drawings and profit settlement ledger.
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddStockDrawModal(false)}
                  className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#FFB800] hover:bg-amber-400 text-gray-950 font-black rounded-full shadow border border-amber-600/30"
                >
                  Record Draw & Adjust Payout
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
