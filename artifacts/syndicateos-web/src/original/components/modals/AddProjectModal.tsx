import React, { useState } from 'react';
import {
  TenantFirm,
  Project,
  ProjectPartnerShare,
  Plot,
  ApartmentUnit,
  SectorType,
  SyndicatePartner,
  FloorFlatConfig,
  FlatConfigUnit,
  ProjectAmenity,
  PlanUploadDocument,
  PlotDistributionConfig,
  LayoutAmenity,
  FirmAccount
} from '../../types';
import { AddFirmAccountModal } from './AddFirmAccountModal';
import {
  FolderPlus,
  X,
  Building2,
  Compass,
  MapPin,
  Percent,
  DollarSign,
  Users,
  ShieldCheck,
  Plus,
  Trash2,
  Sparkles,
  Info,
  CheckCircle2,
  Layers,
  AlertCircle,
  Wine,
  Hammer,
  FileText,
  Landmark,
  Store,
  HardHat,
  IndianRupee,
  Calendar,
  Tag,
  TrendingUp,
  Receipt,
  Upload,
  Dumbbell,
  PieChart
} from 'lucide-react';
import { formatINR, formatIndianCompact } from '../../utils/formatters';
import { ConstructionPlanBuilder } from './ConstructionPlanBuilder';
import { OpenPlottingPlanBuilder } from './OpenPlottingPlanBuilder';
import { LiquorVendPlanBuilder, RetailCounterConfig, LiquorFacilityConfig } from './LiquorVendPlanBuilder';
import { CustomInfraPlanBuilder, InfraPackageConfig, InfraFacilityConfig } from './CustomInfraPlanBuilder';
import { PlanDocumentUploader } from './PlanDocumentUploader';

interface AddProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  firm: TenantFirm;
  existingPartners: SyndicatePartner[];
  onAddProject: (newProject: Project, initialPlots?: Plot[], initialUnits?: ApartmentUnit[]) => void;
  firmAccounts?: FirmAccount[];
  onAddFirmAccount?: (account: FirmAccount) => void;
}

const AVATAR_COLORS = [
  'bg-indigo-600',
  'bg-emerald-600',
  'bg-amber-600',
  'bg-sky-600',
  'bg-purple-600',
  'bg-rose-600',
  'bg-teal-600',
  'bg-blue-600',
];

// Helper to generate default initial construction floors
const createInitialFloorPlans = (numFloors: number, baseRate: number): FloorFlatConfig[] => {
  const result: FloorFlatConfig[] = [];
  for (let f = 1; f <= numFloors; f++) {
    const isPenthouseFloor = f === numFloors && numFloors >= 4;
    const floorLabel = isPenthouseFloor
      ? `Floor ${f} (Penthouse Floor)`
      : f === 1
      ? 'Floor 1 (Ground / Lower)'
      : `Floor ${f}`;

    const units: FlatConfigUnit[] = [
      {
        unitNumber: `#${f}01`,
        flatType: isPenthouseFloor ? 'Duplex Penthouse' : '3 BHK',
        sftArea: isPenthouseFloor ? 2450 : 1650,
        facing: 'East',
        baseRate,
      },
      {
        unitNumber: `#${f}02`,
        flatType: '2 BHK',
        sftArea: 1250,
        facing: 'North',
        baseRate,
      },
      {
        unitNumber: `#${f}03`,
        flatType: '2 BHK',
        sftArea: 1250,
        facing: 'West',
        baseRate,
      },
      {
        unitNumber: `#${f}04`,
        flatType: isPenthouseFloor ? 'Duplex Penthouse' : '3 BHK',
        sftArea: isPenthouseFloor ? 2450 : 1650,
        facing: 'Corner',
        baseRate,
      },
    ];

    result.push({
      floorNumber: f,
      floorLabel,
      flatsCount: units.length,
      units,
    });
  }
  return result;
};

const defaultConstructionAmenities: ProjectAmenity[] = [
  {
    id: 'amenity-clubhouse',
    name: 'Grand Clubhouse & Reception Lounge',
    plannedSqFt: 5000,
    floorLocation: 'Ground + Stilt',
    description: 'Central community hub with reception lounge & management office',
  },
  {
    id: 'amenity-gym',
    name: 'Fitness Centre & Gymnasium',
    plannedSqFt: 2500,
    floorLocation: 'Clubhouse Level 1',
    description: 'Cardio, strength equipment & stretching studio',
  },
  {
    id: 'amenity-pool',
    name: 'Swimming Pool & Sun Deck',
    plannedSqFt: 1800,
    floorLocation: 'Clubhouse Deck',
    description: 'Semi-olympic lap pool with kids wading section',
  },
  {
    id: 'amenity-games',
    name: 'Indoor Badminton & Games Room',
    plannedSqFt: 1600,
    floorLocation: 'Clubhouse Level 2',
    description: 'Synthetic court, table tennis & billiards',
  },
  {
    id: 'amenity-hall',
    name: 'Multipurpose Banquet Hall',
    plannedSqFt: 3000,
    floorLocation: 'Ground Floor Block B',
    description: 'A/C banquet hall with pantry for society events',
  },
  {
    id: 'amenity-creche',
    name: 'Children Play Area & Creche',
    plannedSqFt: 1200,
    floorLocation: 'Central Podium',
    description: 'Safe soft play zone & outdoor rubberized tot-lot',
  },
];

const defaultPlotDistribution: PlotDistributionConfig = {
  eastPlotsCount: 0,
  eastAreaSqYards: 0,
  northPlotsCount: 0,
  northAreaSqYards: 0,
  westPlotsCount: 0,
  westAreaSqYards: 0,
  southPlotsCount: 0,
  southAreaSqYards: 0,
  cornerPlotsCount: 0,
  cornerAreaSqYards: 0,
  commercialPlotsCount: 0,
  commercialAreaSqYards: 0,
  // backward-compatibility
  standardPlotsCount: 0,
  standardAreaSqYards: 0,
  premiumPlotsCount: 0,
  premiumAreaSqYards: 0,
};

const defaultLayoutAmenities: LayoutAmenity[] = [
  {
    id: 'layout-amenity-park',
    name: "Statutory 10% Children's Park & Green Belt",
    allocatedAreaSqYards: 2904,
    category: 'park',
  },
  {
    id: 'layout-amenity-oht',
    name: 'Overhead Water Tank (OHT 50,000L) & Sump Utility',
    allocatedAreaSqYards: 400,
    category: 'utilities',
  },
  {
    id: 'layout-amenity-gate',
    name: 'Gated Grand Entrance Plaza & Security Gatehouse',
    allocatedAreaSqYards: 250,
    category: 'clubhouse',
  },
];

const defaultLiquorCounters: RetailCounterConfig[] = [
  { id: 'c-1', name: 'Excise Vend #01 - Highway Transit', category: 'High-Footfall Transit', sqFtArea: 450, dailySalesTarget: 400000, staffCount: 4 },
  { id: 'c-2', name: 'Excise Vend #02 - Premium Walk-in Lounge', category: 'Premium Walk-in Lounge', sqFtArea: 800, dailySalesTarget: 450000, staffCount: 5 },
  { id: 'c-3', name: 'Excise Vend #03 - Urban Neighborhood', category: 'Urban Neighborhood', sqFtArea: 350, dailySalesTarget: 280000, staffCount: 3 },
  { id: 'c-4', name: 'Excise Vend #04 - Bypass Express', category: 'Highway Express', sqFtArea: 400, dailySalesTarget: 320000, staffCount: 3 },
];

const defaultLiquorFacilities: LiquorFacilityConfig[] = [
  { id: 'lf-1', name: 'Central Cold Storage & Walk-in Chiller', sqFtArea: 1200, description: 'Heavy refrigerated walk-in chamber for beer & premium stock' },
  { id: 'lf-2', name: 'High-Security Currency Vault & Cash Counting Room', sqFtArea: 250, description: 'Double-lock biometric cash deposit safe with CCTV' },
  { id: 'lf-3', name: 'Depot Liaison & Partner Settlement Office', sqFtArea: 350, description: 'Daily TGSBCL / APSBL indent dispatch coordination desk' },
];

const defaultInfraPackages: InfraPackageConfig[] = [
  { id: 'pkg-1', name: 'Package 1 - Earthwork & Granular Sub-base (GSB)', chainage: 'KM 0/0 to KM 1/5', scopeCategory: 'Earth Excavation & Embankment', targetCompletionMonths: 4 },
  { id: 'pkg-2', name: 'Package 2 - Dense Bituminous Macadam (DBM) & Wearing Coat', chainage: 'KM 1/5 to KM 3/5', scopeCategory: 'Asphalt Paving & Road Marking', targetCompletionMonths: 6 },
  { id: 'pkg-3', name: 'Package 3 - Reinforced Concrete Box Culverts & Drainage', chainage: 'Cross Drainages (4 Nos)', scopeCategory: 'RCC Structural Works', targetCompletionMonths: 3 },
];

const defaultInfraFacilities: InfraFacilityConfig[] = [
  { id: 'if-1', name: 'Ready-Mix Concrete Batching Plant (60 m³/hr)', areaString: '1.5 Acres', purpose: 'On-site automated concrete & aggregate mixing' },
  { id: 'if-2', name: 'Heavy Machinery Maintenance Workshop & Fuel Bunker', areaString: '4,500 SFT', purpose: 'Excavator, tipper & road roller servicing' },
  { id: 'if-3', name: 'Resident Engineer Quality Control (QC) Testing Lab', areaString: '1,200 SFT', purpose: 'Cube compressive strength & bitumen penetration testing' },
];

// Helper to proportionally sync partner capital estimated invest values with total estimated project outlay
const syncPartnersCapitalWithTotalOutlay = (
  partnersList: ProjectPartnerShare[],
  outlay: number
): ProjectPartnerShare[] => {
  if (partnersList.length === 0 || outlay <= 0) return partnersList;

  let allocatedSoFar = 0;
  return partnersList.map((p, idx) => {
    if (idx === partnersList.length - 1) {
      // Last partner receives exact remainder to ensure 100% exact match
      const remainder = Math.max(0, outlay - allocatedSoFar);
      return {
        ...p,
        initialCapital: remainder,
      };
    }
    const shareAmount = Math.round((outlay * (Number(p.equityPercent) || 0)) / 100);
    allocatedSoFar += shareAmount;
    return {
      ...p,
      initialCapital: shareAmount,
    };
  });
};

