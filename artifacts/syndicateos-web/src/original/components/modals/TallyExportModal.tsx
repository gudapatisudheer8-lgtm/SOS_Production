import React, { useState } from 'react';
import { FileCode, Download, Copy, Check, X, CheckCircle, ShieldCheck } from 'lucide-react';

interface TallyExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  firmName: string;
  firmCode: string;
  xmlData: string;
  csvData: string;
}

export const TallyExportModal: React.FC<TallyExportModalProps> = ({
  isOpen,
  onClose,
  firmName,
  firmCode,
  xmlData,
  csvData,
}) => {
  const [format, setFormat] = useState<'xml' | 'csv'>('xml');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const contentToDisplay = format === 'xml' ? xmlData : csvData;

  const handleCopy = () => {
    navigator.clipboard.writeText(contentToDisplay);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const mimeType = format === 'xml' ? 'application/xml;charset=utf-8;' : 'text/csv;charset=utf-8;';
    const extension = format === 'xml' ? 'xml' : 'csv';
    const blob = new Blob([contentToDisplay], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${firmCode}_Official_Tax_${format.toUpperCase()}.${extension}`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-[#FFB800] p-5 flex items-center justify-between border-b border-amber-500/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#111827] text-[#FFB800] flex items-center justify-center">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold tracking-wider bg-[#111827] text-white px-2 py-0.5 rounded-full inline-block">
                TallyPrime / ERP9 Direct Ingestion
              </div>
              <h3 className="text-lg font-black text-gray-950 mt-0.5">
                Official Tax Books 1-Click Export
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-black/10 text-gray-900 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Subheader banner */}
        <div className="bg-[#FFFDF0] px-6 py-3 border-b border-amber-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-gray-700">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>
              Sanitized Official Audit Vouchers for <strong>{firmName}</strong> ({firmCode})
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setFormat('xml')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                format === 'xml'
                  ? 'bg-[#111827] text-white shadow'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              Tally XML (.xml)
            </button>
            <button
              onClick={() => setFormat('csv')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                format === 'csv'
                  ? 'bg-[#111827] text-white shadow'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              Bank Excel CSV (.csv)
            </button>
          </div>
        </div>

        {/* Code / Content Viewer */}
        <div className="p-6 flex-1 overflow-auto bg-gray-950 font-mono text-xs text-emerald-400">
          <pre className="whitespace-pre-wrap break-all leading-relaxed">
            {contentToDisplay}
          </pre>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between gap-4">
          <span className="text-xs text-gray-500">
            * Fully compatible with TallyPrime Gateway of Tally &gt; Import &gt; Transactions
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-gray-100 text-gray-800 text-xs font-bold rounded-full border border-gray-300 transition-all shadow-sm"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copied to Clipboard!' : 'Copy Data'}</span>
            </button>

            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-5 py-2 bg-[#FFB800] hover:bg-amber-400 text-gray-950 text-xs font-black rounded-full shadow-md transition-all active:scale-95 border border-amber-600/30"
            >
              <Download className="w-4 h-4" />
              <span>Download {format.toUpperCase()} File</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
