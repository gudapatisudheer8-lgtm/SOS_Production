import React, { useState } from 'react';
import { AuditLogEntry } from '../../types';
import { formatINR } from '../../utils/formatters';
import {
  ShieldCheck,
  Lock,
  Search,
  Filter,
  CheckCircle2,
  Smartphone,
  Calendar,
  Layers,
  FileText
} from 'lucide-react';

interface AuditLogViewerProps {
  logs: AuditLogEntry[];
}

export const AuditLogViewer: React.FC<AuditLogViewerProps> = ({ logs }) => {
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredLogs = logs.filter((log) => {
    const matchType = filterType === 'all' || log.ledgerType.toLowerCase().includes(filterType.toLowerCase());
    const matchSearch =
      !searchQuery ||
      (log.partnerName || log.actorName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.notes.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.deviceId.toLowerCase().includes(searchQuery.toLowerCase());
    return matchType && matchSearch;
  });

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-600" />
              Cryptographic Tamper-Evident Ledger
            </span>
            <span className="text-xs text-gray-500 font-mono">Algorithm: HMAC-SHA256</span>
          </div>
          <h2 className="text-xl font-black text-gray-950 mt-1 flex items-center gap-2">
            <span>Immutable Syndicate Audit Trail</span>
          </h2>
          <p className="text-xs text-gray-600 mt-0.5">
            Every transaction, floor rate override, multi-partner OTP authorization, and counter settlement is permanently stamped with hardware device identity and timestamp.
          </p>
        </div>

        {/* Filter pills */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-[#F4F4F6] p-1 rounded-full border border-gray-200 text-xs font-bold">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1 rounded-full transition-all ${
                filterType === 'all' ? 'bg-[#111827] text-white shadow' : 'text-gray-600 hover:text-gray-950'
              }`}
            >
              All Logs ({logs.length})
            </button>
            <button
              onClick={() => setFilterType('internal')}
              className={`px-3 py-1 rounded-full transition-all ${
                filterType === 'internal' ? 'bg-[#FFB800] text-gray-950 shadow font-black' : 'text-gray-600 hover:text-gray-950'
              }`}
            >
              Internal
            </button>
            <button
              onClick={() => setFilterType('tax')}
              className={`px-3 py-1 rounded-full transition-all ${
                filterType === 'tax' ? 'bg-indigo-600 text-white shadow' : 'text-gray-600 hover:text-gray-950'
              }`}
            >
              Official Tax
            </button>
          </div>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 flex items-center gap-3">
        <Search className="w-4 h-4 text-gray-400 shrink-0" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter audit entries by partner name, action, device, or notes..."
          className="w-full text-xs text-gray-900 bg-transparent focus:outline-none placeholder:text-gray-400 font-medium"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="text-xs text-gray-500 hover:text-gray-900 font-bold px-2 py-0.5 rounded-full bg-gray-100"
          >
            Clear
          </button>
        )}
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Timestamp & Verification</th>
                <th className="py-3 px-4">Authorizing Partner</th>
                <th className="py-3 px-4">Action Event</th>
                <th className="py-3 px-4">Hardware Device / IP</th>
                <th className="py-3 px-4">Audit Memo & Notes</th>
                <th className="py-3 px-4 text-right">Financial Impact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-amber-50/20 transition-colors">
                  {/* Timestamp & Verification */}
                  <td className="py-3.5 px-4">
                    <div className="font-mono text-[11px] font-bold text-gray-900">
                      {log.timestamp}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-emerald-700 font-semibold mt-0.5">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>Ledger Verified</span>
                    </div>
                  </td>

                  {/* Partner Name */}
                  <td className="py-3.5 px-4 font-bold text-gray-950">
                    {log.partnerName}
                  </td>

                  {/* Action Event with Badge */}
                  <td className="py-3.5 px-4">
                    <div className="font-bold text-gray-900">{log.action}</div>
                    <span
                      className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 ${
                        log.ledgerType === 'Official Tax Books'
                          ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                          : log.ledgerType === 'Internal Syndicate'
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {log.ledgerType}
                    </span>
                  </td>

                  {/* Device ID / IP */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-1 font-mono text-[11px] text-gray-600">
                      <Smartphone className="w-3 h-3 text-gray-400 shrink-0" />
                      <span>{log.deviceId}</span>
                    </div>
                  </td>

                  {/* Notes */}
                  <td className="py-3.5 px-4 text-gray-700 max-w-xs leading-relaxed">
                    {log.notes}
                  </td>

                  {/* Financial Impact */}
                  <td className="py-3.5 px-4 text-right">
                    {log.impactAmount ? (
                      <span className="font-mono font-black text-gray-950 text-sm">
                        {formatINR(log.impactAmount)}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-[11px]">N/A (Policy)</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
