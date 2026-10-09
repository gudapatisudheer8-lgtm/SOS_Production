import React, { useState, useMemo } from 'react';
import { Plot, Project, TenantFirm, MarketingBookingRequest } from '../../types';
import { formatINR, formatIndianCompact } from '../../utils/formatters';
import {
  Share2,
  Copy,
  Check,
  Send,
  X,
  Compass,
  Sparkles,
  Phone,
  User,
  ShieldCheck,
  Clock,
  Lock,
  CheckCircle2,
  Building,
  Tag,
  AlertCircle,
  HelpCircle,
  ExternalLink,
  MessageSquare
} from 'lucide-react';

interface MarketingPlotPortalModalProps {
  isOpen: boolean;
  onClose: () => void;
  plots: Plot[];
  project?: Project;
  firm: TenantFirm;
  floorRate?: number;
  onSubmitProposal: (plotId: number, proposal: MarketingBookingRequest) => void;
  isStandalone?: boolean;
}

export const MarketingPlotPortalModal: React.FC<MarketingPlotPortalModalProps> = ({
  isOpen,
  onClose,
  plots,
  project,
  firm,
  floorRate = 17000,
  onSubmitProposal,
  isStandalone = false,
}) => {
  // Agent Identification (remembered for seamless multi-proposal workflow)
  const [agentName, setAgentName] = useState(() => {
    return localStorage.getItem('syndicate_marketing_agent_name') || 'K. Rajesh (Venture Connect)';
  });
  const [agentPhone, setAgentPhone] = useState(() => {
    return localStorage.getItem('syndicate_marketing_agent_phone') || '+91 99887 11223';
  });
  const [agentAgency, setAgentAgency] = useState(() => {
    return localStorage.getItem('syndicate_marketing_agent_agency') || 'Venture Connect Channel Partners';
  });

  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'blocked' | 'booked' | 'sold'>('all');
  const [facingFilter, setFacingFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected plot for submitting booking & rate proposal
  const [selectedPlotForProposal, setSelectedPlotForProposal] = useState<Plot | null>(null);

  // Proposal Form State
  const [prospectName, setProspectName] = useState('');
  const [prospectPhone, setProspectPhone] = useState('');
  const [proposedRate, setProposedRate] = useState<number>(() => floorRate + 1000);
  const [proposedToken, setProposedToken] = useState<number>(100000);
  const [tokenDeadlineHours, setTokenDeadlineHours] = useState<number>(48);
  const [proposalNotes, setProposalNotes] = useState('');

  // Share Link Feedback
  const [copiedLink, setCopiedLink] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  if (!isOpen) return null;

  let portalOrigin = window.location.origin;
  if (portalOrigin.includes('ais-dev-')) {
    portalOrigin = portalOrigin.replace('ais-dev-', 'ais-pre-');
  }
  const shareableUrl = `${portalOrigin}${window.location.pathname}?portal=marketing&firmId=${encodeURIComponent(firm?.id || '')}&venture=${encodeURIComponent(project?.id || '')}&standalone=true`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareableUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleOpenWhatsApp = () => {
    const text = encodeURIComponent(
      `*${project?.name || 'Venture'} - Real-Time Plotted Inventory & Booking Portal*\n\n` +
      `Check live available plots, layout facing, and submit booking requests directly:\n${shareableUrl}\n\n` +
      `Promoted by ${firm.name}.`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const handleSaveAgentProfile = () => {
    localStorage.setItem('syndicate_marketing_agent_name', agentName);
    localStorage.setItem('syndicate_marketing_agent_phone', agentPhone);
    localStorage.setItem('syndicate_marketing_agent_agency', agentAgency);
  };

  const handleOpenProposal = (plot: Plot) => {
    if (plot.status !== 'available') return;
    setSelectedPlotForProposal(plot);
    setProposedRate(plot.ratePerSqYard || floorRate);
    setProposedToken(100000);
    setProposalNotes('');
  };

  const handleSubmitProposalForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlotForProposal) return;

    if (!agentName.trim()) {
      alert('Please provide your Agent / Broker Name.');
      return;
    }
    if (!agentPhone.trim()) {
      alert('Please provide your Mobile Number.');
      return;
    }
    if (!prospectName.trim()) {
      alert('Please provide Prospective Buyer / Client Name.');
      return;
    }
    if (proposedRate <= 0) {
      alert('Please enter a valid proposed rate per square yard.');
      return;
    }

    handleSaveAgentProfile();

    const proposal: MarketingBookingRequest = {
      id: `mreq-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      agentName: agentName.trim(),
      agentPhone: agentPhone.trim(),
      agentAgency: agentAgency.trim() || undefined,
      buyerName: prospectName.trim(),
      buyerPhone: prospectPhone.trim(),
      proposedRatePerSqYard: Number(proposedRate),
      proposedAdvanceAmount: Number(proposedToken) || 0,
      tokenDeadlineHours: Number(tokenDeadlineHours) || 48,
      submittedAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
      status: 'pending',
      notes: proposalNotes.trim() || undefined,
    };

    onSubmitProposal(selectedPlotForProposal.id, proposal);
    setSelectedPlotForProposal(null);
    setProspectName('');
    setProspectPhone('');
    setProposalNotes('');

    setSuccessToast(
      `Booking & Rate Proposal for ${selectedPlotForProposal.plotNumber} submitted to Syndicate! Once Managing Partner / Accountant accepts the rate of ₹${Number(proposedRate).toLocaleString('en-IN')}/Sq.Yd, this plot will be blocked exclusively for your client.`
    );
    setTimeout(() => setSuccessToast(null), 6000);
  };

  // Filtered plots
  const filteredPlots = plots.filter((plot) => {
    if (statusFilter === 'available' && plot.status !== 'available') return false;
    if (statusFilter === 'blocked' && plot.status !== 'blocked') return false;
    if (statusFilter === 'booked' && plot.status !== 'reserved') return false;
    if (statusFilter === 'sold' && plot.status !== 'sold') return false;

    if (facingFilter !== 'all') {
      if (facingFilter === 'Corner') {
        if (!plot.facing.includes('Corner')) return false;
      } else if (!plot.facing.toLowerCase().includes(facingFilter.toLowerCase())) {
        return false;
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchNum = plot.plotNumber.toLowerCase().includes(q);
      const matchFacing = plot.facing.toLowerCase().includes(q);
      const matchBlock = plot.blockName?.toLowerCase().includes(q);
      const matchAgent = plot.blockedByAgent?.toLowerCase().includes(q) || plot.marketingRequest?.agentName?.toLowerCase().includes(q);
      if (!matchNum && !matchFacing && !matchBlock && !matchAgent) return false;
    }

    return true;
  });

  const availableCount = plots.filter((p) => p.status === 'available').length;
  const blockedCount = plots.filter((p) => p.status === 'blocked').length;
  const bookedCount = plots.filter((p) => p.status === 'reserved').length;
  const soldCount = plots.filter((p) => p.status === 'sold').length;

  const portalBody = (
    <>
      <div className={`bg-slate-900 border border-slate-700 text-white ${isStandalone ? 'w-full min-h-screen rounded-none border-0' : 'rounded-3xl shadow-2xl max-w-7xl w-full max-h-[96vh]'} flex flex-col overflow-hidden`}>
      {/* 1. TOP HEADER & PORTAL CONTROLS */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-4 sm:p-5 border-b border-indigo-900/60 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-black shadow-lg shadow-indigo-600/30 shrink-0">
            <Share2 className="w-5 h-5 text-indigo-100" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-black text-white tracking-wide">
                {project?.name || 'Venture'} — Marketing &amp; Channel Partner Portal
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-indigo-500/30 text-indigo-300 border border-indigo-400/40">
                Live Field Access
              </span>
            </div>
            <p className="text-xs text-indigo-200/80 mt-0.5">
              Promoted by <strong className="text-white">{firm?.name}</strong>. Real-time inventory grid for sales executives &amp; brokers. Tap any available plot to propose client booking rate.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Share Link Actions */}
          <button
            type="button"
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
          >
            {copiedLink ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
            <span>{copiedLink ? 'Link Copied!' : 'Copy Portal Link'}</span>
          </button>

          <button
            type="button"
            onClick={handleOpenWhatsApp}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
            title="Share via WhatsApp"
          >
            <MessageSquare className="w-4 h-4 text-emerald-200" />
            <span className="hidden sm:inline">WhatsApp</span>
          </button>

          {!isStandalone && (
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center font-bold text-sm transition-colors cursor-pointer border border-slate-700"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

        {/* Success Toast */}
        {successToast && (
          <div className="bg-emerald-600/90 text-white px-4 py-2.5 text-xs font-bold flex items-center justify-between border-b border-emerald-500 animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-200 shrink-0" />
              <span>{successToast}</span>
            </div>
            <button
              onClick={() => setSuccessToast(null)}
              className="text-white/80 hover:text-white font-mono text-sm px-1"
            >
              ✕
            </button>
          </div>
        )}

        {/* 2. MARKETING EXECUTIVE DETAILS & PRIVACY NOTICE */}
        <div className="bg-slate-800/80 px-4 sm:px-6 py-3 border-b border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-slate-400 font-bold uppercase text-[10px] tracking-wider">
              Marketing Agent Profile:
            </span>
            <div className="flex items-center gap-2 bg-slate-900/90 px-3 py-1.5 rounded-xl border border-slate-700">
              <User className="w-3.5 h-3.5 text-indigo-400" />
              <input
                type="text"
                placeholder="Agent / Broker Name"
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                onBlur={handleSaveAgentProfile}
                className="bg-transparent text-white font-bold text-xs outline-none w-44"
              />
            </div>
            <div className="flex items-center gap-2 bg-slate-900/90 px-3 py-1.5 rounded-xl border border-slate-700">
              <Phone className="w-3.5 h-3.5 text-emerald-400" />
              <input
                type="text"
                placeholder="+91 Mobile"
                value={agentPhone}
                onChange={(e) => setAgentPhone(e.target.value)}
                onBlur={handleSaveAgentProfile}
                className="bg-transparent text-white font-bold text-xs outline-none w-28"
              />
            </div>
          </div>

          {/* Pricing Privacy Guarantee Banner */}
          <div className="flex items-center gap-1.5 text-[11px] text-amber-300 bg-amber-950/60 px-3 py-1 rounded-xl border border-amber-600/40">
            <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>
              <strong>Syndicate Privacy Active:</strong> Sold &amp; booked prices remain strictly confidential.
            </span>
          </div>
        </div>

        {/* 3. INVENTORY FILTER PILLS & STATUS COUNTERS */}
        <div className="bg-slate-900/60 p-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-white text-slate-950 shadow-sm'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              All Plots ({plots.length})
            </button>

            <button
              onClick={() => setStatusFilter('available')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                statusFilter === 'available'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/80 hover:bg-emerald-900/60'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Available ({availableCount})</span>
            </button>

            <button
              onClick={() => setStatusFilter('blocked')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                statusFilter === 'blocked'
                  ? 'bg-amber-400 text-slate-950 shadow-sm'
                  : 'bg-amber-950/60 text-amber-300 border border-amber-800/80 hover:bg-amber-900/60'
              }`}
            >
              <Lock className="w-3 h-3 text-amber-400" />
              <span>Blocked ({blockedCount})</span>
            </button>

            <button
              onClick={() => setStatusFilter('booked')}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                statusFilter === 'booked'
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'bg-orange-950/60 text-orange-300 border border-orange-800/80 hover:bg-orange-900/60'
              }`}
            >
              Token Booked ({bookedCount})
            </button>

            <button
              onClick={() => setStatusFilter('sold')}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                statusFilter === 'sold'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'bg-rose-950/60 text-rose-300 border border-rose-800/80 hover:bg-rose-900/60'
              }`}
            >
              Sold ({soldCount})
            </button>
          </div>

          {/* Facing Filter & Search */}
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={facingFilter}
              onChange={(e) => setFacingFilter(e.target.value)}
              className="bg-slate-800 text-white border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold outline-none cursor-pointer"
            >
              <option value="all">All Facings</option>
              <option value="East">East Facing (Sunrise)</option>
              <option value="North">North Facing (Kubera)</option>
              <option value="West">West Facing</option>
              <option value="South">South Facing</option>
              <option value="Corner">Corner Plots (Premium)</option>
            </select>

            <input
              type="text"
              placeholder="Search Plot #, Facing..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-800 text-white border border-slate-700 rounded-xl px-3 py-1.5 text-xs placeholder-slate-500 outline-none w-44"
            />
          </div>
        </div>

        {/* 4. MASTER PLOT GRID (SCROLLABLE) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          <div className="bg-slate-950/60 rounded-2xl p-3 border border-slate-800 flex items-center justify-between text-xs text-slate-300">
            <div className="flex items-center gap-4 flex-wrap">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-emerald-500 inline-block" />
                <strong className="text-white">Available:</strong> Tap to Send Booking &amp; Rate Request
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-amber-400 inline-block" />
                <strong className="text-white">Blocked:</strong> Rate Accepted, Awaiting Token Deposit
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-orange-500 inline-block" />
                <strong className="text-white">Booked:</strong> Advance Token Received
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-rose-600 inline-block" />
                <strong className="text-white">Sold:</strong> Registered Deed
              </span>
            </div>
            <div className="text-[11px] text-slate-400">
              Guideline Floor Rate: <strong className="text-amber-400 font-mono">{formatINR(floorRate)}/Sq.Yd</strong>
            </div>
          </div>

          {/* Grid of Plots */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {filteredPlots.map((plot) => {
              const isAvailable = plot.status === 'available';
              const isBlocked = plot.status === 'blocked';
              const isReserved = plot.status === 'reserved';
              const isSold = plot.status === 'sold';
              const hasPendingProposal = plot.marketingRequest && plot.marketingRequest.status === 'pending';

              return (
                <div
                  key={plot.id}
                  onClick={() => isAvailable && handleOpenProposal(plot)}
                  className={`relative rounded-2xl p-3 border transition-all text-left flex flex-col justify-between select-none ${
                    isAvailable
                      ? 'bg-gradient-to-b from-slate-800 to-emerald-950/40 border-emerald-500/50 hover:border-emerald-400 hover:shadow-lg hover:shadow-emerald-950/50 hover:-translate-y-0.5 cursor-pointer ring-1 ring-emerald-500/30'
                      : isBlocked
                      ? 'bg-gradient-to-b from-slate-800 to-amber-950/50 border-amber-500/50 ring-1 ring-amber-500/30 cursor-not-allowed opacity-95'
                      : isReserved
                      ? 'bg-gradient-to-b from-slate-800 to-orange-950/50 border-orange-500/40 cursor-not-allowed opacity-85'
                      : 'bg-gradient-to-b from-slate-900 to-rose-950/50 border-rose-900/60 cursor-not-allowed opacity-75'
                  }`}
                >
                  {/* Top Bar of Card */}
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <span className="font-mono font-black text-white text-sm">
                        {plot.plotNumber}
                      </span>
                      <span
                        className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                          isAvailable
                            ? 'bg-emerald-500 text-slate-950'
                            : isBlocked
                            ? 'bg-amber-400 text-slate-950'
                            : isReserved
                            ? 'bg-orange-500 text-white'
                            : 'bg-rose-600 text-white'
                        }`}
                      >
                        {isAvailable ? 'Available' : isBlocked ? 'Blocked' : isReserved ? 'Booked' : 'Sold'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-300 font-bold mb-1">
                      <span>{plot.areaSqYards} Sq.Yds</span>
                      <span className="text-[10px] text-slate-400 font-medium">{plot.facing}</span>
                    </div>

                    {plot.dimensions && (
                      <div className="text-[10px] text-slate-400 font-mono mb-2">
                        Dim: {plot.dimensions}
                      </div>
                    )}
                  </div>

                  {/* Body Content based on Status */}
                  <div className="pt-2 border-t border-slate-700/60 mt-1">
                    {isAvailable ? (
                      <div>
                        {hasPendingProposal ? (
                          <div className="bg-amber-950/80 p-2 rounded-xl border border-amber-600/60 text-[10px] text-amber-200">
                            <span className="font-black text-amber-300 block flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                              Rate Proposal Sent
                            </span>
                            <span>Proposed: ₹{plot.marketingRequest?.proposedRatePerSqYard?.toLocaleString('en-IN')}/Sq.Yd</span>
                            <span className="block text-slate-400 mt-0.5 truncate">by {plot.marketingRequest?.agentName}</span>
                          </div>
                        ) : (
                          <div>
                            <div className="text-[10px] text-slate-400">
                              Guideline: <strong className="text-amber-400 font-mono">{formatINR(plot.ratePerSqYard || floorRate)}</strong>/Sq.Yd
                            </div>
                            <button
                              type="button"
                              className="w-full mt-2 py-1.5 px-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black shadow-sm flex items-center justify-center gap-1 transition-colors"
                            >
                              <Send className="w-3 h-3" />
                              <span>Submit Booking</span>
                            </button>
                          </div>
                        )}
                      </div>
                    ) : isBlocked ? (
                      /* BLOCKED: Show who blocked it, NO PRICE! */
                      <div className="bg-amber-950/70 p-2 rounded-xl border border-amber-600/40 text-[10px] text-amber-200 space-y-0.5">
                        <div className="flex items-center gap-1 font-bold text-amber-300">
                          <Lock className="w-3 h-3" />
                          <span>Blocked for Token</span>
                        </div>
                        <div className="truncate">
                          <strong className="text-slate-300">Agent:</strong> {plot.blockedByAgent || plot.marketingRequest?.agentName || 'Channel Partner'}
                        </div>
                        <div className="truncate">
                          <strong className="text-slate-300">Client:</strong> {plot.blockedForBuyer || plot.marketingRequest?.buyerName || 'Prospective Buyer'}
                        </div>
                        <div className="text-[9px] text-amber-400/80 italic pt-0.5">
                          Awaiting token deposit
                        </div>
                      </div>
                    ) : isReserved ? (
                      /* BOOKED: Show Booked by, NO PRICE! */
                      <div className="bg-orange-950/60 p-2 rounded-xl border border-orange-700/40 text-[10px] text-orange-200 space-y-0.5">
                        <div className="font-bold text-orange-300">
                          Token Confirmed
                        </div>
                        <div className="truncate text-slate-300">
                          Agent: {plot.marketingRequest?.agentName || 'Syndicate Office'}
                        </div>
                        <div className="text-[9px] text-slate-400 italic">
                          Price details confidential
                        </div>
                      </div>
                    ) : (
                      /* SOLD: Show Sold, NO PRICE! */
                      <div className="bg-rose-950/60 p-2 rounded-xl border border-rose-900/60 text-[10px] text-rose-200 space-y-0.5">
                        <div className="font-bold text-rose-300">
                          Registered &amp; Executed
                        </div>
                        <div className="text-[9px] text-slate-400 italic">
                          Deed registered at SRO
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {filteredPlots.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <Compass className="w-10 h-10 mx-auto text-slate-600 mb-2 animate-bounce" />
              <p className="font-bold">No plots match the selected filters.</p>
              <button
                onClick={() => {
                  setStatusFilter('all');
                  setFacingFilter('all');
                  setSearchQuery('');
                }}
                className="mt-2 text-xs text-indigo-400 hover:underline"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>

        {/* 5. FOOTER */}
        <div className="bg-slate-950 p-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>
              Real-time synchronization with {firm.name} Syndicate Cloud.
            </span>
          </div>
          <div>
            Support &amp; Spot Assistance: <strong className="text-white font-mono">{firm.accountantPhone || '+91 98480 12345'}</strong>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* SUBMIT BOOKING & RATE PROPOSAL MODAL (MARKETING)     */}
      {/* ---------------------------------------------------- */}
      {selectedPlotForProposal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 max-w-lg w-full overflow-hidden text-gray-900 animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 p-5 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-200 block">
                  Marketing Channel Partner Submission
                </span>
                <h3 className="font-black text-lg text-white">
                  Propose Rate &amp; Booking: {selectedPlotForProposal.plotNumber}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPlotForProposal(null)}
                className="text-white/80 hover:text-white p-1 rounded-full hover:bg-black/10 transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitProposalForm} className="p-6 space-y-4 text-xs">
              {/* Plot Specs Overview */}
              <div className="bg-emerald-50/80 p-3.5 rounded-2xl border border-emerald-200 grid grid-cols-3 gap-2 text-center">
                <div>
                  <span className="text-[10px] font-bold text-gray-500 uppercase block">Area</span>
                  <strong className="text-sm font-black font-mono text-gray-950">
                    {selectedPlotForProposal.areaSqYards} Sq.Yds
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-500 uppercase block">Facing</span>
                  <strong className="text-sm font-black text-gray-950">
                    {selectedPlotForProposal.facing}
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-500 uppercase block">Base Guideline</span>
                  <strong className="text-sm font-black font-mono text-amber-700">
                    {formatINR(selectedPlotForProposal.ratePerSqYard || floorRate)}
                  </strong>
                </div>
              </div>

              {/* Marketing Agent Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-gray-50 p-3 rounded-2xl border border-gray-200">
                <div>
                  <label className="block text-[10px] font-black text-gray-700 uppercase mb-1">
                    Your Name (Marketing / Broker) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. K. Rajesh"
                    value={agentName}
                    onChange={(e) => setAgentName(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-xl p-2 font-bold text-gray-950 outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-700 uppercase mb-1">
                    Your Mobile Number *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. +91 99887 11223"
                    value={agentPhone}
                    onChange={(e) => setAgentPhone(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-xl p-2 font-bold text-gray-950 outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              {/* Prospect / Client Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-gray-700 uppercase mb-1">
                    Prospective Buyer Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ch. Nageswara Rao"
                    value={prospectName}
                    onChange={(e) => setProspectName(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2 font-bold text-gray-950 outline-none focus:bg-white focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-700 uppercase mb-1">
                    Buyer Mobile Number *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. +91 98480 33445"
                    value={prospectPhone}
                    onChange={(e) => setProspectPhone(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2 font-bold text-gray-950 outline-none focus:bg-white focus:border-emerald-600"
                  />
                </div>
              </div>

              {/* Proposed Rate & Token Advance */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[10px] font-black text-gray-700 uppercase">
                      Proposed Rate (₹ / Sq.Yd) *
                    </label>
                    <span className="text-[10px] text-gray-500 font-mono">
                      Floor: {formatINR(floorRate)}
                    </span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-2.5 top-2 text-gray-500 font-bold">₹</span>
                    <input
                      type="number"
                      required
                      min="1000"
                      step="100"
                      value={proposedRate}
                      onChange={(e) => setProposedRate(Number(e.target.value))}
                      className="w-full pl-6 pr-2 py-2 bg-white border-2 border-emerald-400 rounded-xl font-mono font-black text-sm text-gray-950 focus:border-emerald-600 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-gray-700 uppercase mb-1">
                    Proposed Token Advance (₹)
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-2 text-gray-500 font-bold">₹</span>
                    <input
                      type="number"
                      min="0"
                      step="10000"
                      value={proposedToken}
                      onChange={(e) => setProposedToken(Number(e.target.value))}
                      className="w-full pl-6 pr-2 py-2 bg-gray-50 border border-gray-300 rounded-xl font-mono font-bold text-xs text-gray-950 focus:bg-white outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Live Calculation Preview Card */}
              {(() => {
                const totalProposed = selectedPlotForProposal.areaSqYards * (Number(proposedRate) || 0);
                const variance = (Number(proposedRate) || 0) - floorRate;

                return (
                  <div className="bg-[#FFFDF0] p-3.5 rounded-2xl border border-amber-300 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-700 font-bold">Total Proposed Plot Outlay:</span>
                      <strong className="text-sm font-black font-mono text-gray-950">
                        {formatINR(totalProposed)}
                      </strong>
                    </div>
                    <div className="flex justify-between items-center text-[11px] text-gray-600">
                      <span>Comparison with Benchmark:</span>
                      <span className={`font-bold font-mono ${variance >= 0 ? 'text-emerald-700' : 'text-amber-800'}`}>
                        {variance >= 0 ? `+${formatINR(variance)}/Sq.Yd above floor` : `${formatINR(variance)}/Sq.Yd below floor`}
                      </span>
                    </div>
                    <div className="pt-1 border-t border-amber-200/80 text-[10px] text-gray-500 italic">
                      * Once the syndicate accepts this rate, Plot #{selectedPlotForProposal.plotNumber} will be blocked exclusively for {prospectName || 'your client'} until the booking token is deposited.
                    </div>
                  </div>
                );
              })()}

              {/* Special Notes / Terms */}
              <div>
                <label className="block text-[10px] font-black text-gray-700 uppercase mb-1">
                  Client Notes / Payment Terms / Vastu Preferences
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Client paying ₹1L token by RTGS tomorrow. Registration required in 45 days."
                  value={proposalNotes}
                  onChange={(e) => setProposalNotes(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2 text-xs text-gray-900 outline-none focus:bg-white"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setSelectedPlotForProposal(null)}
                  className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-full shadow-lg shadow-emerald-600/30 transition-all active:scale-95 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>Send Booking Request with Rate</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );

  if (isStandalone) {
    return <div className="min-h-screen bg-slate-950 text-white flex flex-col">{portalBody}</div>;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-4 overflow-y-auto">
      {portalBody}
    </div>
  );
};
