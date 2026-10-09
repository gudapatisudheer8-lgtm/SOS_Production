export type Role = 'super_admin' | 'accountant' | 'field_partner';

export interface AuthenticatedAppUser {
  id: string;
  phone: string;
  name: string;
  role: Role | 'managing_partner';
  firmId: string | null;
  firmCode: string | null;
  partnerId: string | null;
  mustChangePin: boolean;
}

export type SectorType = 
  | 'real_estate_open_plotting'
  | 'real_estate_construction'
  | 'liquor_vends'
  | 'custom_infra';

export type LedgerMode = 'internal_syndicate' | 'official_tax';

export interface FeatureFlags {
  enablePlotGrid: boolean;
  enableApartmentMatrix: boolean;
  enableWhatsAppAlerts: boolean;
  enableTallyExport: boolean;
  enableVoiceNotes: boolean;
  enableAuditLock: boolean;
  enableDualLedger?: boolean;
  enableFloorPriceLock?: boolean;
}

export interface TenantFirm {
  id: string;
  name: string;
  code: string;
  location: string;
  state: 'Andhra Pradesh' | 'Telangana';
  sectors: SectorType[];
  subscriptionPlan: 'monthly' | 'annual' | 'enterprise';
  mrrAmount: number;
  status: 'active' | 'inactive' | 'pending' | 'suspended';
  createdDate: string;
  // Proprietor & Promoter Details
  proprietorName?: string;
  proprietorPhone?: string;
  managingPartnerName: string;
  managingPartnerPhone: string;
  // Statutory & Tax Compliance
  gstin?: string;
  panNumber?: string;
  businessType?: 'Proprietorship' | 'Partnership' | 'LLP' | 'Private Limited' | 'Syndicate / Joint Venture';
  tradeName?: string;
  officeAddress?: string;
  contactEmail?: string;
  reraNumber?: string;
  // Accountant & Operations
  accountantName: string;
  accountantPhone: string;
  featureFlags: FeatureFlags;
  encryptionStatus?: 'AES-256 GCM Active' | 'Key Rotation Pending';
  credentials?: {
    accountantLogin: string;
    accountantPassword?: string;
    partnerLogin: string;
    partnerPassword?: string;
  };
}

export interface ProjectPartnerShare {
  partnerId: string;
  name: string;
  phone: string;
  roleInProject: string;
  equityPercent: number;
  initialCapital: number;
  actualInvested?: number;
  drawings: number;
  shareOfFieldExpenses: number;
  avatarColor: string;
}

export interface Project {
  id: string;
  firmId: string;
  name: string;
  code: string;
  sector: SectorType;
  location: string;
  mandalDistrict?: string;
  surveyNumbers?: string;
  approvalAuthority?: 'CRDA' | 'DTCP' | 'HMDA' | 'TG-RERA' | 'AP-RERA' | 'Gram Panchayat' | 'Municipal' | string;
  lpOrReraNumber?: string;
  extentValue: number;
  extentUnit: 'Acres' | 'Sq. Yards' | 'Guntas / Cents' | 'Units / Flats' | string;
  roadWidth?: 20 | 30 | 40 | 60;
  openSpacePercent?: number;
  floorRatePerSqYard?: number;
  baseSqFtRate?: number;
  totalEstimatedOutlay?: number;
  status: 'planning' | 'approvals' | 'active_sales' | 'development' | 'completed';
  startDate: string;
  targetCompletionDate?: string;
  partners: ProjectPartnerShare[];
  plotsCount?: number;
  notes?: string;
  // Sector Specific Optional Attributes
  floorsCount?: number;
  facingPremium?: number;
  contractType?: string;
  retentionPercent?: number;
  countersCount?: number;
  dailySalesTarget?: number;
  securityDeposit?: number;

  // Customization & Floor/Flat Construction Plan
  flatsPerFloor?: number;
  floorPlans?: FloorFlatConfig[];
  amenities?: ProjectAmenity[];
  totalResidentialSft?: number;
  totalAmenitiesSft?: number;
  totalBuiltUpAreaSft?: number;