const DEFAULT_INITIAL_OUTLAY = 48000000;

export const AddProjectModal: React.FC<AddProjectModalProps> = ({
  isOpen,
  onClose,
  firm,
  existingPartners,
  onAddProject,
  firmAccounts = [],
  onAddFirmAccount,
}) => {
  // Project ID established upfront for strict account isolation and mapping
  const [projectId] = useState<string>(() => `proj-${Date.now().toString().slice(-6)}`);

  // Dedicated Project Accounts available in this modal:
  // - Cash accounts (field_petty_cash / Cash Safe Vault) are available for all projects of this firm
  // - Existing bank accounts already assigned to other projects are filtered out so they never leak into this new project!
  const availableFirmAccounts = firmAccounts.filter((a) => {
    if (a.firmId !== firm.id) return false;
    if (a.accountType === 'field_petty_cash') return true;
    if (a.linkedProjectId && a.linkedProjectId !== '' && a.linkedProjectId !== 'all' && a.linkedProjectId !== projectId) {
      return false; // belongs to another existing project
    }
    return true;
  });
  const [selectedFirmAccountId, setSelectedFirmAccountId] = useState<string>(() => {
    const primary = availableFirmAccounts.find((a) => a.isPrimary);
    return primary ? primary.id : availableFirmAccounts[0]?.id || '';
  });
  const [isAddAccountSubModalOpen, setIsAddAccountSubModalOpen] = useState(false);
  // Sector options filtered by what the firm supports
  const defaultSector: SectorType = firm.sectors.includes('real_estate_open_plotting')
    ? 'real_estate_open_plotting'
    : firm.sectors[0] || 'real_estate_open_plotting';

  // Basic Info State - starts clean with empty fields
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [sector, setSector] = useState<SectorType>(defaultSector);
  const [status, setStatus] = useState<Project['status']>('active_sales');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [targetCompletionDate, setTargetCompletionDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 14);
    return d.toISOString().split('T')[0];
  });

  // Location & Statutory - start clean/empty with placeholders
  const [location, setLocation] = useState('');
  const [mandalDistrict, setMandalDistrict] = useState('');
  const [surveyNumbers, setSurveyNumbers] = useState('');
  const [approvalAuthority, setApprovalAuthority] = useState<string>('');
  const [lpOrReraNumber, setLpOrReraNumber] = useState('');

  // Specifications - start clean
  const [extentValue, setExtentValue] = useState<number>(0);
  const [extentUnit, setExtentUnit] = useState<string>(
    defaultSector === 'real_estate_construction' ? 'Units / Flats' :
    defaultSector === 'liquor_vends' ? 'Counters / Shops' :
    defaultSector === 'custom_infra' ? 'KM Stretch' : 'Acres'
  );
  const [roadWidth, setRoadWidth] = useState<20 | 30 | 40 | 60>(30);
  const [openSpacePercent, setOpenSpacePercent] = useState<number>(10);
  const [floorRatePerSqYard, setFloorRatePerSqYard] = useState<number>(0);
  const [baseSqFtRate, setBaseSqFtRate] = useState<number>(0);
  const [totalEstimatedOutlay, setTotalEstimatedOutlay] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [autoGeneratePlots, setAutoGeneratePlots] = useState(false);

  // Sector-specific properties
  const [floorsCount, setFloorsCount] = useState<number>(5);
  const [facingPremium, setFacingPremium] = useState<number>(150);
  const [countersCount, setCountersCount] = useState<number>(4);
  const [dailySalesTarget, setDailySalesTarget] = useState<number>(350000);
  const [securityDeposit, setSecurityDeposit] = useState<number>(5000000);
  const [contractType, setContractType] = useState<string>('Item-Rate Schedule (BoQ)');
  const [retentionPercent, setRetentionPercent] = useState<number>(5.0);

  // CUSTOMIZATION: Construction Plan Builder State
  const [floorPlans, setFloorPlans] = useState<FloorFlatConfig[]>(() =>
    createInitialFloorPlans(5, 4800)
  );
  const [amenities, setAmenities] = useState<ProjectAmenity[]>(defaultConstructionAmenities);

  // CUSTOMIZATION: Open Plotting Plan Builder State
  const [plotDistribution, setPlotDistribution] = useState<PlotDistributionConfig>(defaultPlotDistribution);
  const [layoutAmenities, setLayoutAmenities] = useState<LayoutAmenity[]>(defaultLayoutAmenities);

  // CUSTOMIZATION: Liquor Vends State
  const [liquorCounters, setLiquorCounters] = useState<RetailCounterConfig[]>(defaultLiquorCounters);
  const [liquorFacilities, setLiquorFacilities] = useState<LiquorFacilityConfig[]>(defaultLiquorFacilities);

  // CUSTOMIZATION: Custom Infra State
  const [infraPackages, setInfraPackages] = useState<InfraPackageConfig[]>(defaultInfraPackages);
  const [infraFacilities, setInfraFacilities] = useState<InfraFacilityConfig[]>(defaultInfraFacilities);

  // CUSTOMIZATION: Plan & Blueprint Upload Documents
  const [planDocuments, setPlanDocuments] = useState<PlanUploadDocument[]>([]);

  // Navigation tab inside modal for quick jump
  const [activeFormTab, setActiveFormTab] = useState<'all' | 'custom_plan' | 'blueprint_upload' | 'partners' | 'accounts'>('all');

  // Dynamic Partners for THIS project (Partners vary from project to project, initialized empty so user explicitly assigns partners)
  const [projectPartners, setProjectPartners] = useState<ProjectPartnerShare[]>([]);

  const [error, setError] = useState('');

  if (!isOpen) return null;

  // Auto generate project code when name changes
  const handleNameChange = (val: string) => {
    setName(val);
    if (!code || code.length <= 8) {
      const words = val.trim().split(/\s+/);
      const suggested = words.map((w) => w.charAt(0).toUpperCase()).join('');
      if (suggested.length >= 2) {
        setCode(`${suggested}-${Math.floor(10 + Math.random() * 90)}`);
      }
    }
  };

  // Unified Outlay Handler: updates Estimated Project Cost AND auto-syncs partners' Capital Estimated Invest Value
  const handleOutlayChange = (val: number) => {
    const numericVal = Math.max(0, val);
    setTotalEstimatedOutlay(numericVal);
    setProjectPartners((prev) => syncPartnersCapitalWithTotalOutlay(prev, numericVal));
  };

  // Handle Sector Engine Change dynamically updates unit types and sub-builders without injecting dummy data
  const handleSectorChange = (newSector: SectorType) => {
    setSector(newSector);

    if (newSector === 'real_estate_open_plotting') {
      setExtentUnit('Acres');
    } else if (newSector === 'real_estate_construction') {
      setExtentUnit('Units / Flats');
      setFloorsCount(5);
      setFloorPlans(createInitialFloorPlans(5, baseSqFtRate || 4800));
    } else if (newSector === 'liquor_vends') {
      setExtentUnit('Counters / Shops');
      setCountersCount(4);
    } else if (newSector === 'custom_infra') {
      setExtentUnit('KM Stretch');
      setContractType('Item-Rate Schedule (BoQ)');
      setRetentionPercent(5.0);
    }

    // Update partner roles based on new sector
    setProjectPartners((prev) => {
      const updatedRoles = prev.map((p, idx) => {
        let role = p.roleInProject;
        if (newSector === 'real_estate_open_plotting') {
          role =
            idx === 0
              ? 'Managing Partner (Land & SRO Liaison)'
              : idx === 1
              ? 'Civil & Earthwork Contractor Partner'
              : 'Marketing & Investor Partner';
        } else if (newSector === 'real_estate_construction') {
          role =
            idx === 0
              ? 'Managing Partner (Master Developer & Financing)'
              : idx === 1
              ? 'Structural Construction & RCC Partner'
              : 'Finishing & Architectural Lead';
        } else if (newSector === 'liquor_vends') {
          role =
            idx === 0
              ? 'Managing Partner (Tender & License Holder)'
              : idx === 1
              ? 'Daily Depot Procurement & Logistics Partner'
              : 'Cash Collection & Reconciliation Lead';
        } else if (newSector === 'custom_infra') {
          role =
            idx === 0
              ? 'Managing Partner (Turnkey EPC Lead & Billing)'
              : idx === 1
              ? 'Heavy Machinery & Earthwork Contractor'
              : 'Civil Structural & Site Operations Partner';
        }
        return {
          ...p,
          roleInProject: role,
        };
      });
      return totalEstimatedOutlay > 0
        ? syncPartnersCapitalWithTotalOutlay(updatedRoles, totalEstimatedOutlay)
        : updatedRoles;
    });
  };

  // Partners equity calculations
  const totalEquity = projectPartners.reduce((sum, p) => sum + (Number(p.equityPercent) || 0), 0);
  const totalCapital = projectPartners.reduce((sum, p) => sum + (Number(p.initialCapital) || 0), 0);

  // Manual auto-sync trigger: Distribute Total Estimated Project Cost into Partner Capital
  const handleAutoSyncCapitalWithOutlay = () => {
    setProjectPartners(syncPartnersCapitalWithTotalOutlay(projectPartners, totalEstimatedOutlay));
  };

  // Sync Total Estimated Project Cost to match the sum of Capital Estimated Invest Values
  const handleSyncOutlayWithCapital = () => {
    if (totalCapital > 0) {
      setTotalEstimatedOutlay(totalCapital);
      // Re-normalize equity % to 100%
      let allocatedEq = 0;
      const normalized = projectPartners.map((p, idx) => {
        if (idx === projectPartners.length - 1) {
          return {
            ...p,
            equityPercent: Number((Math.max(0, 100 - allocatedEq)).toFixed(2)),
          };
        }
        const eq = Number(((p.initialCapital / totalCapital) * 100).toFixed(2));
        allocatedEq += eq;
        return {
          ...p,
          equityPercent: eq,
        };
      });
      setProjectPartners(normalized);
    }
  };

  const handlePartnerChange = (index: number, field: keyof ProjectPartnerShare, value: any) => {
    const updated = [...projectPartners];
    if (field === 'equityPercent') {
      const newEquity = Math.max(0, Math.min(100, Number(value) || 0));
      // Auto-recalculate Capital Estimated Invest Value from new Equity %
      const autoCapital = Math.round((totalEstimatedOutlay * newEquity) / 100);
      updated[index] = {
        ...updated[index],
        equityPercent: newEquity,
        initialCapital: autoCapital,
      };
    } else if (field === 'initialCapital') {
      const newCapital = Math.max(0, Number(value) || 0);
      updated[index] = {
        ...updated[index],
        initialCapital: newCapital,
      };
      // Calculate new total capital across all partners
      const newTotalCapital = updated.reduce((sum, p) => sum + (Number(p.initialCapital) || 0), 0);
      if (newTotalCapital > 0) {
        // Automatically sync Total Estimated Project Cost with sum of partner capital
        setTotalEstimatedOutlay(newTotalCapital);
        // Automatically recalculate every partner's Equity % so it sums to 100%
        let allocatedEquitySoFar = 0;
        updated.forEach((p, idx) => {
          if (idx === updated.length - 1) {
            p.equityPercent = Number((Math.max(0, 100 - allocatedEquitySoFar)).toFixed(2));
          } else {
            const eq = Number(((p.initialCapital / newTotalCapital) * 100).toFixed(2));
            p.equityPercent = eq;
            allocatedEquitySoFar += eq;
          }
        });
      }
    } else {
      updated[index] = {
        ...updated[index],
        [field]: value,
      };
    }
    setProjectPartners(updated);
  };

  const handleAddPartnerRow = () => {
    const unusedExisting = existingPartners.find(
      (ep) => !projectPartners.some((pp) => pp.partnerId === ep.id || pp.name === ep.name)
    );

    let defaultRole = 'Investor Partner';
    if (sector === 'real_estate_construction') defaultRole = 'MEP & Finishes Partner';
    else if (sector === 'liquor_vends') defaultRole = 'Counter Logistics Partner';
    else if (sector === 'custom_infra') defaultRole = 'Site Quality Engineer Partner';

    const currentTotalEquity = projectPartners.reduce((sum, p) => sum + (Number(p.equityPercent) || 0), 0);
    const unallocatedEquity = Math.max(0, Number((100 - currentTotalEquity).toFixed(2)));
    const newEquity = unallocatedEquity > 0 ? unallocatedEquity : (projectPartners.length === 0 ? 100.0 : 10.0);
    const newCapital = Math.round((totalEstimatedOutlay * newEquity) / 100);

    const newPartner: ProjectPartnerShare = unusedExisting
      ? {
          partnerId: unusedExisting.id,
          name: unusedExisting.name,
          phone: unusedExisting.phone,
          roleInProject: unusedExisting.roleDescription || defaultRole,
          equityPercent: newEquity,
          initialCapital: newCapital,
          drawings: 0,
          shareOfFieldExpenses: 0,
          avatarColor: unusedExisting.avatarColor || AVATAR_COLORS[projectPartners.length % AVATAR_COLORS.length],
        }
      : {
          partnerId: `partner-proj-${Date.now()}`,
          name: '',
          phone: '+91 ',
          roleInProject: defaultRole,
          equityPercent: newEquity,
          initialCapital: newCapital,
          drawings: 0,
          shareOfFieldExpenses: 0,
          avatarColor: AVATAR_COLORS[projectPartners.length % AVATAR_COLORS.length],
        };

    setProjectPartners([...projectPartners, newPartner]);
  };

  const handleRemovePartnerRow = (index: number) => {
    const updated = projectPartners.filter((_, i) => i !== index);
    setProjectPartners(updated);
  };

  const handleSplitRemainingEqually = () => {
    if (projectPartners.length === 0) return;
    const equalShare = Number((100 / projectPartners.length).toFixed(2));
    const remainder = Number((100 - equalShare * (projectPartners.length - 1)).toFixed(2));

    let allocatedCapSoFar = 0;
    const balanced = projectPartners.map((p, idx) => {
      const isFirst = idx === 0;
      const isLast = idx === projectPartners.length - 1;
      const equity = isFirst ? remainder : equalShare;
      let cap = 0;
      if (isLast) {
        cap = Math.max(0, totalEstimatedOutlay - allocatedCapSoFar);
      } else {
        cap = Math.round((totalEstimatedOutlay * equity) / 100);
        allocatedCapSoFar += cap;
      }
      return {
        ...p,
        equityPercent: equity,
        initialCapital: cap,
      };
    });
    setProjectPartners(balanced);
  };

  // Helper text for Project Outlay explanation per sector
  const getOutlayExplanation = () => {
    switch (sector) {
      case 'real_estate_open_plotting':
        return 'land procurement, statutory DTCP/CRDA LP fees, earthwork, BT roads, electricity lines, and launch marketing';
      case 'real_estate_construction':
        return 'RCC structural casting, cement/steel procurement, finishing, labor contracts, and municipal permissions';
      case 'liquor_vends':
        return 'gazette tender application, non-refundable annual excise license fee, shop rent deposits, and initial stock draw inventory';
      case 'custom_infra':
        return 'turnkey EPC execution, heavy machinery mobilization, sub-contractor wages, raw material, and quality inspection';
      default:
        return 'total budgeted capital expenditure required to execute and complete this venture';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Please provide a Project / Venture Name.');
      return;
    }

    if (!code.trim()) {
      setError('Please provide a Project Code / Identifier.');
      return;
    }

    // If partners were added, ensure all have names
    for (const p of projectPartners) {
      if (!p.name.trim()) {
        setError('Please provide a name for all added partners, or remove unused partner rows.');
        return;
      }
    }

    const projectId = `proj-${code.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now().toString().slice(-4)}`;

    // Calculate aggregated metrics from custom construction plan
    const totalResidentialSft = floorPlans.reduce(
      (sum, f) => sum + f.units.reduce((uSum, u) => uSum + (Number(u.sftArea) || 0), 0),
      0
    );
    const totalAmenitiesSft = amenities.reduce((sum, a) => sum + (Number(a.plannedSqFt) || 0), 0);
    const commonCirculationSft = Math.round((totalResidentialSft + totalAmenitiesSft) * 0.18);
    const totalBuiltUpAreaSft = totalResidentialSft + totalAmenitiesSft + commonCirculationSft;
    const totalCustomFlats = floorPlans.reduce((sum, f) => sum + f.units.length, 0);

    const newProject: Project = {
      id: projectId,
      firmId: firm.id,
      name: name.trim(),
      code: code.trim().toUpperCase(),
      sector,
      location: location.trim(),
      mandalDistrict: mandalDistrict.trim(),
      surveyNumbers: surveyNumbers.trim(),
      approvalAuthority,
      lpOrReraNumber: lpOrReraNumber.trim(),
      extentValue:
        sector === 'real_estate_construction'
          ? totalCustomFlats || extentValue
          : Number(extentValue) || 0,
      extentUnit,
      roadWidth: sector === 'real_estate_open_plotting' ? roadWidth : undefined,
      openSpacePercent: sector === 'real_estate_open_plotting' ? openSpacePercent : undefined,
      floorRatePerSqYard: sector === 'real_estate_open_plotting' ? floorRatePerSqYard : undefined,
      baseSqFtRate: sector === 'real_estate_construction' ? baseSqFtRate : undefined,
      totalEstimatedOutlay: Number(totalEstimatedOutlay) || 0,
      status,
      startDate,
      targetCompletionDate,
      partners: projectPartners,
      notes: notes.trim(),
      plotsCount:
        sector === 'real_estate_open_plotting'
          ? (plotDistribution.eastPlotsCount || 0) +
            (plotDistribution.northPlotsCount || 0) +
            (plotDistribution.westPlotsCount || 0) +
            (plotDistribution.southPlotsCount || 0) +
            (plotDistribution.cornerPlotsCount || 0) +
            (plotDistribution.commercialPlotsCount || 0)
          : sector === 'real_estate_construction'
          ? totalCustomFlats
          : 0,
      floorsCount: sector === 'real_estate_construction' ? floorsCount : undefined,
      flatsPerFloor: sector === 'real_estate_construction' ? Math.round(totalCustomFlats / floorsCount) : undefined,
      facingPremium: sector === 'real_estate_construction' ? facingPremium : undefined,
      floorPlans: sector === 'real_estate_construction' ? floorPlans : undefined,
      amenities: sector === 'real_estate_construction' ? amenities : undefined,
      totalResidentialSft: sector === 'real_estate_construction' ? totalResidentialSft : undefined,
      totalAmenitiesSft: sector === 'real_estate_construction' ? totalAmenitiesSft : undefined,
      totalBuiltUpAreaSft: sector === 'real_estate_construction' ? totalBuiltUpAreaSft : undefined,
      plotDistribution: sector === 'real_estate_open_plotting' ? plotDistribution : undefined,
      layoutAmenities: sector === 'real_estate_open_plotting' ? layoutAmenities : undefined,
      planDocuments: planDocuments.length > 0 ? planDocuments : undefined,
      countersCount: sector === 'liquor_vends' ? liquorCounters.length : undefined,
      dailySalesTarget: sector === 'liquor_vends' ? dailySalesTarget : undefined,
      securityDeposit: sector === 'liquor_vends' ? securityDeposit : undefined,
      contractType: sector === 'custom_infra' ? contractType : undefined,
      retentionPercent: sector === 'custom_infra' ? retentionPercent : undefined,
    };

    // Auto-generate plots or apartment units matching the user's custom plan!
    let initialPlots: Plot[] | undefined;
    let initialUnits: ApartmentUnit[] | undefined;

    if (autoGeneratePlots && sector === 'real_estate_open_plotting') {
      initialPlots = [];
      let plotIdCounter = 1;

      // 1. East Facing Plots (Sunrise / Vastu)
      const eastCount = plotDistribution.eastPlotsCount || 0;
      const eastArea = plotDistribution.eastAreaSqYards || 0;
      for (let i = 1; i <= eastCount; i++) {
        initialPlots.push({
          id: 5000 + plotIdCounter,
          firmId: firm.id,
          projectId: newProject.id,
          plotNumber: `Plot #${plotIdCounter}`,
          areaSqYards: eastArea,
          facing: 'East',
          ratePerSqYard: floorRatePerSqYard + 750,
          status: 'available',
          buyerName: undefined,
          buyerPhone: undefined,
          advanceReceived: undefined,
          paymentMilestone: undefined,
          blockName: 'Sector A - East Avenue',
          dimensions: "36' × 66'",
          roadWidthFt: 40,
          notes: 'Premium 40ft road East-facing plot.',
        });
        plotIdCounter++;
      }

      // 2. North Facing Plots (Kubera Vastu)
      const northCount = plotDistribution.northPlotsCount || 0;
      const northArea = plotDistribution.northAreaSqYards || 0;
      for (let i = 1; i <= northCount; i++) {
        initialPlots.push({
          id: 5000 + plotIdCounter,
          firmId: firm.id,
          projectId: newProject.id,
          plotNumber: `Plot #${plotIdCounter}`,
          areaSqYards: northArea,
          facing: 'North',
          ratePerSqYard: floorRatePerSqYard + 500,
          status: 'available',
          blockName: 'Sector B - North Boulevard',
          dimensions: "33' × 60'",
          roadWidthFt: 33,
          notes: 'Auspicious North-facing plot with 33ft CC road approach.',
        });
        plotIdCounter++;
      }

      // 3. West Facing Plots (Standard Vastu)
      const westCount = plotDistribution.westPlotsCount || 0;
      const westArea = plotDistribution.westAreaSqYards || 0;
      for (let i = 1; i <= westCount; i++) {
        initialPlots.push({
          id: 5000 + plotIdCounter,
          firmId: firm.id,
          projectId: newProject.id,
          plotNumber: `Plot #${plotIdCounter}`,
          areaSqYards: westArea,
          facing: 'West',
          ratePerSqYard: floorRatePerSqYard,
          status: 'available',
          blockName: 'Sector C - West Avenue',
          dimensions: "33' × 55'",
          roadWidthFt: 33,
          notes: 'Standard West-facing demarcated plot with 33ft road.',
        });
        plotIdCounter++;
      }

      // 4. South Facing Plots (Budget Residential)
      const southCount = plotDistribution.southPlotsCount || 0;
      const southArea = plotDistribution.southAreaSqYards || 0;
      for (let i = 1; i <= southCount; i++) {
        initialPlots.push({
          id: 5000 + plotIdCounter,
          firmId: firm.id,
          projectId: newProject.id,
          plotNumber: `Plot #${plotIdCounter}`,
          areaSqYards: southArea,
          facing: 'South',
          ratePerSqYard: floorRatePerSqYard - 500,
          status: 'available',
          blockName: 'Sector D - South Row',
          dimensions: "30' × 54'",
          roadWidthFt: 30,
          notes: 'Value-budget residential plot with 30ft road.',
        });
        plotIdCounter++;
      }

      // 5. Corner Plots (NE / SE Corners)
      const cornerCount = plotDistribution.cornerPlotsCount || 0;
      const cornerArea = plotDistribution.cornerAreaSqYards || 0;
      for (let i = 1; i <= cornerCount; i++) {
        initialPlots.push({
          id: 5000 + plotIdCounter,
          firmId: firm.id,
          projectId: newProject.id,
          plotNumber: `Plot #${plotIdCounter}`,
          areaSqYards: cornerArea,
          facing: 'North-East Corner',
          ratePerSqYard: floorRatePerSqYard + 1500,
          status: 'available',
          blockName: 'Corner Enclave',
          dimensions: "40' × 74'",
          roadWidthFt: 40,
          notes: 'Auspicious North-East corner junction plot with dual road frontage.',
        });
        plotIdCounter++;
      }

      // 6. Commercial Frontage Plots
      const commercialCount = plotDistribution.commercialPlotsCount || 0;
      const commercialArea = plotDistribution.commercialAreaSqYards || 0;
      for (let i = 1; i <= commercialCount; i++) {
        initialPlots.push({
          id: 5000 + plotIdCounter,
          firmId: firm.id,
          projectId: newProject.id,
          plotNumber: `Plot #${plotIdCounter}`,
          areaSqYards: commercialArea,
          facing: 'North',
          ratePerSqYard: floorRatePerSqYard + 3500,
          status: 'available',
          blockName: 'Commercial Frontage Plaza',
          dimensions: "45' × 100'",
          roadWidthFt: 60,
          notes: 'Masterplan 60ft arterial road commercial frontage plot.',
        });
        plotIdCounter++;
      }
    } else if (autoGeneratePlots && sector === 'real_estate_construction') {
      // Generate initial units strictly from the user's custom FloorFlatConfig!
      initialUnits = [];
      let isFirstUnit = true;

      floorPlans.forEach((floor) => {
        floor.units.forEach((unit) => {
          const isCorner = unit.facing === 'Corner';
          const isEast = unit.facing === 'East';
          const unitRate = unit.baseRate || baseSqFtRate;
          const unitFacingPremium = isCorner ? facingPremium + 100 : isEast ? facingPremium : 50;
          const floorRise = (floor.floorNumber - 1) * 50;

          initialUnits!.push({
            id: `apt-${newProject.id}-${unit.unitNumber.replace('#', '')}`,
            firmId: firm.id,
            projectId: newProject.id,
            unitNumber: unit.unitNumber,
            floor: floor.floorNumber,
            flatType: unit.flatType as any,
            sftArea: unit.sftArea,
            facing: unit.facing as any,
            baseRate: unitRate,
            facingPremium: unitFacingPremium,
            floorRise,
            parkingFee: 250000,
            amenitiesFee: 150000,
            status: 'available',
            buyerName: undefined,
            buyerPhone: undefined,
            advanceReceived: 0,
            currentMilestone: undefined,
          });

          if (isFirstUnit) isFirstUnit = false;
        });
      });
    }

    onAddProject(newProject, initialPlots, initialUnits);
    onClose();
  };

  // Helper for safe plot count
  function distributionPlotsCount(val: number, fallback: number) {
    return val !== undefined && val !== null ? Math.max(0, val) : fallback;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-2 sm:p-4 overflow-y-auto bg-black/80 backdrop-blur-sm">
      <div className="relative bg-white rounded-3xl max-w-5xl w-full my-3 sm:my-6 shadow-2xl border border-gray-200 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header - Fixed & Pinned at Top (guarantees top part is ALWAYS 100% visible) */}
        <div className="sticky top-0 bg-white px-5 sm:px-7 py-4 border-b border-gray-200 flex items-center justify-between shrink-0 z-30 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#FFB800] flex items-center justify-center text-gray-950 font-black shadow-sm border border-amber-500/40 shrink-0">
              <FolderPlus className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-gray-100 text-gray-800">
                  {firm.code}
                </span>
                <span className="text-xs text-gray-500 font-semibold truncate max-w-[200px] sm:max-w-xs">
                  {firm.name}
                </span>
              </div>
              <h3 className="text-lg sm:text-xl font-black text-gray-950">
                + Add New Syndicate Project / Venture
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-950 hover:bg-gray-100 rounded-full transition-colors shrink-0"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Jump Bar across Form Sections */}
        <div className="bg-gray-50/90 px-5 sm:px-7 py-2.5 border-b border-gray-200 flex items-center gap-2 overflow-x-auto shrink-0 z-20">
          <span className="text-[10px] font-bold text-gray-500 uppercase shrink-0">Sections:</span>
          <button
            type="button"
            onClick={() => setActiveFormTab('all')}
            className={`px-3 py-1 rounded-lg text-xs font-bold shrink-0 transition-colors ${
              activeFormTab === 'all'
                ? 'bg-gray-950 text-white shadow-2xs'
                : 'text-gray-700 hover:bg-gray-200/80'
            }`}
          >
            All Sections
          </button>
          <button
            type="button"
            onClick={() => setActiveFormTab('custom_plan')}
            className={`px-3 py-1 rounded-lg text-xs font-bold shrink-0 transition-colors flex items-center gap-1.5 ${
              activeFormTab === 'custom_plan'
                ? 'bg-amber-500 text-gray-950 shadow-2xs font-black'
                : 'text-gray-700 hover:bg-gray-200/80'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>
              {sector === 'real_estate_construction'
                ? 'Construction Floor & Flats Matrix'
                : sector === 'real_estate_open_plotting'
                ? 'Demarcated Plots Matrix'
                : 'Physical Layout & Outlets'}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveFormTab('blueprint_upload')}
            className={`px-3 py-1 rounded-lg text-xs font-bold shrink-0 transition-colors flex items-center gap-1.5 ${
              activeFormTab === 'blueprint_upload'
                ? 'bg-amber-500 text-gray-950 shadow-2xs font-black'
                : 'text-gray-700 hover:bg-gray-200/80'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Blueprint &amp; Plan Upload ({planDocuments.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveFormTab('partners')}
            className={`px-3 py-1 rounded-lg text-xs font-bold shrink-0 transition-colors flex items-center gap-1.5 ${
              activeFormTab === 'partners'
                ? 'bg-amber-500 text-gray-950 shadow-2xs font-black'
                : 'text-gray-700 hover:bg-gray-200/80'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Syndicate Partners ({projectPartners.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveFormTab('accounts')}
            className={`px-3 py-1 rounded-lg text-xs font-bold shrink-0 transition-colors flex items-center gap-1.5 ${
              activeFormTab === 'accounts'
                ? 'bg-amber-500 text-gray-950 shadow-2xs font-black'
                : 'text-gray-700 hover:bg-gray-200/80'
            }`}
          >
            <Landmark className="w-3.5 h-3.5" />
            <span>Project Accounts &amp; Banking ({availableFirmAccounts.length})</span>
          </button>
        </div>

        {/* Form Container with Smooth Scrollable Body and Pinned Footer */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden min-h-0">
          <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-6 overscroll-contain">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-2 text-xs text-red-700 font-semibold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* SECTION 1: PROJECT IDENTITY */}
            {(activeFormTab === 'all' || activeFormTab === 'custom_plan') && (
              <div className="bg-gray-50/80 rounded-2xl p-5 border border-gray-200 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-black uppercase text-gray-800 tracking-wider">
                    <Layers className="w-4 h-4 text-amber-600" />
                    <span>1. Project Identity &amp; Sector Engine</span>
                  </div>
                  <span className="text-[11px] text-gray-500 font-semibold hidden sm:inline">
                    Select sector engine to adapt form fields
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Project / Venture Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={
                        sector === 'real_estate_open_plotting'
                          ? 'e.g. Amaravati Phase 2 - Krishna Riverfront Enclave'
                          : sector === 'real_estate_construction'
                          ? 'e.g. Amaravati Heights - Royal Luxury Towers'
                          : sector === 'liquor_vends'
                          ? 'e.g. Warangal Urban Retail Outlet Cluster - Zone 1'
                          : 'e.g. Mirchi Yard Cold Storage & Terminal Logistics'
                      }
                      value={name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-xs font-semibold text-gray-950 focus:ring-2 focus:ring-[#FFB800] focus:border-transparent outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Project Code / Tag *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. AV-KR2"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-xs font-mono font-bold text-gray-950 focus:ring-2 focus:ring-[#FFB800] focus:border-transparent outline-none uppercase"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Venture Sector Engine *
                    </label>
                    <select
                      value={sector}
                      onChange={(e) => handleSectorChange(e.target.value as SectorType)}
                      className="w-full px-3 py-2.5 bg-amber-50/70 border-2 border-amber-300 text-gray-950 font-bold rounded-xl text-xs focus:ring-2 focus:ring-[#FFB800] outline-none cursor-pointer"
                    >
                      {firm.sectors.includes('real_estate_open_plotting') && (
                        <option value="real_estate_open_plotting">Real Estate - Open Plotting</option>
                      )}
                      {firm.sectors.includes('real_estate_construction') && (
                        <option value="real_estate_construction">Apartments &amp; Construction</option>
                      )}
                      {firm.sectors.includes('liquor_vends') && (
                        <option value="liquor_vends">Liquor Vends Register</option>
                      )}
                      {firm.sectors.includes('custom_infra') && (
                        <option value="custom_infra">Custom Infra &amp; Civil Works</option>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Project Development Status
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as Project['status'])}
                      className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-xs font-semibold text-gray-950 focus:ring-2 focus:ring-[#FFB800] outline-none"
                    >
                      <option value="planning">Planning &amp; Pre-acquisition</option>
                      <option value="approvals">Statutory Clearances &amp; LP in Progress</option>
                      <option value="active_sales">Active Sales, Booking &amp; Operations</option>
                      <option value="development">Under Execution / Site Civil Development</option>
                      <option value="completed">Completed / Handed Over</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Venture Launch / Start Date
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-xs font-semibold text-gray-950 focus:ring-2 focus:ring-[#FFB800] outline-none"
                    />
                  </div>
                </div>

                {/* Dynamic Notification pill showing that fields have adapted to sector */}
                <div className="flex items-center gap-2 px-3 py-2 bg-amber-100/70 rounded-xl border border-amber-300/80 text-amber-950 text-xs">
                  <Sparkles className="w-4 h-4 text-amber-700 shrink-0" />
                  <span className="font-semibold">
                    Sector Active:{' '}
                    <strong className="font-black underline">
                      {sector === 'real_estate_open_plotting' &&
                        'Real Estate - Open Plotting (Layouts & Gated Communities)'}
                      {sector === 'real_estate_construction' &&
                        'Apartments & Construction (Residential Towers & Flats)'}
                      {sector === 'liquor_vends' && 'Liquor Vends Register (Excise A4 Wine Outlets Cluster)'}
                      {sector === 'custom_infra' &&
                        'Custom Infra & Civil Works (Turnkey EPC, Roads & Warehousing)'}
                    </strong>
                    . All fields below have adapted to this sector.
                  </span>
                </div>
              </div>
            )}

            {/* SECTION 2: DYNAMIC LOCATION, CLEARANCES & OUTLAY PARAMETERS */}
            {activeFormTab === 'all' && (
              <>
                {/* SECTOR A: OPEN PLOTTING */}
                {sector === 'real_estate_open_plotting' && (
                  <div className="bg-gray-50/80 rounded-2xl p-5 border border-gray-200 space-y-4">
                    <div className="flex items-center gap-2 text-xs font-black uppercase text-gray-800 tracking-wider">
                      <Compass className="w-4 h-4 text-amber-600" />
                      <span>2. Layout Location, Revenue Survey &amp; Statutory Approvals</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                          Layout Location / Highway Corridor *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Mangalagiri Mandal, CRDA Capital Region"
                          value={location}
                          onChange={(e) => setLocation(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-xs font-semibold text-gray-950 focus:ring-2 focus:ring-[#FFB800] outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                          Revenue Survey Numbers *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Sy. No. 165/1, 166/2, 168/P"
                          value={surveyNumbers}
                          onChange={(e) => setSurveyNumbers(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-xs font-semibold text-gray-950 focus:ring-2 focus:ring-[#FFB800] outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                          Statutory Town Planning Authority
                        </label>
                        <select
                          value={approvalAuthority}
                          onChange={(e) => setApprovalAuthority(e.target.value)}
                          className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-xs font-semibold text-gray-950 focus:ring-2 focus:ring-[#FFB800] outline-none"
                        >
                          <option value="CRDA">CRDA (Capital Region Development Authority)</option>
                          <option value="DTCP">DTCP (Directorate of Town &amp; Country Planning)</option>
                          <option value="HMDA">HMDA (Hyderabad Metropolitan Dev Authority)</option>
                          <option value="TG-RERA">TG-RERA (Telangana Real Estate Reg Authority)</option>
                          <option value="AP-RERA">AP-RERA (Andhra Pradesh Real Estate Reg Authority)</option>
                          <option value="Gram Panchayat">Gram Panchayat Conversion Layout</option>
                          <option value="Municipal">Municipal Corporation</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                          Layout Permit (LP) / RERA Number *
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. CRDA/LP/2026/058 or LP No. 42/2025"
                          value={lpOrReraNumber}
                          onChange={(e) => setLpOrReraNumber(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-xs font-semibold text-gray-950 focus:ring-2 focus:ring-[#FFB800] outline-none"
                        />
                      </div>
                    </div>

                    {/* Extent & Specifications */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t border-gray-200">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Total Land Extent</label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            placeholder="e.g. 6.0"
                            value={extentValue === 0 ? '' : extentValue}
                            onChange={(e) => setExtentValue(parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-black text-gray-950 focus:ring-2 focus:ring-[#FFB800] outline-none"
                          />
                          <select
                            value={extentUnit}
                            onChange={(e) => setExtentUnit(e.target.value)}
                            className="px-2 py-2 bg-white border border-gray-300 rounded-xl text-[11px] font-bold text-gray-700 outline-none"
                          >
                            <option value="Acres">Acres</option>
                            <option value="Sq. Yards">Sq.Yds</option>
                            <option value="Guntas / Cents">Cents/Gts</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Approach Road Width</label>
                        <select
                          value={roadWidth}
                          onChange={(e) => setRoadWidth(Number(e.target.value) as any)}
                          className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-bold text-gray-950 outline-none"
                        >
                          <option value={20}>20 Ft Road</option>
                          <option value={30}>30 Ft Road (Standard)</option>
                          <option value={40}>40 Ft Wide Sector Road</option>
                          <option value={60}>60 Ft Masterplan Arterial</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Floor Rate Lock (₹/Sq.Yd)</label>
                        <div className="relative">
                          <input
                            type="number"
                            step="100"
                            placeholder="e.g. 18500"
                            value={floorRatePerSqYard === 0 ? '' : floorRatePerSqYard}
                            onChange={(e) => setFloorRatePerSqYard(parseInt(e.target.value) || 0)}
                            className="w-full pl-6 pr-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-black text-gray-950 focus:ring-2 focus:ring-[#FFB800] outline-none"
                          />
                          <span className="absolute left-2.5 top-2 text-xs font-bold text-gray-400">₹</span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                          Estimated Project Cost (Total Outlay ₹) *
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step="100000"
                            placeholder="e.g. 48000000"
                            value={totalEstimatedOutlay === 0 ? '' : totalEstimatedOutlay}
                            onChange={(e) => handleOutlayChange(parseInt(e.target.value) || 0)}
                            className="w-full pl-6 pr-3 py-2 bg-white border-2 border-amber-300 rounded-xl text-xs font-black text-gray-950 focus:ring-2 focus:ring-[#FFB800] outline-none"
                          />
                          <span className="absolute left-2.5 top-2 text-xs font-bold text-gray-400">₹</span>
                        </div>
                      </div>
                    </div>

                    {/* Clarification Box for Project Outlay */}
                    <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-950 flex items-start gap-2.5">
                      <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <div className="font-bold flex items-center gap-2">
                          <span>What does "Project Outlay Estimated Cost" mean?</span>
                          <span className="text-[10px] px-2 py-0.5 bg-amber-200 text-amber-900 rounded-full font-black">
                            = Total Estimated Project Cost
                          </span>
                        </div>
                        <p className="text-[11px] text-amber-900 leading-relaxed">
                          <strong>Project Outlay</strong> is the accounting term for <strong>Total Estimated Project Cost</strong>. It represents the overall financial capital budgeted to execute this venture (including {getOutlayExplanation()}).
                        </p>
                        <div className="text-xs font-bold text-amber-900 pt-0.5">
                          Current Budget:{' '}
                          <span className="font-black text-gray-950 font-mono">
                            {formatINR(totalEstimatedOutlay)} ({formatIndianCompact(totalEstimatedOutlay)})
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* SECTOR B: APARTMENTS & CONSTRUCTION */}
                {sector === 'real_estate_construction' && (
                  <div className="bg-gray-50/80 rounded-2xl p-5 border border-gray-200 space-y-4">
                    <div className="flex items-center gap-2 text-xs font-black uppercase text-gray-800 tracking-wider">
                      <Building2 className="w-4 h-4 text-amber-600" />
                      <span>2. Construction Site, RERA Compliance &amp; Building Parameters</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                          Construction Site / Project Address *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Tadepalli Bypass, Financial District, Gachibowli"
                          value={location}
                          onChange={(e) => setLocation(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-xs font-semibold text-gray-950 focus:ring-2 focus:ring-[#FFB800] outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                          Site Survey No. / Municipal Door No. *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Sy. No. 89/3, Tadepalli (Plot 14, Ward 2)"
                          value={surveyNumbers}
                          onChange={(e) => setSurveyNumbers(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-xs font-semibold text-gray-950 focus:ring-2 focus:ring-[#FFB800] outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                          Building Sanction &amp; Regulatory Authority
                        </label>
                        <select
                          value={approvalAuthority}
                          onChange={(e) => setApprovalAuthority(e.target.value)}
                          className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-xs font-semibold text-gray-950 focus:ring-2 focus:ring-[#FFB800] outline-none"
                        >
                          <option value="AP-RERA">AP-RERA (Andhra Pradesh Real Estate Reg Authority)</option>
                          <option value="TG-RERA">TG-RERA (Telangana Real Estate Reg Authority)</option>
                          <option value="Municipal">Municipal Corporation Building Sanction</option>
                          <option value="HMDA">HMDA Building Sanction</option>
                          <option value="CRDA">CRDA Building Sanction</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                          RERA Registration / Building Sanction Plan No. *
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. P03240019284 or GHMC/BA/2026/089"
                          value={lpOrReraNumber}
                          onChange={(e) => setLpOrReraNumber(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-xs font-semibold text-gray-950 focus:ring-2 focus:ring-[#FFB800] outline-none"
                        />
                      </div>
                    </div>

                    {/* Construction Specs */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2 border-t border-gray-200">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Base Rate (₹/Sq.Ft) *</label>
                        <div className="relative">
                          <input
                            type="number"
                            step="50"
                            placeholder="e.g. 4800"
                            value={baseSqFtRate === 0 ? '' : baseSqFtRate}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 0;
                              setBaseSqFtRate(val);
                            }}
                            className="w-full pl-6 pr-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-black text-gray-950 focus:ring-2 focus:ring-[#FFB800] outline-none"
                          />
                          <span className="absolute left-2.5 top-2 text-xs font-bold text-gray-400">₹</span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Facing Premium (₹/Sq.Ft)</label>
                        <div className="relative">
                          <input
                            type="number"
                            step="25"
                            value={facingPremium}
                            onChange={(e) => setFacingPremium(parseInt(e.target.value) || 0)}
                            className="w-full pl-6 pr-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-black text-gray-950 focus:ring-2 focus:ring-[#FFB800] outline-none"
                          />
                          <span className="absolute left-2.5 top-2 text-xs font-bold text-gray-400">₹</span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                          Estimated Construction Cost (Outlay ₹) *
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step="100000"
                            placeholder="e.g. 42000000"
                            value={totalEstimatedOutlay === 0 ? '' : totalEstimatedOutlay}
                            onChange={(e) => handleOutlayChange(parseInt(e.target.value) || 0)}
                            className="w-full pl-6 pr-3 py-2 bg-white border-2 border-amber-300 rounded-xl text-xs font-black text-gray-950 focus:ring-2 focus:ring-[#FFB800] outline-none"
                          />
                          <span className="absolute left-2.5 top-2 text-xs font-bold text-gray-400">₹</span>
                        </div>
                      </div>
                    </div>

                    {/* Clarification Box for Project Outlay */}
                    <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-950 flex items-start gap-2.5">
                      <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <div className="font-bold flex items-center gap-2">
                          <span>What does "Project Outlay Estimated Cost" mean?</span>
                          <span className="text-[10px] px-2 py-0.5 bg-amber-200 text-amber-900 rounded-full font-black">
                            = Total Estimated Construction Cost
                          </span>
                        </div>
                        <p className="text-[11px] text-amber-900 leading-relaxed">
                          <strong>Project Outlay</strong> is the accounting term for <strong>Total Estimated Construction Cost</strong>. It covers the complete civil construction budget (including {getOutlayExplanation()}).
                        </p>
                        <div className="text-xs font-bold text-amber-900 pt-0.5">
                          Current Budget:{' '}
                          <span className="font-black text-gray-950 font-mono">
                            {formatINR(totalEstimatedOutlay)} ({formatIndianCompact(totalEstimatedOutlay)})
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* SECTOR C: LIQUOR VENDS */}
                {sector === 'liquor_vends' && (
                  <div className="bg-gray-50/80 rounded-2xl p-5 border border-gray-200 space-y-4">
                    <div className="flex items-center gap-2 text-xs font-black uppercase text-gray-800 tracking-wider">
                      <Wine className="w-4 h-4 text-rose-600" />
                      <span>2. Excise Zone, Retail Shop Counters &amp; State Licensing Details</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                          Excise Zone / Retail Cluster Location *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Naimnagar &amp; Hanamkonda Circles, Warangal Urban"
                          value={location}
                          onChange={(e) => setLocation(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-xs font-semibold text-gray-950 focus:ring-2 focus:ring-[#FFB800] outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                          Excise Gazette Shop Numbers (A4 Vends) *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Excise Shop #04, #05, #08, #12"
                          value={surveyNumbers}
                          onChange={(e) => setSurveyNumbers(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-xs font-semibold text-gray-950 focus:ring-2 focus:ring-[#FFB800] outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                          State Excise Regulatory Authority
                        </label>
                        <select
                          value={approvalAuthority}
                          onChange={(e) => setApprovalAuthority(e.target.value)}
                          className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-xs font-semibold text-gray-950 focus:ring-2 focus:ring-[#FFB800] outline-none"
                        >
                          <option value="TG State Beverages Corp (TGSBCL)">TG State Beverages Corp (TGSBCL)</option>
                          <option value="AP State Beverages Corp (APSBL)">AP State Beverages Corp (APSBL)</option>
                          <option value="State Prohibition &amp; Excise Dept">State Prohibition &amp; Excise Dept</option>
                          <option value="District Collectorate &amp; Excise">District Collectorate &amp; Excise Committee</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                          Gazette Notification / Retail Vend License No. *
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. TG-EXC-WGL-2025-089 or AP-EXC-GNT-2026/014"
                          value={lpOrReraNumber}
                          onChange={(e) => setLpOrReraNumber(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-xs font-semibold text-gray-950 focus:ring-2 focus:ring-[#FFB800] outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2 border-t border-gray-200">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Daily Sales Target / Counter</label>
                        <div className="relative">
                          <input
                            type="number"
                            step="10000"
                            value={dailySalesTarget}
                            onChange={(e) => setDailySalesTarget(parseInt(e.target.value) || 0)}
                            className="w-full pl-6 pr-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-black text-gray-950 focus:ring-2 focus:ring-[#FFB800] outline-none"
                          />
                          <span className="absolute left-2.5 top-2 text-xs font-bold text-gray-400">₹</span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Excise BG / Security Deposit</label>
                        <div className="relative">
                          <input
                            type="number"
                            step="100000"
                            value={securityDeposit}
                            onChange={(e) => setSecurityDeposit(parseInt(e.target.value) || 0)}
                            className="w-full pl-6 pr-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-black text-gray-950 focus:ring-2 focus:ring-[#FFB800] outline-none"
                          />
                          <span className="absolute left-2.5 top-2 text-xs font-bold text-gray-400">₹</span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                          Estimated Syndicate Outlay (Cost ₹) *
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step="100000"
                            value={totalEstimatedOutlay}
                            onChange={(e) => handleOutlayChange(parseInt(e.target.value) || 0)}
                            className="w-full pl-6 pr-3 py-2 bg-white border-2 border-amber-300 rounded-xl text-xs font-black text-gray-950 focus:ring-2 focus:ring-[#FFB800] outline-none"
                          />
                          <span className="absolute left-2.5 top-2 text-xs font-bold text-gray-400">₹</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* SECTOR D: CUSTOM INFRA & CIVIL WORKS */}
                {sector === 'custom_infra' && (
                  <div className="bg-gray-50/80 rounded-2xl p-5 border border-gray-200 space-y-4">
                    <div className="flex items-center gap-2 text-xs font-black uppercase text-gray-800 tracking-wider">
                      <Hammer className="w-4 h-4 text-amber-700" />
                      <span>2. Contract Award, Client Department &amp; Technical Scope</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                          Work Site / Project Stretch Location *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Near Gate #2, Market Yard Road, Guntur Bypass NH-16"
                          value={location}
                          onChange={(e) => setLocation(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-xs font-semibold text-gray-950 focus:ring-2 focus:ring-[#FFB800] outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                          Tender Agreement / Contract Number *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. GMC/INFRA/2026/012 or R&amp;B/EE/CRDA-04/2026"
                          value={surveyNumbers}
                          onChange={(e) => setSurveyNumbers(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-xs font-semibold text-gray-950 focus:ring-2 focus:ring-[#FFB800] outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                          Client Principal / Contracting Authority
                        </label>
                        <select
                          value={approvalAuthority}
                          onChange={(e) => setApprovalAuthority(e.target.value)}
                          className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-xs font-semibold text-gray-950 focus:ring-2 focus:ring-[#FFB800] outline-none"
                        >
                          <option value="Roads &amp; Buildings (R&amp;B) Dept">Roads &amp; Buildings (R&amp;B) Dept</option>
                          <option value="Irrigation &amp; Water Resources">Irrigation &amp; Water Resources Dept</option>
                          <option value="National Highways Authority (NHAI)">National Highways Authority (NHAI)</option>
                          <option value="Municipal Corporation">Municipal Corporation Infra Works</option>
                          <option value="State Warehousing &amp; Logistics Corp">State Warehousing &amp; Logistics Corp</option>
                          <option value="Turnkey Industrial EPC">Turnkey Industrial EPC Principal</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                          LOA / Work Order Sanction Reference *
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. LOA No. CRDA/ENGG/2026/982"
                          value={lpOrReraNumber}
                          onChange={(e) => setLpOrReraNumber(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-xs font-semibold text-gray-950 focus:ring-2 focus:ring-[#FFB800] outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2 border-t border-gray-200">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Contract Agreement Model</label>
                        <select
                          value={contractType}
                          onChange={(e) => setContractType(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-bold text-gray-950 outline-none"
                        >
                          <option value="Item-Rate Schedule (BoQ)">Item-Rate BoQ Schedule</option>
                          <option value="EPC Turnkey Lump-Sum">EPC Turnkey Lump-Sum</option>
                          <option value="Percentage Rate Over/Under">Percentage Rate (SSR)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Retention Deposit / BG %</label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.5"
                            min="1"
                            max="15"
                            value={retentionPercent}
                            onChange={(e) => setRetentionPercent(parseFloat(e.target.value) || 0)}
                            className="w-full pl-2 pr-6 py-2 bg-white border border-gray-300 rounded-xl text-xs font-black text-gray-950 focus:ring-2 focus:ring-[#FFB800] outline-none"
                          />
                          <span className="absolute right-2.5 top-2 text-xs font-bold text-gray-400">%</span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                          Estimated Work Value (Outlay ₹) *
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step="100000"
                            value={totalEstimatedOutlay}
                            onChange={(e) => handleOutlayChange(parseInt(e.target.value) || 0)}
                            className="w-full pl-6 pr-3 py-2 bg-white border-2 border-amber-300 rounded-xl text-xs font-black text-gray-950 focus:ring-2 focus:ring-[#FFB800] outline-none"
                          />
                          <span className="absolute left-2.5 top-2 text-xs font-bold text-gray-400">₹</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* SECTION 3: VENTURE CUSTOMIZATION & PHYSICAL PLAN MATRIX */}
            {(activeFormTab === 'all' || activeFormTab === 'custom_plan') && (
              <div className="bg-white rounded-2xl p-5 border-2 border-amber-300/80 shadow-xs space-y-4">
                <div className="flex items-center gap-2 text-xs font-black uppercase text-gray-900 tracking-wider">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span>3. Physical Plan &amp; Custom Layout Configuration</span>
                </div>

                {/* Switch according to sector */}
                {sector === 'real_estate_construction' && (
                  <ConstructionPlanBuilder
                    floorsCount={floorsCount}
                    onFloorsCountChange={setFloorsCount}
                    floorPlans={floorPlans}
                    onFloorPlansChange={setFloorPlans}
                    amenities={amenities}
                    onAmenitiesChange={setAmenities}
                    baseSqFtRate={baseSqFtRate}
                  />
                )}

                {sector === 'real_estate_open_plotting' && (
                  <OpenPlottingPlanBuilder
                    extentValue={extentValue}
                    extentUnit={extentUnit}
                    floorRatePerSqYard={floorRatePerSqYard}
                    distribution={plotDistribution}
                    onDistributionChange={setPlotDistribution}
                    amenities={layoutAmenities}
                    onAmenitiesChange={setLayoutAmenities}
                    roadWidth={roadWidth}
                    openSpacePercent={openSpacePercent}
                  />
                )}

                {sector === 'liquor_vends' && (
                  <LiquorVendPlanBuilder
                    counters={liquorCounters}
                    onCountersChange={setLiquorCounters}
                    facilities={liquorFacilities}
                    onFacilitiesChange={setLiquorFacilities}
                  />
                )}

                {sector === 'custom_infra' && (
                  <CustomInfraPlanBuilder
                    packages={infraPackages}
                    onPackagesChange={setInfraPackages}
                    facilities={infraFacilities}
                    onFacilitiesChange={setInfraFacilities}
                  />
                )}
              </div>
            )}

            {/* SECTION 4: BLUEPRINT & PLAN UPLOAD */}
            {(activeFormTab === 'all' || activeFormTab === 'blueprint_upload') && (
              <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs space-y-4">
                <div className="flex items-center gap-2 text-xs font-black uppercase text-gray-900 tracking-wider">
                  <Upload className="w-4 h-4 text-amber-600" />
                  <span>4. Sanctioned Blueprint &amp; Venture Plan Documents</span>
                </div>

                <PlanDocumentUploader
                  documents={planDocuments}
                  onChange={setPlanDocuments}
                  sector={sector}
                />
              </div>
            )}

            {/* SECTION 5: PROJECT SYNDICATE PARTNERS & DYNAMIC EQUITY ALLOCATION */}
            {(activeFormTab === 'all' || activeFormTab === 'partners') && (
              <div className="bg-amber-50/50 rounded-2xl p-5 border border-amber-200/80 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-black uppercase text-amber-950 tracking-wider">
                      <Users className="w-4 h-4 text-amber-700" />
                      <span>5. Respective Syndicate Partners &amp; Equity Allocation</span>
                    </div>
                    <p className="text-[11px] text-amber-900 mt-0.5">
                      Syndicate partners and equity shares vary from project to project. Assign respective partners, project-specific roles, and capital contributions for this venture.
                    </p>
                  </div>

                  {/* Equity Total Badge & Quick Helper */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <div
                      className={`px-3 py-1 rounded-full text-xs font-black flex items-center gap-1.5 ${
                        Math.abs(totalEquity - 100) < 0.1
                          ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                          : 'bg-amber-200 text-amber-950 border border-amber-400'
                      }`}
                    >
                      <Percent className="w-3.5 h-3.5" />
                      <span>Total Equity: {totalEquity.toFixed(1)}% / 100%</span>
                    </div>

                    <button
                      type="button"
                      onClick={handleSplitRemainingEqually}
                      className="px-2.5 py-1 text-[10px] font-bold bg-white text-gray-800 hover:bg-gray-100 rounded-lg border border-gray-300 transition-colors shadow-2xs"
                    >
                      Split Equity Equally
                    </button>

                    <button
                      type="button"
                      onClick={handleAutoSyncCapitalWithOutlay}
                      className="px-2.5 py-1 text-[10px] font-bold bg-amber-200 hover:bg-amber-300 text-amber-950 rounded-lg border border-amber-400 transition-colors flex items-center gap-1 shadow-2xs"
                      title="Distribute Total Estimated Project Cost into Partner Capital Estimated Invest Values"
                    >
                      <Sparkles className="w-3 h-3 text-amber-800" />
                      <span>Sync Capital from Cost ({formatIndianCompact(totalEstimatedOutlay)})</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleSyncOutlayWithCapital}
                      className="px-2.5 py-1 text-[10px] font-bold bg-emerald-100 hover:bg-emerald-200 text-emerald-950 rounded-lg border border-emerald-300 transition-colors flex items-center gap-1 shadow-2xs"
                      title="Set Total Estimated Project Cost to match the sum of Capital Estimated Invest Values"
                    >
                      <CheckCircle2 className="w-3 h-3 text-emerald-800" />
                      <span>Sync Cost from Capital ({formatIndianCompact(totalCapital)})</span>
                    </button>
                  </div>
                </div>

                {/* Partners Table / Cards */}
                {projectPartners.length === 0 ? (
                  <div className="bg-white p-6 rounded-2xl border border-dashed border-gray-300 text-center space-y-3">
                    <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-800 flex items-center justify-center mx-auto border border-amber-200">
                      <PieChart className="w-5 h-5 text-amber-600" />
                    </div>
                    <div className="space-y-1">
                      <h5 className="text-xs font-black text-gray-900">No Partners Assigned to this Project</h5>
                      <p className="text-[11px] text-gray-500 max-w-md mx-auto">
                        Syndicate partners are project-specific. You can add venture partners right now, or create the project and allocate equity anytime in the Partners &amp; Equity tab.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddPartnerRow}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#FFB800] hover:bg-amber-400 text-gray-950 font-black text-xs shadow-xs transition-all cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>+ Add Partner to this Project</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {projectPartners.map((partner, idx) => (
                      <div
                        key={partner.partnerId || idx}
                        className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2.5 min-w-[240px]">
                          <div
                            className={`w-8 h-8 rounded-full ${partner.avatarColor} text-white flex items-center justify-center text-xs font-bold shrink-0`}
                          >
                            {partner.name ? partner.name.charAt(0).toUpperCase() : 'P'}
                          </div>
                          <div className="flex-1 space-y-1">
                            <input
                              type="text"
                              placeholder="Partner Name (e.g. R. Venkatesh)"
                              value={partner.name}
                              onChange={(e) => handlePartnerChange(idx, 'name', e.target.value)}
                              className="w-full text-xs font-bold text-gray-950 border-b border-gray-300 focus:border-amber-500 outline-none pb-0.5 bg-transparent"
                            />
                            <div className="flex items-center gap-1 bg-amber-50/80 px-2 py-1 rounded-md border border-amber-200">
                              <span className="text-[9px] uppercase font-black text-amber-800 shrink-0">User ID (Mobile):</span>
                              <input
                                type="tel"
                                placeholder="+91 98480 XXXXX"
                                value={partner.phone}
                                onChange={(e) => handlePartnerChange(idx, 'phone', e.target.value)}
                                className="w-full text-xs font-mono font-bold text-gray-900 border-none outline-none p-0 bg-transparent placeholder:text-gray-400"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase">
                              Project Role
                            </label>
                            <input
                              type="text"
                              placeholder={
                                sector === 'real_estate_open_plotting'
                                  ? 'e.g. Managing Partner / Civil Contractor'
                                  : sector === 'real_estate_construction'
                                  ? 'e.g. Structural Lead / Finishes Lead'
                                  : sector === 'liquor_vends'
                                  ? 'e.g. Tender Bidder / Depot Logistics'
                                  : 'e.g. Turnkey EPC Lead / Earthwork Lead'
                              }
                              value={partner.roleInProject}
                              onChange={(e) => handlePartnerChange(idx, 'roleInProject', e.target.value)}
                              className="w-full px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-800 outline-none"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase">
                              Project Equity %
                            </label>
                            <div className="relative">
                              <input
                                type="number"
                                step="0.5"
                                min="1"
                                max="100"
                                value={partner.equityPercent}
                                onChange={(e) => handlePartnerChange(idx, 'equityPercent', e.target.value)}
                                className="w-full pl-2 pr-6 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs font-black text-gray-900 outline-none"
                              />
                              <span className="absolute right-2 top-1 text-xs text-gray-400 font-bold">%</span>
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase">
                              Capital Estimated Invest Value (₹)
                            </label>
                            <div className="relative">
                              <input
                                type="number"
                                step="50000"
                                value={partner.initialCapital}
                                onChange={(e) => handlePartnerChange(idx, 'initialCapital', e.target.value)}
                                className="w-full pl-5 pr-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs font-black text-gray-900 outline-none focus:bg-white focus:border-amber-500"
                              />
                              <span className="absolute left-1.5 top-1 text-xs text-gray-400 font-bold">₹</span>
                            </div>
                            <span className="text-[9px] text-gray-500 mt-0.5 block font-mono">
                              {formatINR(partner.initialCapital)} ({partner.equityPercent}% of {formatIndianCompact(totalEstimatedOutlay)})
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemovePartnerRow(idx)}
                          title="Remove partner from this project"
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors self-end md:self-center"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add partner button & Total Capital Estimated Invest Value */}
                {projectPartners.length > 0 && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-amber-200/80">
                    <button
                      type="button"
                      onClick={handleAddPartnerRow}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-amber-300 text-amber-900 hover:bg-amber-100/60 text-xs font-bold shadow-2xs transition-colors self-start sm:self-auto"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Add Another Partner to this Project</span>
                    </button>

                    <div className="text-right space-y-1">
                    <div className="text-xs font-semibold text-gray-700">
                      Total Capital Estimated Invest Value:{' '}
                      <strong className="text-gray-950 font-mono text-sm">{formatINR(totalCapital)}</strong>
                    </div>
                    <div className="text-[11px] font-medium text-gray-600 flex items-center justify-end gap-1.5 flex-wrap">
                      <span>Total Estimated Project Cost:</span>
                      <strong className="text-amber-950 font-mono">{formatINR(totalEstimatedOutlay)}</strong>
                      <span>•</span>
                      {Math.abs(totalCapital - totalEstimatedOutlay) < 100 ? (
                        <span className="text-emerald-700 font-bold bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                          <span>✓ 100% In Perfect Sync</span>
                        </span>
                      ) : (
                        <div className="flex items-center gap-1.5 bg-amber-100/90 border border-amber-300 px-2 py-0.5 rounded-lg text-amber-950">
                          <span className="font-bold text-[10px]">
                            ⚠️ Difference of ₹{formatINR(Math.abs(totalEstimatedOutlay - totalCapital))}
                          </span>
                          <button
                            type="button"
                            onClick={handleAutoSyncCapitalWithOutlay}
                            className="underline font-bold text-[10px] hover:text-amber-800"
                            title="Scale partner capital to match project cost"
                          >
                            Sync to Cost
                          </button>
                          <span>/</span>
                          <button
                            type="button"
                            onClick={handleSyncOutlayWithCapital}
                            className="underline font-bold text-[10px] hover:text-emerald-800"
                            title="Update project cost to match total partner capital"
                          >
                            Sync to Capital
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                )}
              </div>
            )}

            {/* SECTION: PROJECT BANK ACCOUNTS & SETTLEMENT BANKING */}
            {(activeFormTab === 'all' || activeFormTab === 'accounts') && (
              <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-slate-900 text-amber-400 flex items-center justify-center font-bold">
                      <Landmark className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider text-gray-950 flex items-center gap-1.5">
                        <span>Project Bank Accounts &amp; Escrow</span>
                        <span className="text-[10px] font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded-full border border-gray-200">
                          {availableFirmAccounts.length} Dedicated Accounts
                        </span>
                      </h4>
                      <p className="text-[11px] text-gray-500">
                        Select or configure the dedicated Project Account to receive customer booking advances &amp; partner capital for this venture
                      </p>
                    </div>
                  </div>

                  {/* UI TO ADD PROJECT ACCOUNTS */}
                  <button
                    type="button"
                    onClick={() => setIsAddAccountSubModalOpen(true)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#FFB800] hover:bg-amber-400 text-gray-950 font-black text-xs shadow-xs transition-all border border-amber-500/40 self-start sm:self-auto cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Add Project Account</span>
                  </button>
                </div>

                {availableFirmAccounts.length === 0 ? (
                  <div className="p-4 bg-gray-50/80 rounded-xl border border-dashed border-gray-300 text-center space-y-2">
                    <p className="text-xs font-bold text-gray-800">No bank accounts registered yet for this project</p>
                    <p className="text-[11px] text-gray-500">
                      You can register a dedicated RERA Escrow, Capital Pool, or Commercial Current Account now or later in the Accounts tab.
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsAddAccountSubModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white text-xs font-bold rounded-xl cursor-pointer hover:bg-black"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Add Project Bank Account</span>
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {availableFirmAccounts.map((acc) => {
                      const isSelected = selectedFirmAccountId === acc.id;
                      return (
                        <div
                          key={acc.id}
                          onClick={() => setSelectedFirmAccountId(acc.id)}
                          className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative flex flex-col justify-between ${
                            isSelected
                              ? 'bg-amber-50/60 border-amber-500 ring-2 ring-amber-500/30 shadow-xs'
                              : 'bg-gray-50/60 border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1 mb-1.5">
                              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-white text-gray-800 border border-gray-200 shadow-2xs">
                                {acc.accountType.replace('_', ' ').toUpperCase()}
                              </span>
                              <div className="flex items-center gap-1">
                                {acc.isPrimary && (
                                  <span className="text-[9px] font-black uppercase text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-300">
                                    Primary
                                  </span>
                                )}
                                <input
                                  type="radio"
                                  name="projectAccountSelection"
                                  checked={isSelected}
                                  onChange={() => setSelectedFirmAccountId(acc.id)}
                                  className="w-3.5 h-3.5 text-amber-600 focus:ring-amber-500 cursor-pointer"
                                />
                              </div>
                            </div>
                            <h5 className="text-xs font-bold text-gray-950 line-clamp-1">{acc.accountName}</h5>
                            <p className="text-[10px] text-gray-500 font-mono mt-0.5">
                              {acc.bankName} • {acc.accountNumber.slice(-4) ? `•••• ${acc.accountNumber.slice(-4)}` : acc.accountNumber}
                            </p>
                          </div>

                          <div className="mt-2.5 pt-2 border-t border-gray-200/60 flex items-center justify-between">
                            <span className="text-[10px] text-gray-400 font-medium">Available Balance:</span>
                            <span className="text-xs font-bold font-mono text-gray-900">{formatINR(acc.currentBalance)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* SECTION 6: AUTO-INVENTORY / REGISTERS GENERATION */}
            {activeFormTab === 'all' && (
              <div className="bg-gray-50/80 rounded-2xl p-4 border border-gray-200 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="auto-gen-inventory"
                    checked={autoGeneratePlots}
                    onChange={(e) => setAutoGeneratePlots(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 border-gray-300 cursor-pointer"
                  />
                  <label htmlFor="auto-gen-inventory" className="text-xs font-bold text-gray-800 cursor-pointer">
                    {sector === 'real_estate_open_plotting' &&
                      'Auto-generate plotted layout inventory from above configured matrix for immediate booking & sales tracking'}
                    {sector === 'real_estate_construction' &&
                      'Auto-generate residential flat unit matrix directly from the above floor-by-floor plan (with exact 2BHK/3BHK & Sq.Ft specs)'}
                    {sector === 'liquor_vends' &&
                      'Auto-generate daily retail counter settlement registers & partner stock draw tracking ledgers'}
                    {sector === 'custom_infra' &&
                      'Auto-generate turnkey milestone billing schedule, BoQ measurement book & sub-contractor accounts'}
                  </label>
                </div>
                <span className="text-[11px] text-amber-900 font-mono font-bold bg-amber-100/80 px-2.5 py-1 rounded-lg border border-amber-200 hidden sm:inline">
                  {sector === 'real_estate_open_plotting' &&
                    `${(plotDistribution.eastPlotsCount || 0) + (plotDistribution.northPlotsCount || 0) + (plotDistribution.westPlotsCount || 0) + (plotDistribution.southPlotsCount || 0) + (plotDistribution.cornerPlotsCount || 0) + (plotDistribution.commercialPlotsCount || 0)} Plots`}
                  {sector === 'real_estate_construction' &&
                    `${floorPlans.reduce((sum, f) => sum + f.units.length, 0)} Units (${floorsCount} Floors)`}
                  {sector === 'liquor_vends' && `${liquorCounters.length} Retail Counters`}
                  {sector === 'custom_infra' && `${infraPackages.length} Contract Packages`}
                </span>
              </div>
            )}
          </div>

          {/* Modal Actions - Pinned Footer */}
          <div className="sticky bottom-0 bg-gray-50/95 backdrop-blur-xs px-5 sm:px-7 py-3.5 border-t border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 z-30">
            <div className="text-xs text-gray-500 font-medium hidden sm:block">
              {sector === 'real_estate_construction' && (
                <span>
                  Configured:{' '}
                  <strong className="text-gray-900">
                    {floorPlans.reduce((sum, f) => sum + f.units.length, 0)} Flats
                  </strong>{' '}
                  across <strong className="text-gray-900">{floorsCount} Floors</strong> •{' '}
                  <strong className="text-amber-800">
                    {amenities.reduce((sum, a) => sum + (a.plannedSqFt || 0), 0).toLocaleString('en-IN')} SFT
                  </strong>{' '}
                  Amenities
                </span>
              )}
              {sector === 'real_estate_open_plotting' && (
                <span>
                  Configured:{' '}
                  <strong className="text-gray-900">
                    {(plotDistribution.eastPlotsCount || 0) +
                      (plotDistribution.northPlotsCount || 0) +
                      (plotDistribution.westPlotsCount || 0) +
                      (plotDistribution.southPlotsCount || 0) +
                      (plotDistribution.cornerPlotsCount || 0) +
                      (plotDistribution.commercialPlotsCount || 0)}{' '}
                    Demarcated Plots
                  </strong>{' '}
                  in <strong className="text-gray-900">{extentValue} Acres</strong>
                </span>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-gray-600 hover:text-gray-950 hover:bg-gray-200/70 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl bg-[#FFB800] hover:bg-amber-400 text-gray-950 text-xs font-black shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 border border-amber-500/40 cursor-pointer"
              >
                <FolderPlus className="w-4 h-4" />
                <span>Create Project &amp; Load Data</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Sub-modal: Add Project Account */}
      {isAddAccountSubModalOpen && (
        <AddFirmAccountModal
          isOpen={isAddAccountSubModalOpen}
          onClose={() => setIsAddAccountSubModalOpen(false)}
          firm={firm}
          projects={[
            {
              id: projectId,
              firmId: firm.id,
              name: name.trim() || 'New Project Venture',
              code: code.trim().toUpperCase() || 'PROJECT',
              sector,
              location: location.trim(),
              status,
              startDate,
              targetCompletionDate,
              partners: projectPartners,
              extentValue,
              extentUnit,
            } as Project,
          ]}
          activeProjectId={projectId}
          onAddAccount={(newAcc) => {
            const mappedAcc = {
              ...newAcc,
              linkedProjectId: projectId,
            };
            if (onAddFirmAccount) {
              onAddFirmAccount(mappedAcc);
            }
            setSelectedFirmAccountId(mappedAcc.id);
          }}
        />
      )}
    </div>
  );
};
