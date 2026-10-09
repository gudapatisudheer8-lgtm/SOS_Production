import React, { useState } from 'react';
import { TenantFirm, SectorType, FeatureFlags, Role } from '../../types';
import { formatINR, formatIndianCompact } from '../../utils/formatters';
import {
  ShieldAlert,
  Building2,
  PlusCircle,
  ToggleLeft,
  ToggleRight,
  Activity,
  HardDrive,
  Lock,
  IndianRupee,
  CheckCircle2,
  KeyRound,
  ExternalLink,
  Sliders,
  Check,
  Zap,
  Server,
  Users,
  ShieldCheck,
  X,
  Edit3,
  Power,
  PowerOff,
  AlertCircle,
  FileText,
  Briefcase,
  Phone,
  Mail,
  MapPin,
  Eye,
  Hash,
  Copy,
  CheckCheck,
  Smartphone,
  Globe
} from 'lucide-react';

interface SuperAdminViewProps {
  firms: TenantFirm[];
  onAddFirm: (firm: TenantFirm) => void;
  onUpdateFirm?: (firm: TenantFirm) => void;
  onToggleFirmStatus?: (firmId: string) => void;
  onUpdateFirmFlags: (firmId: string, flags: Partial<FeatureFlags>) => void;
  onSelectFirm?: (firmId: string) => void;
  activeFirmId?: string;
  onSwitchRole?: (role: Role, firmId?: string) => void;
}