  // Open Plotting Customization
  plotDistribution?: PlotDistributionConfig;
  layoutAmenities?: LayoutAmenity[];

  // Plan Uploads & Blueprint Documents
  planDocuments?: PlanUploadDocument[];
}

export interface FlatConfigUnit {
  unitNumber: string;
  flatType: '1 BHK' | '2 BHK' | '2.5 BHK' | '3 BHK' | '4 BHK' | 'Duplex Penthouse';
  sftArea: number;
  facing: 'East' | 'North' | 'West' | 'South' | 'Corner';
  baseRate?: number;
}

export interface FloorFlatConfig {
  floorNumber: number;
  floorLabel: string;
  flatsCount: number;
  units: FlatConfigUnit[];
}

export interface ProjectAmenity {
  id: string;
  name: string;
  plannedSqFt: number;
  floorLocation?: string;
  description?: string;
}

export interface PlanUploadDocument {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
  dataUrl?: string;
  title: string;
  category: 'master_layout' | 'floor_plan' | 'elevation' | 'structural' | 'statutory_clearance';
}

export interface PlotDistributionConfig {
  // Directional Facing Demarcation
  eastPlotsCount: number;
  eastAreaSqYards: number;
  westPlotsCount: number;
  westAreaSqYards: number;
  northPlotsCount: number;
  northAreaSqYards: number;
  southPlotsCount: number;
  southAreaSqYards: number;
  cornerPlotsCount: number;
  cornerAreaSqYards: number;
  commercialPlotsCount: number;
  commercialAreaSqYards: number;
  // Optional / backward-compatibility fields
  standardPlotsCount?: number;
  standardAreaSqYards?: number;
  premiumPlotsCount?: number;
  premiumAreaSqYards?: number;
}

export interface LayoutAmenity {
  id: string;
  name: string;
  allocatedAreaSqYards: number;
  category: 'park' | 'utilities' | 'clubhouse' | 'roads';
}

export type PlotStatus = 'available' | 'blocked' | 'reserved' | 'sold';