export const SuperAdminView: React.FC<SuperAdminViewProps> = ({
  firms,
  onAddFirm,
  onUpdateFirm,
  onToggleFirmStatus,
  onUpdateFirmFlags,
  onSelectFirm,
  activeFirmId,
  onSwitchRole,
}) => {
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  
  // Onboarding Form States
  const [newFirmName, setNewFirmName] = useState('');
  const [newFirmCode, setNewFirmCode] = useState('');
  const [newTradeName, setNewTradeName] = useState('');
  const [newBusinessType, setNewBusinessType] = useState<NonNullable<TenantFirm['businessType']>>('LLP');
  const [newProprietorName, setNewProprietorName] = useState('');
  const [newProprietorPhone, setNewProprietorPhone] = useState('');
  const [newGstin, setNewGstin] = useState('');
  const [newPanNumber, setNewPanNumber] = useState('');
  const [newReraNumber, setNewReraNumber] = useState('');
  const [newFirmLocation, setNewFirmLocation] = useState('Vijayawada / CRDA');
  const [newState, setNewState] = useState<'Andhra Pradesh' | 'Telangana'>('Andhra Pradesh');
  const [newContactEmail, setNewContactEmail] = useState('');
  const [newOfficeAddress, setNewOfficeAddress] = useState('');
  const [newPlan, setNewPlan] = useState<'monthly' | 'annual' | 'enterprise'>('annual');
  const [selectedSectors, setSelectedSectors] = useState<SectorType[]>([
    'real_estate_open_plotting',
    'real_estate_construction',
  ]);
  const [managingPartnerName, setManagingPartnerName] = useState('');
  const [managingPartnerPhone, setManagingPartnerPhone] = useState('');
  const [accountantName, setAccountantName] = useState('');
  const [accountantPhone, setAccountantPhone] = useState('');
  const [generatedCredentials, setGeneratedCredentials] = useState<{
    firmId: string;
    firmCode: string;
    firmName: string;
    proprietor: string;
    proprietorPhone: string;
    accountant: string;
    accountantPhone: string;
    sectors: SectorType[];
    gstin?: string;
    pan?: string;
  } | null>(null);

  // Helper to suggest unique firm code from name & state
  const generateSuggestedCode = (name: string, state: string) => {
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return '';
    const initials = words.map(w => w[0]).join('').toUpperCase().slice(0, 4);
    return initials + (state === 'Andhra Pradesh' ? '-AP' : '-TG');
  };

  // Edit Existing Firm State
  const [editingFirm, setEditingFirm] = useState<TenantFirm | null>(null);
  const [editFirmName, setEditFirmName] = useState('');
  const [editFirmCode, setEditFirmCode] = useState('');
  const [editTradeName, setEditTradeName] = useState('');
  const [editBusinessType, setEditBusinessType] = useState<NonNullable<TenantFirm['businessType']>>('LLP');
  const [editProprietorName, setEditProprietorName] = useState('');
  const [editProprietorPhone, setEditProprietorPhone] = useState('');
  const [editGstin, setEditGstin] = useState('');
  const [editPanNumber, setEditPanNumber] = useState('');
  const [editReraNumber, setEditReraNumber] = useState('');
  const [editFirmLocation, setEditFirmLocation] = useState('');
  const [editState, setEditState] = useState<'Andhra Pradesh' | 'Telangana'>('Andhra Pradesh');
  const [editContactEmail, setEditContactEmail] = useState('');
  const [editOfficeAddress, setEditOfficeAddress] = useState('');
  const [editPlan, setEditPlan] = useState<'monthly' | 'annual' | 'enterprise'>('annual');
  const [editSectors, setEditSectors] = useState<SectorType[]>([]);
  const [editStatus, setEditStatus] = useState<'active' | 'inactive'>('active');
  const [editManagingPartnerName, setEditManagingPartnerName] = useState('');
  const [editManagingPartnerPhone, setEditManagingPartnerPhone] = useState('');
  const [editAccountantName, setEditAccountantName] = useState('');
  const [editAccountantPhone, setEditAccountantPhone] = useState('');

  // Compliance Dossier Modal State
  const [dossierFirm, setDossierFirm] = useState<TenantFirm | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Compute Platform Metrics
  const totalFirms = firms.length;
  const activeFirmsCount = firms.filter((f) => f.status === 'active').length;
  const totalMrr = firms.reduce((acc, f) => acc + (f.mrrAmount || 0), 0);
  const totalArr = totalMrr * 12;

  const toggleSector = (sector: SectorType) => {
    if (selectedSectors.includes(sector)) {
      if (selectedSectors.length > 1) {
        setSelectedSectors(selectedSectors.filter((s) => s !== sector));
      } else {
        setSelectedSectors(['real_estate_open_plotting']);
      }
    } else {
      setSelectedSectors([...selectedSectors, sector]);
    }
  };

  const handleCreateFirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFirmName.trim()) return;

    const firmCode = (newFirmCode.trim() || generateSuggestedCode(newFirmName, newState) || 'FIRM-01')
      .toUpperCase()
      .replace(/[^A-Z0-9-]/g, '');

    const mrr = newPlan === 'monthly' ? 2999 : newPlan === 'annual' ? 9999 : 24999;
    const finalProprietor = newProprietorName.trim() || managingPartnerName.trim() || 'Proprietor';
    const finalProprietorPhone = newProprietorPhone.trim() || managingPartnerPhone.trim() || '+91 98480 00000';
    const finalAccountantName = accountantName.trim() || 'Primary Accountant';
    const finalAccountantPhone = accountantPhone.trim() || '+91 94401 56789';

    const newFirm: TenantFirm = {
      id: `firm-${Date.now()}`,
      name: newFirmName.trim(),
      code: firmCode,
      location: newFirmLocation.trim(),
      state: newState,
      sectors: selectedSectors,
      subscriptionPlan: newPlan,
      mrrAmount: mrr,
      status: 'active',
      createdDate: new Date().toISOString().split('T')[0],
      // Proprietor & Promoter Details
      proprietorName: finalProprietor,
      proprietorPhone: finalProprietorPhone,
      managingPartnerName: finalProprietor,
      managingPartnerPhone: finalProprietorPhone,
      // Statutory & Tax Compliance
      gstin: newGstin.trim().toUpperCase() || undefined,
      panNumber: newPanNumber.trim().toUpperCase() || undefined,
      businessType: newBusinessType,
      tradeName: newTradeName.trim() || newFirmName.trim(),
      officeAddress: newOfficeAddress.trim() || undefined,
      contactEmail: newContactEmail.trim() || undefined,
      reraNumber: newReraNumber.trim().toUpperCase() || undefined,
      // Accountant & Operations
      accountantName: finalAccountantName,
      accountantPhone: finalAccountantPhone,
      featureFlags: {
        enablePlotGrid: selectedSectors.includes('real_estate_open_plotting'),
        enableApartmentMatrix: selectedSectors.includes('real_estate_construction'),
        enableWhatsAppAlerts: true,
        enableTallyExport: true,
        enableVoiceNotes: true,
        enableAuditLock: false,
      },
    };

    onAddFirm(newFirm);

    setGeneratedCredentials({
      firmId: newFirm.id,
      firmCode: newFirm.code,
      firmName: newFirm.name,
      proprietor: finalProprietor,
      proprietorPhone: finalProprietorPhone,
      accountant: finalAccountantName,
      accountantPhone: finalAccountantPhone,
      sectors: selectedSectors,
      gstin: newFirm.gstin,
      pan: newFirm.panNumber,
    });
  };

  const resetModal = () => {
    setShowOnboardingModal(false);
    setGeneratedCredentials(null);
    setNewFirmName('');
    setNewFirmCode('');
    setNewTradeName('');
    setNewBusinessType('LLP');
    setNewProprietorName('');
    setNewProprietorPhone('');
    setNewGstin('');
    setNewPanNumber('');
    setNewReraNumber('');
    setNewContactEmail('');
    setNewOfficeAddress('');
    setManagingPartnerName('');
    setManagingPartnerPhone('');
    setAccountantName('');
    setAccountantPhone('');
  };

  // Open Edit Modal for an existing firm
  const handleOpenEditModal = (firm: TenantFirm) => {
    setEditingFirm(firm);
    setEditFirmName(firm.name);
    setEditFirmCode(firm.code);
    setEditTradeName(firm.tradeName || firm.name);
    setEditBusinessType(firm.businessType || 'LLP');
    const propName = firm.proprietorName || firm.managingPartnerName || '';
    const propPhone = firm.proprietorPhone || firm.managingPartnerPhone || '';
    setEditProprietorName(propName);
    setEditProprietorPhone(propPhone);
    setEditGstin(firm.gstin || '');
    setEditPanNumber(firm.panNumber || '');
    setEditReraNumber(firm.reraNumber || '');
    setEditFirmLocation(firm.location);
    setEditState(firm.state);
    setEditContactEmail(firm.contactEmail || '');
    setEditOfficeAddress(firm.officeAddress || '');
    setEditPlan(firm.subscriptionPlan);
    setEditSectors([...firm.sectors]);
    setEditStatus(firm.status === 'active' ? 'active' : 'inactive');
    setEditManagingPartnerName(firm.managingPartnerName);
    setEditManagingPartnerPhone(firm.managingPartnerPhone);
    setEditAccountantName(firm.accountantName);
    setEditAccountantPhone(firm.accountantPhone);
  };

  const toggleEditSector = (sector: SectorType) => {
    if (editSectors.includes(sector)) {
      if (editSectors.length > 1) {
        setEditSectors(editSectors.filter((s) => s !== sector));
      } else {
        setEditSectors(['real_estate_open_plotting']);
      }
    } else {
      setEditSectors([...editSectors, sector]);
    }
  };

  const handleSaveEditFirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFirm || !editFirmName.trim()) return;

    const mrr = editPlan === 'monthly' ? 2999 : editPlan === 'annual' ? 9999 : 24999;
    const finalPropName = editProprietorName.trim() || editManagingPartnerName.trim() || editingFirm.managingPartnerName;
    const finalPropPhone = editProprietorPhone.trim() || editManagingPartnerPhone.trim() || editingFirm.managingPartnerPhone;

    const updated: TenantFirm = {
      ...editingFirm,
      name: editFirmName.trim(),
      code: editFirmCode.trim().toUpperCase() || editingFirm.code,
      tradeName: editTradeName.trim(),
      businessType: editBusinessType,
      proprietorName: finalPropName,
      proprietorPhone: finalPropPhone,
      gstin: editGstin.trim().toUpperCase() || undefined,
      panNumber: editPanNumber.trim().toUpperCase() || undefined,
      reraNumber: editReraNumber.trim().toUpperCase() || undefined,
      contactEmail: editContactEmail.trim() || undefined,
      officeAddress: editOfficeAddress.trim() || undefined,
      location: editFirmLocation.trim(),
      state: editState,
      sectors: editSectors,
      subscriptionPlan: editPlan,
      mrrAmount: mrr,
      status: editStatus,
      managingPartnerName: finalPropName,
      managingPartnerPhone: finalPropPhone,
      accountantName: editAccountantName.trim() || editingFirm.accountantName,
      accountantPhone: editAccountantPhone.trim() || editingFirm.accountantPhone,
      featureFlags: {
        ...editingFirm.featureFlags,
        enablePlotGrid: editSectors.includes('real_estate_open_plotting'),
        enableApartmentMatrix: editSectors.includes('real_estate_construction'),
      },
    };

    if (onUpdateFirm) {
      onUpdateFirm(updated);
    }
    setEditingFirm(null);
  };

  const resetEditModal = () => {
    setEditingFirm(null);
  };

  const sectorLabels: Record<SectorType, { title: string; desc: string; icon: string }> = {
    real_estate_open_plotting: {
      title: 'Real Estate - Open Plotting',
      desc: 'DTCP/HMDA layout calculator, 20-plot grid, road deductions & buyer advances',
      icon: '📐',
    },
    real_estate_construction: {
      title: 'Real Estate - Construction / Apartments',
      desc: 'Floors 1-5 unit matrix, base sq.ft rate matrix, facing premiums & milestones',
      icon: '🏢',
    },
    liquor_vends: {
      title: 'Liquor Vends Syndicate',
      desc: 'Daily counter stock balancing, cash vs UPI, shortage tracking & partner barter draws',
      icon: '🍾',
    },
    custom_infra: {
      title: 'Custom Infrastructure Consortium',
      desc: 'R&B road contracts, earthwork machinery & quarry weighbridge operations',
      icon: '🚜',
    },
  };

  return (
    <div className="space-y-6">
      {/* Super Admin Banner & Global Controls */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-3 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-[#FFB800] text-gray-950 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5" />
              Platform Owner Console
            </span>
            <span className="text-xs text-gray-500 font-mono">Tenant Isolation: Active (AES-256 GCM)</span>
          </div>
          <h2 className="text-2xl font-black text-gray-950">
            Multi-Tenant Business Syndicate Orchestrator
          </h2>
          <p className="text-xs text-gray-600 max-w-2xl mt-0.5">
            Provision AP & Telangana syndicates. Manage sector engine templates, toggle feature flags, and orchestrate SaaS subscriptions with zero-knowledge data segregation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            id="btn-provision-firm"
            onClick={() => setShowOnboardingModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#FFB800] hover:bg-amber-400 text-gray-950 font-black rounded-full shadow-md transition-all active:scale-95 text-xs border border-amber-600/30"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Onboard New Syndicate Firm</span>
          </button>
        </div>
      </div>

      {/* Product Owner Governance Note Banner */}
      <div className="bg-amber-50/80 border border-amber-300 rounded-3xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-[#FFB800] text-gray-950 flex items-center justify-center shrink-0 shadow-sm border border-amber-600/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-black text-gray-950">
                  Super Admin Console — Managed by Application / Product Owner
                </h3>
                <span className="text-[10px] bg-[#111827] text-amber-300 font-bold px-2 py-0.5 rounded-full">
                  Root Governance
                </span>
              </div>
              <p className="text-xs text-gray-700 mt-1 max-w-3xl leading-relaxed">
                As the <strong>Application / Product Owner</strong>, you manage tenant lifecycles and business sectors across all onboarded syndicate firms. In the tenant registry below, use the <strong>Actions</strong> buttons to toggle firm status (<strong>Active / Make Inactive</strong>) or click <strong>Edit</strong> to configure enabled business <strong>Sectors</strong> (Plotting, Construction, Liquor, Infra) and firm details. The Product Owner oversees multi-tenant governance without accessing tenant firms' internal accounting dashboards.
              </p>
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-2 bg-white px-3.5 py-2 rounded-full border border-amber-200 text-xs font-bold text-gray-800 shadow-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Product Owner Authorized</span>
          </div>
        </div>
      </div>

      {/* Global Health Monitor Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase text-gray-500">Active Tenant Firms</span>
            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-800">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-gray-950">{activeFirmsCount}</span>
            <span className="text-xs text-emerald-600 font-bold">/{totalFirms} Provisioned</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[10px] text-gray-500 font-medium">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>AP & Telangana Multi-Partner Syndicates</span>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase text-gray-500">Cloud Infrastructure</span>
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-800">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-gray-950">99.98%</span>
            <span className="text-xs text-emerald-600 font-bold">24ms Latency</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[10px] text-gray-500 font-medium">
            <Server className="w-3 h-3 text-emerald-600" />
            <span>Cloud Run Regional Cluster (Asia-East1)</span>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase text-gray-500">Tenant Encryption</span>
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-800">
              <Lock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-black text-indigo-700">AES-256 GCM</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[10px] text-gray-500 font-medium">
            <ShieldCheck className="w-3 h-3 text-emerald-600" />
            <span>Zero raw cash logs visible to host admin</span>
          </div>
        </div>

        <div className="bg-[#FFFDF0] rounded-3xl p-5 shadow-sm border border-amber-300">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase text-amber-800">Platform SaaS MRR</span>
            <div className="w-8 h-8 rounded-full bg-amber-200 flex items-center justify-center text-amber-900">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-gray-950 font-mono">{formatIndianCompact(totalMrr)}/mo</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[10px] text-amber-800 font-bold">
            <Zap className="w-3 h-3 text-amber-600" />
            <span>Annual Run Rate: {formatIndianCompact(totalArr)} ARR</span>
          </div>
        </div>
      </div>

      {/* Sector Templates & Tenant Directory */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-200 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-200">
          <div>
            <h3 className="text-lg font-black text-gray-950 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-[#FFB800]" />
              Tenant Syndicate Registry & Modular Feature Flags
            </h3>
            <p className="text-xs text-gray-600 mt-0.5">
              Toggle modular engines per tenant. Changes take effect instantaneously across accountant and field views.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-700 bg-[#F4F4F6] px-3.5 py-1.5 rounded-full border border-gray-200">
            <Building2 className="w-3.5 h-3.5 text-amber-600" />
            <span>Platform Registry: <strong className="text-gray-950">{firms.length} Onboarded Firms</strong> ({activeFirmsCount} Active)</span>
          </div>
        </div>

        {firms.length === 0 ? (
          <div className="bg-gradient-to-br from-amber-50/80 to-orange-50/60 rounded-3xl p-10 border-2 border-dashed border-amber-300 text-center my-4 space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-[#FFB800] text-gray-950 flex items-center justify-center mx-auto shadow-md">
              <Building2 className="w-7 h-7" />
            </div>
            <div className="max-w-md mx-auto">
              <h4 className="text-base font-black text-gray-950">Clean Testing Slate Initialized</h4>
              <p className="text-xs text-gray-600 mt-1">
                All mock data has been wiped from local storage. You are ready to start fresh: 
                Provision your firm account below, then copy individual direct links to give to your Firm Accountant and Partner testers.
              </p>
            </div>
            <button
              onClick={() => setShowOnboardingModal(true)}
              className="px-6 py-2.5 bg-[#FFB800] hover:bg-amber-400 text-gray-950 font-black rounded-full shadow-md text-xs transition-transform active:scale-95"
            >
              + Step 1: Provision First Firm Account
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider text-[11px]">
                <th className="pb-3 px-3">Syndicate Firm</th>
                <th className="pb-3 px-3">Location & State</th>
                <th className="pb-3 px-3">Active Sectors</th>
                <th className="pb-3 px-3">SaaS Tier</th>
                <th className="pb-3 px-3">Engine Feature Flags</th>
                <th className="pb-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {firms.map((firm) => {
                const isFirmActive = firm.status === 'active';

                return (
                  <tr
                    key={firm.id}
                    className={`transition-colors hover:bg-gray-50 ${!isFirmActive ? 'opacity-75 bg-gray-50/60' : ''}`}
                  >
                    {/* Firm Name */}
                    <td className="py-4 px-3">
                      <div className="font-black text-gray-950 flex items-center gap-2 text-sm flex-wrap">
                        <span>{firm.name}</span>
                        {firm.businessType && (
                          <span className="text-[10px] bg-slate-100 text-slate-700 border border-slate-300 px-2 py-0.5 rounded-full font-bold">
                            {firm.businessType}
                          </span>
                        )}
                        {isFirmActive ? (
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full font-bold">
                            ACTIVE
                          </span>
                        ) : (
                          <span className="text-[10px] bg-rose-100 text-rose-800 border border-rose-300 px-2 py-0.5 rounded-full font-bold">
                            INACTIVE
                          </span>
                        )}
                      </div>
                      
                      <div className="text-[11px] text-gray-600 font-mono mt-1 flex flex-wrap items-center gap-2">
                        <span>Code: <strong className="text-gray-900">{firm.code}</strong></span>
                        <span>•</span>
                        <span>Proprietor: <strong className="text-gray-900">{firm.proprietorName || firm.managingPartnerName}</strong></span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        {firm.gstin ? (
                          <span className="inline-flex items-center gap-1 font-mono bg-amber-50 text-amber-900 border border-amber-300/80 px-2 py-0.5 rounded text-[10px] font-bold">
                            <Hash className="w-3 h-3 text-amber-700" />
                            <span>GSTIN: {firm.gstin}</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-400 italic">No GSTIN</span>
                        )}

                        {firm.panNumber && (
                          <span className="inline-flex items-center gap-1 font-mono text-gray-700 text-[10px] bg-gray-100 px-2 py-0.5 rounded border border-gray-200 font-bold">
                            <span>PAN: {firm.panNumber}</span>
                          </span>
                        )}

                        {firm.reraNumber && (
                          <span className="inline-flex items-center gap-1 font-mono text-blue-800 text-[10px] bg-blue-50 px-2 py-0.5 rounded border border-blue-200 font-bold">
                            <span>RERA: {firm.reraNumber}</span>
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Location */}
                    <td className="py-4 px-3">
                      <div className="text-gray-900 font-bold">{firm.location}</div>
                      <span className="inline-block mt-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                        {firm.state}
                      </span>
                    </td>

                    {/* Sectors */}
                    <td className="py-4 px-3">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {firm.sectors.map((sec) => (
                          <span
                            key={sec}
                            className="text-[10px] bg-gray-100 text-gray-800 px-2 py-0.5 rounded-full border border-gray-200 flex items-center gap-1 font-semibold"
                          >
                            <span>{sectorLabels[sec]?.icon || '📦'}</span>
                            <span>{sec === 'real_estate_open_plotting' ? 'Plotting' : sec === 'real_estate_construction' ? 'Apartments' : sec === 'liquor_vends' ? 'Liquor' : 'Infra'}</span>
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* Plan */}
                    <td className="py-4 px-3">
                      <div className="font-bold text-gray-900 capitalize">
                        {firm.subscriptionPlan}
                      </div>
                      <div className="text-xs text-amber-800 font-mono font-bold">
                        {formatINR(firm.mrrAmount)}/mo
                      </div>
                    </td>

                    {/* Feature Flags */}
                    <td className="py-4 px-3">
                      <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                        <button
                          onClick={() =>
                            onUpdateFirmFlags(firm.id, {
                              enablePlotGrid: !firm.featureFlags.enablePlotGrid,
                            })
                          }
                          className={`flex items-center justify-between px-2 py-1 rounded-full font-bold border transition-colors ${
                            firm.featureFlags.enablePlotGrid
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : 'bg-gray-100 text-gray-500 border-gray-200'
                          }`}
                        >
                          <span>Plot Grid</span>
                          <Check className="w-3 h-3" />
                        </button>

                        <button
                          onClick={() =>
                            onUpdateFirmFlags(firm.id, {
                              enableApartmentMatrix: !firm.featureFlags.enableApartmentMatrix,
                            })
                          }
                          className={`flex items-center justify-between px-2 py-1 rounded-full font-bold border transition-colors ${
                            firm.featureFlags.enableApartmentMatrix
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : 'bg-gray-100 text-gray-500 border-gray-200'
                          }`}
                        >
                          <span>Apartments</span>
                          <Check className="w-3 h-3" />
                        </button>

                        <button
                          onClick={() =>
                            onUpdateFirmFlags(firm.id, {
                              enableTallyExport: !firm.featureFlags.enableTallyExport,
                            })
                          }
                          className={`flex items-center justify-between px-2 py-1 rounded-full font-bold border transition-colors ${
                            firm.featureFlags.enableTallyExport
                              ? 'bg-amber-50 text-amber-900 border-amber-300'
                              : 'bg-gray-100 text-gray-500 border-gray-200'
                          }`}
                        >
                          <span>Tally Export</span>
                          <Check className="w-3 h-3" />
                        </button>

                        <button
                          onClick={() =>
                            onUpdateFirmFlags(firm.id, {
                              enableVoiceNotes: !firm.featureFlags.enableVoiceNotes,
                            })
                          }
                          className={`flex items-center justify-between px-2 py-1 rounded-full font-bold border transition-colors ${
                            firm.featureFlags.enableVoiceNotes
                              ? 'bg-purple-50 text-purple-900 border-purple-300'
                              : 'bg-gray-100 text-gray-500 border-gray-200'
                          }`}
                        >
                          <span>Voice Notes</span>
                          <Check className="w-3 h-3" />
                        </button>
                      </div>
                    </td>

                    {/* Actions Column: Active/Make Inactive & Edit Sectors & Info */}
                    <td className="py-4 px-3 text-right">
                      <div className="flex items-center justify-end gap-2 flex-wrap">
                        {/* 1. Active / Make Inactive Button */}
                        <button
                          id={`btn-toggle-status-${firm.id}`}
                          onClick={() => {
                            if (onToggleFirmStatus) {
                              onToggleFirmStatus(firm.id);
                            } else if (onUpdateFirm) {
                              onUpdateFirm({
                                ...firm,
                                status: isFirmActive ? 'inactive' : 'active',
                              });
                            }
                          }}
                          title={isFirmActive ? 'Click to make firm Inactive (Suspend operations)' : 'Click to make firm Active'}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all flex items-center gap-1.5 shadow-xs ${
                            isFirmActive
                              ? 'border-gray-300 hover:border-rose-400 bg-white hover:bg-rose-50 text-gray-700 hover:text-rose-700'
                              : 'border-emerald-500 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-extrabold'
                          }`}
                        >
                          {isFirmActive ? (
                            <>
                              <PowerOff className="w-3.5 h-3.5 text-rose-500" />
                              <span>Make Inactive</span>
                            </>
                          ) : (
                            <>
                              <Power className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Make Active</span>
                            </>
                          )}
                        </button>

                        {/* 2. Details Action: View Statutory & Compliance Dossier */}
                        <button
                          id={`btn-view-dossier-${firm.id}`}
                          onClick={() => setDossierFirm(firm)}
                          title="View compliance dossier, GSTIN, PAN, and contacts"
                          className="px-3 py-1.5 rounded-full text-xs font-bold border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-900 transition-all flex items-center gap-1.5 shadow-xs"
                        >
                          <Eye className="w-3.5 h-3.5 text-blue-700" />
                          <span>Details</span>
                        </button>

                        {/* 3. Edit Action: Update Sectors & Info */}
                        <button
                          id={`btn-edit-firm-${firm.id}`}
                          onClick={() => handleOpenEditModal(firm)}
                          title="Edit syndicate sectors, plan, statutory, and contact information"
                          className="px-3 py-1.5 rounded-full text-xs font-bold border border-amber-500/60 bg-amber-50 hover:bg-amber-100 text-amber-900 transition-all flex items-center gap-1.5 shadow-xs"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-amber-700" />
                          <span>Edit</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        )}
      </div>

      {/* ONBOARDING MODAL */}
      {showOnboardingModal && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto overscroll-contain">
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 max-w-3xl w-full overflow-hidden my-auto max-h-[92vh] flex flex-col">
            <div className="bg-[#FFB800] p-5 flex items-center justify-between border-b border-amber-500/40 shrink-0">
              <div>
                <h3 className="font-black text-gray-950 text-base flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  <span>Onboard New Syndicate Firm Tenant</span>
                </h3>
                <p className="text-xs text-gray-900 mt-0.5 font-medium">
                  Statutory GSTIN, PAN, Proprietor details, ground accounts & sector engine provisioning
                </p>
              </div>
              <button
                onClick={resetModal}
                className="text-gray-900 font-bold p-1.5 rounded-full hover:bg-black/10 transition-colors"
              >
                ✕
              </button>
            </div>

            {!generatedCredentials ? (
              <form onSubmit={handleCreateFirm} className="p-6 space-y-5 text-xs flex-1 overflow-y-auto">
                {/* Section 1: Firm Legal Identity & Entity Type */}
                <div className="bg-gray-50/80 rounded-2xl p-4 border border-gray-200 space-y-3">
                  <div className="flex items-center gap-2 text-gray-950 font-black text-xs border-b border-gray-200 pb-2">
                    <Building2 className="w-4 h-4 text-amber-600" />
                    <span>1. Firm Identity & Legal Registration</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-gray-700 font-bold mb-1">
                        Firm Legal Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={newFirmName}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNewFirmName(val);
                          if (!newFirmCode || newFirmCode === generateSuggestedCode(newFirmName, newState)) {
                            setNewFirmCode(generateSuggestedCode(val, newState));
                          }
                        }}
                        className="w-full bg-white border border-gray-300 rounded-xl p-2.5 text-xs text-gray-950 font-bold focus:ring-2 focus:ring-[#FFB800] outline-none"
                        placeholder="e.g. Sri Lakshmi Balaji Ventures LLP"
                      />
                    </div>

                    <div>
                      <label className="block text-gray-700 font-bold mb-1">
                        Firm Code (Unique Tenant Identifier) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={newFirmCode}
                        onChange={(e) => setNewFirmCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
                        className="w-full bg-white border border-gray-300 rounded-xl p-2.5 text-xs text-gray-950 font-mono font-black uppercase tracking-wider focus:ring-2 focus:ring-[#FFB800] outline-none"
                        placeholder="e.g. SC-AP"
                      />
                      <span className="text-[10px] text-gray-500 mt-0.5 block font-mono">
                        Unique ID for firm logins & data isolation in database.
                      </span>
                    </div>

                    <div>
                      <label className="block text-gray-700 font-bold mb-1">
                        Business Entity Type <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={newBusinessType}
                        onChange={(e) => setNewBusinessType(e.target.value as any)}
                        className="w-full bg-white border border-gray-300 rounded-xl p-2 text-xs font-bold text-gray-900 focus:ring-2 focus:ring-[#FFB800] outline-none"
                      >
                        <option value="LLP">LLP (Limited Liability Partnership)</option>
                        <option value="Proprietorship">Proprietorship (Sole Owner)</option>
                        <option value="Partnership">Partnership Firm</option>
                        <option value="Private Limited">Private Limited Company</option>
                        <option value="Syndicate / Joint Venture">Syndicate / Joint Venture Consortium</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-gray-700 font-bold mb-1">
                        Trade / Brand Name (Optional)
                      </label>
                      <input
                        type="text"
                        value={newTradeName}
                        onChange={(e) => setNewTradeName(e.target.value)}
                        className="w-full bg-white border border-gray-300 rounded-xl p-2 text-xs text-gray-900 focus:ring-2 focus:ring-[#FFB800] outline-none"
                        placeholder="e.g. Balaji Estates / Mirchi Infra"
                      />
                    </div>

                    <div>
                      <label className="block text-gray-700 font-bold mb-1">
                        Operating State Jurisdiction <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={newState}
                        onChange={(e) => {
                          const stateVal = e.target.value as any;
                          setNewState(stateVal);
                          if (!newGstin) {
                            setNewGstin(stateVal === 'Andhra Pradesh' ? '37' : '36');
                          }
                        }}
                        className="w-full bg-white border border-gray-300 rounded-xl p-2 text-xs font-bold text-gray-900 focus:ring-2 focus:ring-[#FFB800] outline-none"
                      >
                        <option value="Andhra Pradesh">Andhra Pradesh (CRDA / DTCP)</option>
                        <option value="Telangana">Telangana (HMDA / TG RERA)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-gray-700 font-bold mb-1">
                        Location / District Hub <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={newFirmLocation}
                        onChange={(e) => setNewFirmLocation(e.target.value)}
                        className="w-full bg-white border border-gray-300 rounded-xl p-2 text-xs text-gray-900 focus:ring-2 focus:ring-[#FFB800] outline-none"
                        placeholder="e.g. Vijayawada / CRDA Border"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 2: Statutory & Tax Compliance (GST, PAN, RERA) */}
                <div className="bg-amber-50/50 rounded-2xl p-4 border border-amber-200/80 space-y-3">
                  <div className="flex items-center justify-between border-b border-amber-200/60 pb-2">
                    <div className="flex items-center gap-2 text-gray-950 font-black text-xs">
                      <FileText className="w-4 h-4 text-amber-700" />
                      <span>2. Statutory & Tax Compliance</span>
                    </div>
                    <span className="text-[10px] font-mono text-amber-900 bg-amber-100/80 px-2 py-0.5 rounded-full font-bold">
                      {newState === 'Andhra Pradesh' ? 'AP GST Code: 37' : 'TG GST Code: 36'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-gray-700 font-bold">GST Number (GSTIN)</label>
                        <button
                          type="button"
                          onClick={() => setNewGstin(newState === 'Andhra Pradesh' ? '37' : '36')}
                          className="text-[10px] text-amber-800 hover:underline font-bold"
                        >
                          Fill Prefix
                        </button>
                      </div>
                      <input
                        type="text"
                        maxLength={15}
                        value={newGstin}
                        onChange={(e) => setNewGstin(e.target.value.toUpperCase().replace(/\s+/g, ''))}
                        className="w-full bg-white border border-gray-300 rounded-xl p-2 text-xs font-mono font-bold text-gray-900 focus:ring-2 focus:ring-[#FFB800] outline-none"
                        placeholder={newState === 'Andhra Pradesh' ? '37AAAAA0000A1Z5' : '36AAAAA0000A1Z5'}
                      />
                      <span className="text-[10px] text-gray-500 mt-0.5 block font-mono">
                        15 characters alphanumeric
                      </span>
                    </div>

                    <div>
                      <label className="block text-gray-700 font-bold mb-1">PAN Number</label>
                      <input
                        type="text"
                        maxLength={10}
                        value={newPanNumber}
                        onChange={(e) => setNewPanNumber(e.target.value.toUpperCase().replace(/\s+/g, ''))}
                        className="w-full bg-white border border-gray-300 rounded-xl p-2 text-xs font-mono font-bold text-gray-900 focus:ring-2 focus:ring-[#FFB800] outline-none"
                        placeholder="e.g. AAKFA1928F"
                      />
                      <span className="text-[10px] text-gray-500 mt-0.5 block font-mono">
                        10 characters alphanumeric
                      </span>
                    </div>

                    <div>
                      <label className="block text-gray-700 font-bold mb-1">RERA / Excise License</label>
                      <input
                        type="text"
                        value={newReraNumber}
                        onChange={(e) => setNewReraNumber(e.target.value.toUpperCase())}
                        className="w-full bg-white border border-gray-300 rounded-xl p-2 text-xs font-mono font-bold text-gray-900 focus:ring-2 focus:ring-[#FFB800] outline-none"
                        placeholder="e.g. P03240019284"
                      />
                      <span className="text-[10px] text-gray-500 mt-0.5 block">
                        State registration number
                      </span>
                    </div>
                  </div>
                </div>

                {/* Section 3: Proprietor / Key Promoter & Official Contacts */}
                <div className="bg-gray-50/80 rounded-2xl p-4 border border-gray-200 space-y-3">
                  <div className="flex items-center gap-2 text-gray-950 font-black text-xs border-b border-gray-200 pb-2">
                    <Briefcase className="w-4 h-4 text-amber-600" />
                    <span>3. Proprietor, Promoters & Official Communication</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-gray-700 font-bold mb-1">
                        Proprietor / Managing Partner Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={newProprietorName}
                        onChange={(e) => setNewProprietorName(e.target.value)}
                        className="w-full bg-white border border-gray-300 rounded-xl p-2 text-xs text-gray-900 font-bold focus:ring-2 focus:ring-[#FFB800] outline-none"
                        placeholder="e.g. Srikanth Reddy / Venkata Ramana"
                      />
                    </div>

                    <div>
                      <label className="block text-gray-700 font-bold mb-1">
                        Proprietor Mobile / WhatsApp <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={newProprietorPhone}
                        onChange={(e) => setNewProprietorPhone(e.target.value)}
                        className="w-full bg-white border border-gray-300 rounded-xl p-2 text-xs font-mono text-gray-900 focus:ring-2 focus:ring-[#FFB800] outline-none"
                        placeholder="+91 98480 12345"
                      />
                    </div>

                    <div>
                      <label className="block text-gray-700 font-bold mb-1">Official Syndicate Email</label>
                      <input
                        type="email"
                        value={newContactEmail}
                        onChange={(e) => setNewContactEmail(e.target.value)}
                        className="w-full bg-white border border-gray-300 rounded-xl p-2 text-xs text-gray-900 focus:ring-2 focus:ring-[#FFB800] outline-none"
                        placeholder="e.g. contact@balajiventures.in"
                      />
                    </div>

                    <div>
                      <label className="block text-gray-700 font-bold mb-1">Registered Office / Site Address</label>
                      <input
                        type="text"
                        value={newOfficeAddress}
                        onChange={(e) => setNewOfficeAddress(e.target.value)}
                        className="w-full bg-white border border-gray-300 rounded-xl p-2 text-xs text-gray-900 focus:ring-2 focus:ring-[#FFB800] outline-none"
                        placeholder="D.No 40-1-12, MG Road, Vijayawada, AP 520010"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 4: Ground Finance Desk (Primary Accountant) */}
                <div className="bg-gray-50/80 rounded-2xl p-4 border border-gray-200 space-y-3">
                  <div className="flex items-center gap-2 text-gray-950 font-black text-xs border-b border-gray-200 pb-2">
                    <Users className="w-4 h-4 text-amber-600" />
                    <span>4. Ground Finance Desk (Primary Accountant)</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-gray-700 font-bold mb-1">Accountant Full Name</label>
                      <input
                        type="text"
                        value={accountantName}
                        onChange={(e) => setAccountantName(e.target.value)}
                        className="w-full bg-white border border-gray-300 rounded-xl p-2 text-xs text-gray-900 focus:ring-2 focus:ring-[#FFB800] outline-none"
                        placeholder="e.g. K. S. Narayana (CA Inter)"
                      />
                    </div>

                    <div>
                      <label className="block text-gray-700 font-bold mb-1">Accountant Mobile Phone</label>
                      <input
                        type="text"
                        value={accountantPhone}
                        onChange={(e) => setAccountantPhone(e.target.value)}
                        className="w-full bg-white border border-gray-300 rounded-xl p-2 text-xs font-mono text-gray-900 focus:ring-2 focus:ring-[#FFB800] outline-none"
                        placeholder="+91 94401 56789"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 5: SaaS Subscription Tier */}
                <div>
                  <label className="block text-gray-700 font-bold mb-1.5">5. SaaS Subscription Tier:</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setNewPlan('monthly')}
                      className={`p-2.5 rounded-xl border text-center transition-all ${
                        newPlan === 'monthly'
                          ? 'bg-amber-50 border-amber-400 font-black text-amber-900 ring-2 ring-amber-400/40'
                          : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <span className="block font-bold">Starter</span>
                      <span className="text-[11px] font-mono">₹2,999/mo</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewPlan('annual')}
                      className={`p-2.5 rounded-xl border text-center transition-all ${
                        newPlan === 'annual'
                          ? 'bg-amber-50 border-amber-400 font-black text-amber-900 ring-2 ring-amber-400/40'
                          : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <span className="block font-bold">Growth</span>
                      <span className="text-[11px] font-mono">₹9,999/mo</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewPlan('enterprise')}
                      className={`p-2.5 rounded-xl border text-center transition-all ${
                        newPlan === 'enterprise'
                          ? 'bg-amber-50 border-amber-400 font-black text-amber-900 ring-2 ring-amber-400/40'
                          : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <span className="block font-bold">Consortium</span>
                      <span className="text-[11px] font-mono">₹24,999/yr</span>
                    </button>
                  </div>
                </div>

                {/* Section 6: Sector Modules */}
                <div>
                  <label className="block text-gray-700 font-bold mb-1">6. Select Active Sector Modules:</label>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.keys(sectorLabels).map((key) => {
                      const sec = key as SectorType;
                      const isSelected = selectedSectors.includes(sec);
                      return (
                        <button
                          key={sec}
                          type="button"
                          onClick={() => toggleSector(sec)}
                          className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all ${
                            isSelected
                              ? 'bg-gray-950 text-white border-gray-950 font-bold shadow-xs'
                              : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          <span className="text-base">{sectorLabels[sec].icon}</span>
                          <span className="truncate">{sectorLabels[sec].title.replace('Real Estate - ', '')}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-amber-400 ml-auto shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={resetModal}
                    className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-[#FFB800] hover:bg-amber-400 text-gray-950 font-black rounded-full shadow border border-amber-600/30 transition-transform active:scale-95"
                  >
                    Provision Syndicate Tenant & Generate Credentials
                  </button>
                </div>
              </form>
            ) : (
              <div className="p-6 space-y-4 text-xs">
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900">
                  <div className="flex items-center gap-2 font-black text-sm">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span>Firm Tenant Successfully Created in Database!</span>
                  </div>
                  <p className="mt-1 text-[11px] text-emerald-800">
                    Firm registry, partition schema, and accountant credentials have been recorded in the database.
                  </p>
                  <div className="mt-2 pt-2 border-t border-emerald-200/60 flex flex-wrap gap-3 font-mono text-[11px]">
                    <span>Firm Name: <strong>{generatedCredentials.firmName}</strong></span>
                    <span>•</span>
                    <span>Firm Code: <strong>{generatedCredentials.firmCode}</strong></span>
                    {generatedCredentials.gstin && (
                      <>
                        <span>•</span>
                        <span>GSTIN: <strong>{generatedCredentials.gstin}</strong></span>
                      </>
                    )}
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-3 font-mono">
                  <div className="p-3.5 bg-white rounded-xl border border-amber-300 shadow-2xs space-y-1.5">
                    <span className="text-amber-900 block text-[10px] uppercase font-bold tracking-wider">Designated Accountant Login Credentials (Unique ID):</span>
                    <div className="flex items-center justify-between text-xs">
                      <span>Full Name: <strong>{generatedCredentials.accountant}</strong></span>
                      <span className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded font-bold">Role: Accountant</span>
                    </div>
                    <div className="text-xs text-gray-900">
                      Mobile Number (Unique Login ID): <strong className="text-amber-900 font-bold">{generatedCredentials.accountantPhone}</strong>
                    </div>
                    <div className="text-[11px] text-stone-600 bg-amber-50/70 p-2 rounded-lg border border-amber-200">
                      How to log in: Open <strong>Firm Member Portal</strong> → Enter Firm Code <strong>{generatedCredentials.firmCode}</strong> → Mobile <strong>{generatedCredentials.accountantPhone}</strong> → Default PIN: <strong>9999</strong>
                    </div>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-gray-200 space-y-1 font-sans text-xs">
                    <span className="text-gray-500 block text-[10px] uppercase font-bold tracking-wider">Firm Ownership & Project Partner Access Architecture:</span>
                    <div className="text-gray-800">
                      Proprietor / Promoter: <strong>{generatedCredentials.proprietor}</strong> ({generatedCredentials.proprietorPhone})
                    </div>
                    <p className="text-[11px] text-gray-600 mt-1">
                      • The proprietor is registered for firm ownership &amp; compliance records (not a system login user).
                    </p>
                    <p className="text-[11px] text-gray-600">
                      • Only the Accountant mobile number can sign in to operate this firm's account and ledgers.
                    </p>
                    <p className="text-[11px] text-gray-600">
                      • Field Partners will be enrolled as individual login users with their respective mobile numbers at the project level when projects are created.
                    </p>
                  </div>

                  <div className="pt-1 text-[11px] text-gray-600 font-sans">
                    <span className="font-bold text-gray-800">Active Business Sectors: </span>
                    {generatedCredentials.sectors.map((s) => s.replace('real_estate_', '').replace('_', ' ')).join(', ')}
                  </div>
                </div>

                <div className="flex items-center justify-end pt-2">
                  <button
                    type="button"
                    onClick={resetModal}
                    className="px-6 py-2.5 bg-[#FFB800] hover:bg-amber-400 text-gray-950 font-black rounded-full shadow border border-amber-600/30 cursor-pointer"
                  >
                    Done & Return to Registry
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* EDIT ONBOARDED FIRM & SECTORS MODAL */}
      {editingFirm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-start sm:items-center justify-center p-3 sm:p-4 overflow-y-auto overscroll-contain">
          <div className="bg-white rounded-3xl max-w-3xl w-full overflow-hidden shadow-2xl border border-gray-200 animate-in fade-in zoom-in-95 duration-150 my-auto max-h-[92vh] flex flex-col">
            <div className="bg-[#FFB800] p-5 flex items-center justify-between border-b border-amber-500 shrink-0">
              <div>
                <div className="flex items-center gap-2 text-gray-950 font-black text-base">
                  <Edit3 className="w-5 h-5" />
                  <span>Edit Syndicate Tenant & Statutory Profile</span>
                </div>
                <p className="text-xs text-gray-900 mt-0.5 font-medium">
                  Firm Code: <span className="font-mono font-bold">{editingFirm.code}</span> • Update GSTIN, PAN, Proprietor, Sectors & Tier
                </p>
              </div>
              <button
                onClick={resetEditModal}
                className="p-1.5 rounded-full hover:bg-black/10 text-gray-950 transition-colors"
                title="Close editor"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditFirm} className="p-6 space-y-5 text-xs max-h-[80vh] overflow-y-auto">
              {/* Operational Status Control */}
              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
                <label className="block text-gray-900 font-black text-xs mb-2">
                  Firm Operational Status (Super Admin Governance):
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setEditStatus('active')}
                    className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all ${
                      editStatus === 'active'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-950 shadow-xs ring-2 ring-emerald-500/20'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-3 h-3 rounded-full ${editStatus === 'active' ? 'bg-emerald-600' : 'bg-gray-300'}`} />
                      <div>
                        <div className="font-black text-xs">Active Firm</div>
                        <div className="text-[10px] text-gray-500">Full syndicate operations enabled</div>
                      </div>
                    </div>
                    {editStatus === 'active' && <Check className="w-4 h-4 text-emerald-700" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditStatus('inactive')}
                    className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all ${
                      editStatus === 'inactive'
                        ? 'bg-rose-50 border-rose-500 text-rose-950 shadow-xs ring-2 ring-rose-500/20'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-3 h-3 rounded-full ${editStatus === 'inactive' ? 'bg-rose-600' : 'bg-gray-300'}`} />
                      <div>
                        <div className="font-black text-xs">Make Inactive</div>
                        <div className="text-[10px] text-gray-500">Operations paused / suspended</div>
                      </div>
                    </div>
                    {editStatus === 'inactive' && <Check className="w-4 h-4 text-rose-700" />}
                  </button>
                </div>
              </div>

              {/* Statutory & Tax Profile (GST, PAN, RERA) */}
              <div className="bg-amber-50/50 rounded-2xl p-4 border border-amber-200/80 space-y-3">
                <div className="flex items-center justify-between border-b border-amber-200/60 pb-2">
                  <div className="flex items-center gap-2 text-gray-950 font-black text-xs">
                    <FileText className="w-4 h-4 text-amber-700" />
                    <span>Statutory & Tax Compliance</span>
                  </div>
                  <span className="text-[10px] font-mono text-amber-900 bg-amber-100/80 px-2 py-0.5 rounded-full font-bold">
                    {editState === 'Andhra Pradesh' ? 'AP GST Code: 37' : 'TG GST Code: 36'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-gray-700 font-bold mb-1">GST Number (GSTIN)</label>
                    <input
                      type="text"
                      maxLength={15}
                      value={editGstin}
                      onChange={(e) => setEditGstin(e.target.value.toUpperCase().replace(/\s+/g, ''))}
                      className="w-full bg-white border border-gray-300 rounded-xl p-2 text-xs font-mono font-bold text-gray-900 focus:ring-2 focus:ring-[#FFB800] outline-none"
                      placeholder="e.g. 37AAKFA1928F1ZP"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-700 font-bold mb-1">PAN Number</label>
                    <input
                      type="text"
                      maxLength={10}
                      value={editPanNumber}
                      onChange={(e) => setEditPanNumber(e.target.value.toUpperCase().replace(/\s+/g, ''))}
                      className="w-full bg-white border border-gray-300 rounded-xl p-2 text-xs font-mono font-bold text-gray-900 focus:ring-2 focus:ring-[#FFB800] outline-none"
                      placeholder="e.g. AAKFA1928F"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-700 font-bold mb-1">RERA / Excise License</label>
                    <input
                      type="text"
                      value={editReraNumber}
                      onChange={(e) => setEditReraNumber(e.target.value.toUpperCase())}
                      className="w-full bg-white border border-gray-300 rounded-xl p-2 text-xs font-mono font-bold text-gray-900 focus:ring-2 focus:ring-[#FFB800] outline-none"
                      placeholder="e.g. P03240019284"
                    />
                  </div>
                </div>
              </div>

              {/* Legal Name & Entity Type */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-gray-700 font-bold mb-1">Firm Legal Name *</label>
                  <input
                    type="text"
                    required
                    value={editFirmName}
                    onChange={(e) => setEditFirmName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#FFB800] outline-none font-bold text-xs"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-bold mb-1">Firm Code (Tenant ID) *</label>
                  <input
                    type="text"
                    required
                    value={editFirmCode}
                    onChange={(e) => setEditFirmCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#FFB800] outline-none font-mono font-black uppercase text-xs"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-bold mb-1">Business Entity Type</label>
                  <select
                    value={editBusinessType}
                    onChange={(e) => setEditBusinessType(e.target.value as any)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-[#FFB800] outline-none font-bold text-xs"
                  >
                    <option value="LLP">LLP</option>
                    <option value="Proprietorship">Proprietorship</option>
                    <option value="Partnership">Partnership</option>
                    <option value="Private Limited">Private Limited</option>
                    <option value="Syndicate / Joint Venture">Syndicate / Joint Venture</option>
                  </select>
                </div>
              </div>

              {/* Location & Jurisdiction */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-gray-700 font-bold mb-1">Trade / Brand Name</label>
                  <input
                    type="text"
                    value={editTradeName}
                    onChange={(e) => setEditTradeName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#FFB800] outline-none text-xs"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-bold mb-1">Location / Hub</label>
                  <input
                    type="text"
                    value={editFirmLocation}
                    onChange={(e) => setEditFirmLocation(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#FFB800] outline-none text-xs"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-bold mb-1">Operating State</label>
                  <select
                    value={editState}
                    onChange={(e) => setEditState(e.target.value as any)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-[#FFB800] outline-none font-medium"
                  >
                    <option value="Andhra Pradesh">Andhra Pradesh (AP)</option>
                    <option value="Telangana">Telangana (TG)</option>
                  </select>
                </div>
              </div>

              {/* Proprietor & Contact Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-gray-100">
                <div>
                  <label className="block text-gray-700 font-bold mb-1">Proprietor / Managing Partner</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Name"
                      value={editProprietorName}
                      onChange={(e) => setEditProprietorName(e.target.value)}
                      className="w-1/2 px-2.5 py-1.5 border border-gray-300 rounded-xl outline-none text-xs font-bold"
                    />
                    <input
                      type="text"
                      placeholder="Phone"
                      value={editProprietorPhone}
                      onChange={(e) => setEditProprietorPhone(e.target.value)}
                      className="w-1/2 px-2.5 py-1.5 border border-gray-300 rounded-xl outline-none text-xs font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-gray-700 font-bold mb-1">Primary Accountant</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Name"
                      value={editAccountantName}
                      onChange={(e) => setEditAccountantName(e.target.value)}
                      className="w-1/2 px-2.5 py-1.5 border border-gray-300 rounded-xl outline-none text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Phone"
                      value={editAccountantPhone}
                      onChange={(e) => setEditAccountantPhone(e.target.value)}
                      className="w-1/2 px-2.5 py-1.5 border border-gray-300 rounded-xl outline-none text-xs font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-gray-700 font-bold mb-1">Official Syndicate Email</label>
                  <input
                    type="email"
                    value={editContactEmail}
                    onChange={(e) => setEditContactEmail(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-gray-300 rounded-xl outline-none text-xs"
                    placeholder="contact@syndicate.in"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-bold mb-1">Registered Office Address</label>
                  <input
                    type="text"
                    value={editOfficeAddress}
                    onChange={(e) => setEditOfficeAddress(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-gray-300 rounded-xl outline-none text-xs"
                    placeholder="MG Road, Vijayawada, AP"
                  />
                </div>
              </div>

              {/* Active Sectors Selection */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-gray-900 font-black text-xs">
                    Update Active Business Sectors:
                  </label>
                  <span className="text-[11px] text-gray-500">
                    {editSectors.length} sector{editSectors.length !== 1 ? 's' : ''} enabled
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {Object.keys(sectorLabels).map((key) => {
                    const sec = key as SectorType;
                    const isSelected = editSectors.includes(sec);
                    return (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => toggleEditSector(sec)}
                        className={`p-3 rounded-2xl border text-left flex items-start gap-3 transition-all ${
                          isSelected
                            ? 'bg-amber-50/80 border-[#FFB800] text-gray-950 shadow-xs ring-1 ring-[#FFB800]'
                            : 'bg-gray-50/70 text-gray-600 border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        <span className="text-xl shrink-0 mt-0.5">{sectorLabels[sec].icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-extrabold text-xs text-gray-950 truncate">
                              {sectorLabels[sec].title}
                            </span>
                            <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ml-1 ${
                              isSelected ? 'bg-gray-950 border-gray-950 text-white' : 'border-gray-300 bg-white'
                            }`}>
                              {isSelected && <Check className="w-3 h-3" />}
                            </div>
                          </div>
                          <p className="text-[10px] text-gray-500 line-clamp-2 mt-0.5">
                            {sectorLabels[sec].desc}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Subscription Tier */}
              <div>
                <label className="block text-gray-700 font-bold mb-1">SaaS Subscription Plan:</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditPlan('monthly')}
                    className={`p-2.5 rounded-xl border text-center transition-all ${
                      editPlan === 'monthly'
                        ? 'bg-amber-50 border-amber-400 font-black text-amber-900 ring-1 ring-amber-400'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <span className="block font-bold">Starter</span>
                    <span className="text-[11px] font-mono">₹2,999/mo</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditPlan('annual')}
                    className={`p-2.5 rounded-xl border text-center transition-all ${
                      editPlan === 'annual'
                        ? 'bg-amber-50 border-amber-400 font-black text-amber-900 ring-1 ring-amber-400'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <span className="block font-bold">Growth</span>
                    <span className="text-[11px] font-mono">₹9,999/mo</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditPlan('enterprise')}
                    className={`p-2.5 rounded-xl border text-center transition-all ${
                      editPlan === 'enterprise'
                        ? 'bg-amber-50 border-amber-400 font-black text-amber-900 ring-1 ring-amber-400'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <span className="block font-bold">Consortium</span>
                    <span className="text-[11px] font-mono">₹24,999/yr</span>
                  </button>
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={resetEditModal}
                  className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-[#FFB800] hover:bg-amber-400 text-gray-950 font-black rounded-full shadow-md border border-amber-600/30 transition-transform active:scale-95"
                >
                  Save Firm & Statutory Updates
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* COMPLIANCE & STATUTORY DOSSIER VIEW MODAL */}
      {dossierFirm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-start sm:items-center justify-center p-3 sm:p-4 overflow-y-auto overscroll-contain">
          <div className="bg-white rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl border border-gray-200 animate-in fade-in zoom-in-95 duration-150 my-auto max-h-[92vh] flex flex-col">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#FFB800] text-gray-950 flex items-center justify-center font-black text-sm">
                  {dossierFirm.code.slice(0, 3)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-base text-white">{dossierFirm.name}</h3>
                    {dossierFirm.businessType && (
                      <span className="text-[10px] bg-slate-800 text-amber-300 border border-slate-700 px-2 py-0.5 rounded-full font-bold">
                        {dossierFirm.businessType}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 font-mono">
                    Code: {dossierFirm.code} • {dossierFirm.location}, {dossierFirm.state}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDossierFirm(null)}
                className="p-1.5 rounded-full hover:bg-white/10 text-white transition-colors"
                title="Close dossier"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs max-h-[80vh] overflow-y-auto">
              {/* Statutory Tax Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* GSTIN */}
                <div className="p-3.5 bg-amber-50/70 border border-amber-300/80 rounded-2xl">
                  <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block mb-1">
                    GST Identification Number (GSTIN)
                  </span>
                  <div className="flex items-center justify-between">
                    <strong className="text-sm font-mono text-gray-950">
                      {dossierFirm.gstin || 'Not Registered'}
                    </strong>
                    {dossierFirm.gstin && (
                      <button
                        onClick={() => copyToClipboard(dossierFirm.gstin!, 'gstin')}
                        className="p-1 text-amber-800 hover:text-amber-950 bg-amber-100 hover:bg-amber-200 rounded-lg flex items-center gap-1 text-[11px] font-bold"
                        title="Copy GSTIN"
                      >
                        {copiedField === 'gstin' ? (
                          <>
                            <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-700">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                  <span className="text-[10px] text-gray-500 mt-1 block font-mono">
                    Jurisdiction: {dossierFirm.state === 'Andhra Pradesh' ? 'AP State (Code 37)' : 'TG State (Code 36)'}
                  </span>
                </div>

                {/* PAN Number */}
                <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-2xl">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                    Income Tax PAN Card
                  </span>
                  <div className="flex items-center justify-between">
                    <strong className="text-sm font-mono text-gray-950">
                      {dossierFirm.panNumber || 'Not Specified'}
                    </strong>
                    {dossierFirm.panNumber && (
                      <button
                        onClick={() => copyToClipboard(dossierFirm.panNumber!, 'pan')}
                        className="p-1 text-gray-700 hover:text-gray-950 bg-gray-200 hover:bg-gray-300 rounded-lg flex items-center gap-1 text-[11px] font-bold"
                        title="Copy PAN"
                      >
                        {copiedField === 'pan' ? (
                          <>
                            <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-700">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                  <span className="text-[10px] text-gray-500 mt-1 block">
                    Permanent Account Number
                  </span>
                </div>
              </div>

              {/* Proprietor & Ground Contacts */}
              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200 space-y-3">
                <div className="text-xs font-black text-gray-950 flex items-center gap-2 border-b border-gray-200 pb-2">
                  <Briefcase className="w-4 h-4 text-amber-600" />
                  <span>Key Proprietor & Personnel Contacts</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-gray-500 block text-[10px] uppercase font-bold">Proprietor / Promoter:</span>
                    <strong className="text-gray-950 text-sm block">
                      {dossierFirm.proprietorName || dossierFirm.managingPartnerName}
                    </strong>
                    <div className="flex items-center gap-1 text-gray-600 font-mono mt-0.5">
                      <Phone className="w-3 h-3 text-gray-400" />
                      <span>{dossierFirm.proprietorPhone || dossierFirm.managingPartnerPhone}</span>
                    </div>
                  </div>

                  <div>
                    <span className="text-gray-500 block text-[10px] uppercase font-bold">Ground Primary Accountant:</span>
                    <strong className="text-gray-950 text-sm block">
                      {dossierFirm.accountantName || 'Not Assigned'}
                    </strong>
                    <div className="flex items-center gap-1 text-gray-600 font-mono mt-0.5">
                      <Phone className="w-3 h-3 text-gray-400" />
                      <span>{dossierFirm.accountantPhone}</span>
                    </div>
                  </div>

                  {dossierFirm.contactEmail && (
                    <div>
                      <span className="text-gray-500 block text-[10px] uppercase font-bold">Official Email:</span>
                      <div className="flex items-center gap-1 text-gray-900 mt-0.5">
                        <Mail className="w-3 h-3 text-gray-400" />
                        <span className="font-mono">{dossierFirm.contactEmail}</span>
                      </div>
                    </div>
                  )}

                  {dossierFirm.reraNumber && (
                    <div>
                      <span className="text-gray-500 block text-[10px] uppercase font-bold">RERA / Excise License:</span>
                      <span className="font-mono font-bold text-gray-900 block mt-0.5">
                        {dossierFirm.reraNumber}
                      </span>
                    </div>
                  )}

                  {dossierFirm.officeAddress && (
                    <div className="sm:col-span-2">
                      <span className="text-gray-500 block text-[10px] uppercase font-bold">Registered Office / Site Address:</span>
                      <div className="flex items-start gap-1 text-gray-900 mt-0.5">
                        <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                        <span>{dossierFirm.officeAddress}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Active Modules & SaaS Tier */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black text-gray-950">Active Business Engines</span>
                  <span className="text-xs font-mono font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded-full capitalize">
                    {dossierFirm.subscriptionPlan} • {formatINR(dossierFirm.mrrAmount)}/mo
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {dossierFirm.sectors.map((sec) => (
                    <span
                      key={sec}
                      className="px-2.5 py-1 rounded-full text-xs font-semibold bg-white border border-gray-300 text-gray-800 flex items-center gap-1.5 shadow-2xs"
                    >
                      <span>{sectorLabels[sec]?.icon || '📦'}</span>
                      <span>{sectorLabels[sec]?.title || sec}</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setDossierFirm(null)}
                  className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full font-bold"
                >
                  Close Dossier
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const firmToEdit = dossierFirm;
                    setDossierFirm(null);
                    handleOpenEditModal(firmToEdit);
                  }}
                  className="px-5 py-2 bg-[#FFB800] hover:bg-amber-400 text-gray-950 font-black rounded-full shadow border border-amber-600/30 flex items-center gap-1.5"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit Firm Details</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