export interface MarketingBookingRequest {
  id: string;
  agentName: string;
  agentPhone: string;
  agentAgency?: string;
  buyerName: string;
  buyerPhone: string;
  proposedRatePerSqYard: number;
  proposedAdvanceAmount?: number;
  tokenDeadlineHours?: number; // e.g. 24, 48 hours
  submittedAt: string;
  status: 'pending' | 'accepted_blocked' | 'rejected' | 'booked';
  notes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface Plot {
  id: number;
  firmId?: string;
  projectId?: string;
  plotNumber: string;
  areaSqYards: number;
  facing: 'East' | 'North' | 'West' | 'South' | 'North-East Corner' | 'South-East Corner';
  ratePerSqYard: number;
  status: PlotStatus;
  buyerName?: string;
  buyerPhone?: string;
  buyerAadhaar?: string;
  advanceReceived?: number;
  paymentMode?: 'Cash' | 'Cheque' | 'RTGS / NEFT' | 'UPI';
  paymentRefNumber?: string;
  bookedAt?: string;
  paymentMilestone?: 'Token Advance' | 'Sale Agreement' | 'Registration Pending' | 'Registered & Cleared';
  notes?: string;
  officialDocValue?: number; // Stamp duty guideline value for official tax book
  discountApprovedBy?: string; // If sold below floor price
  blockName?: string; // e.g. "Sector A", "Main Boulevard", "Green Avenue"
  dimensions?: string; // e.g. "36' x 50'" or "40' x 60'"
  roadWidthFt?: number; // e.g. 40, 33, 30
  // Marketing & Channel Partner Booking Proposals
  marketingRequest?: MarketingBookingRequest;
  blockedByAgent?: string;
  blockedForBuyer?: string;
  blockedAt?: string;
  blockedRate?: number;
}

export interface LayoutCalculation {
  totalExtentValue: number;
  unit: 'Acres' | 'Sq. Yards' | 'Guntas / Cents';
  roadWidth: 20 | 30 | 40 | 60;
  openSpacePercent: number; // e.g. 10% statutory for DTCP / HMDA / CRDA
  floorRatePerSqYard: number; // Discretionary Sales Discount Floor
  expectedRatePerSqYard?: number;
}

export interface ProjectExpense {
  id: string;
  firmId?: string;
  projectId?: string;
  category: 'Land Cost' | 'Surveying & Demarcation' | 'Approvals & LP Charges' | 'Layout Earthwork' | 'BT/CC Roads' | 'Electricity & Water' | 'Legal & Liaison';
  estimatedBudget: number;
  actualSpent: number;
  vendorNotes: string;
  officialTaxInvoicedAmount?: number; // Verified GST / bank invoice amount
  isOfficialTaxEligible?: boolean;
}

export type FlatStatus = 'available' | 'booked' | 'registered';

export interface ApartmentUnit {
  id: string;
  firmId?: string;
  projectId?: string;
  unitNumber: string;
  floor: number;
  flatType: '2 BHK' | '3 BHK' | 'Duplex Penthouse';
  sftArea: number;
  facing: 'East' | 'North' | 'West' | 'Corner';
  baseRate: number;
  facingPremium: number;
  floorRise: number;
  parkingFee: number;
  amenitiesFee: number;
  status: FlatStatus;
  buyerName?: string;
  buyerPhone?: string;
  advanceReceived?: number;
  currentMilestone?: 'Plinth Level' | '1st Slab' | 'Brickwork' | 'Plastering & Electrical' | 'Flooring' | 'Handover';
  milestoneStage?: string;
  officialDocValue?: number;
  discountApprovedBy?: string;
}

export interface ApartmentPricingMatrix {
  baseSqFtRate: number;
  eastPremium: number;
  northPremium: number;
  cornerPremium: number;
  floorRisePerFloor: number;
  carParkingFee: number;
  amenitiesFee: number;
  floorRatePerSqFt: number; // Discretionary Sales Discount Floor
}

export interface SyndicatePartner {
  id: string;
  firmId?: string; // Tenant syndicate firm this partner/member belongs to
  name: string;
  phone: string;
  roleDescription: string;
  avatarColor: string;
  initialCapital: number;
  actualInvested?: number; // Actual capital deposited/invested to date (difference +/- reflects in net balance)
  fixedEquityPercent: number;
  drawings: number;
  shareOfFieldExpenses: number;
  stockDrawsValuation?: number; // Liquor barter / direct stock draw deductions
  officialDeclaredCapital?: number; // Declared in partnership deed & official banking
  userRole?: 'managing_partner' | 'field_partner' | 'site_supervisor' | 'investor_partner';
  userStatus?: 'active' | 'inactive' | 'pending' | 'suspended';
  pinCode?: string; // 4-digit quick mobile authentication PIN for Field Partner login
  mustChangePin?: boolean;
  dailySpendingLimit?: number; // Daily spot cash outlay limit (e.g. ₹50,000)
  addedDate?: string;
  addedBy?: string;
}

export type EquitySplitMode = 'fixed' | 'proportional';

export type ExpenseCategory = 
  | 'Fuel'
  | 'Labor Wages'
  | 'Material'
  | 'Tractor/Machinery'
  | 'Food & Batta'
  | 'Government/Fee'
  | 'Misc';

export interface FieldExpenseLog {
  id: string;
  firmId?: string; // Tenant syndicate firm ID
  projectId?: string; // Associated Project ID
  partnerId: string;
  partnerName: string;
  amount: number;
  category: ExpenseCategory;
  date: string;
  note: string;
  voiceNoteUrl?: string;
  hasVoiceNote?: boolean;
  receiptImage?: string;
  status: 'pending' | 'approved' | 'rejected';
  reconciledDate?: string;
  reconciledBy?: string;
  requiresManagingPartnerSignoff?: boolean; // If amount > ₹10,000
  approvedByPartners?: string[]; // 2-partner consensus
  approvalSignatures?: string[];
  deviceId?: string;
  isOfficialTaxEligible?: boolean;
  taxInvoiceEligible?: boolean;
  isTaxOfficial?: boolean;
  taxInvoiceNo?: string;
  vendorName?: string;
  paymentMode?: string;
  paymentSource?: 'project_bank' | 'individual'; // paid from project bank account vs partner individual funds
  bankAccountId?: string; // which project bank account is debited
  bankAccountName?: string;
  enrolledBy?: string;
}

export interface DrawingRequest {
  id: string;
  firmId?: string;
  projectId?: string;
  partnerId: string;
  partnerName: string;
  amount: number;
  payoutMode: 'Bank Transfer' | 'Field Vault Cash' | 'Cheque';
  sourceAccountId?: string;
  sourceAccountName?: string;
  destinationAccountDetails: string;
  purpose: string;
  requestedAt: string;
  status: 'pending_approval' | 'approved' | 'cleared';
  reviewedBy?: string;
  disbursedBy?: string;
  disbursedAt?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  partnerName?: string;
  actorName?: string;
  actorRole?: string;
  action: string;
  deviceId: string;
  notes: string;
  impactAmount?: number;
  ledgerType: 'Internal Syndicate' | 'Official Tax Books' | 'System Governance';
  verified: boolean;
}

export interface LiquorDailySettlement {
  id: string;
  firmId?: string;
  date: string;
  counterName: string;
  openingBottles: number;
  receivedBottles: number;
  closingBottles: number;
  bottlesSold: number;
  grossSalesValue: number;
  cashCollected: number;
  upiCollected: number;
  counterShortage: number;
  settledBy: string;
  status: 'reconciled' | 'variance_flagged';
  bankDepositSlipNo?: string;
}

export interface PartnerStockDraw {
  id: string;
  firmId?: string;
  partnerId: string;
  partnerName: string;
  date: string;
  stockDetails: string;
  bottlesCount: number;
  retailValuation: number;
  purpose: string;
  deductedFromPayout: boolean;
  authorizedBy: string;
}

export type FirmAccountType =
  | 'rera_escrow'
  | 'syndicate_capital_pool'
  | 'current_operational'
  | 'field_petty_cash'
  | 'tax_statutory';

export interface FirmAccountTransaction {
  id: string;
  accountId: string;
  date: string;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  referenceNo?: string;
  category:
    | 'partner_capital'
    | 'plot_booking_advance'
    | 'flat_booking_advance'
    | 'vendor_payout'
    | 'contractor_payout'
    | 'field_imprest'
    | 'partner_draw'
    | 'statutory_fee'
    | 'cash_withdrawal'
    | 'inter_account_transfer'
    | 'interest_credit'
    | 'other'
    | (string & {});
  partnerName?: string;
  projectName?: string;
  balanceAfter: number;
  enrolledBy?: string;
  approvedBy?: string;
  status?: 'approved' | 'pending' | 'cleared';
  paymentMode?: string;
  notes?: string;
}

export interface IndividualInvestmentRecord {
  id: string;
  firmId: string;
  projectId: string;
  partnerId: string;
  partnerName: string;
  amount: number;
  accountId: string;
  accountName: string;
  accountType: 'bank' | 'cash';
  date: string;
  purpose: string;
  paymentMode: string;
  referenceNo: string;
  notes: string;
  status: 'approved' | 'pending' | 'rejected';
  enrolledBy: string;
  approvedBy?: string;
  approvedAt?: string;
  coSignatory?: string;
  witnessName?: string;
  cashVaultLocation?: string;
  rejectionReason?: string;
}

export interface FirmAccount {
  id: string;
  firmId: string;
  accountName: string;
  bankName: string;
  accountType: FirmAccountType;
  accountNumber: string;
  ifscCode: string;
  branchName: string;
  city: string;
  currentBalance: number;
  openingBalance: number;
  upiId?: string;
  linkedProjectId?: string; // 'all' or specific projectId
  isPrimary: boolean;
  status: 'active' | 'frozen' | 'closed';
  authorizedSignatories: string[];
  createdDate: string;
  notes?: string;
  recentTransactions?: FirmAccountTransaction[];
}

