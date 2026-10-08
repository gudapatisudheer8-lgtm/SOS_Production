import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

export type SectorId =
  | 'real-estate'
  | 'residential'
  | 'liquor-retail'
  | 'infrastructure';

export type VentureStatus = 'Active' | 'Planning' | 'Review';

export interface SectorDefinition {
  id: SectorId;
  name: string;
  shortName: string;
  description: string;
}

export const SECTORS: SectorDefinition[] = [
  {
    id: 'real-estate',
    name: 'Real estate & plotting',
    shortName: 'Real estate',
    description: 'Plot layouts, bookings, approvals, and inventory',
  },
  {
    id: 'residential',
    name: 'Residential construction',
    shortName: 'Construction',
    description: 'Unit matrices, build milestones, and RERA tracking',
  },
  {
    id: 'liquor-retail',
    name: 'Liquor retail',
    shortName: 'Liquor retail',
    description: 'Vend licenses, daily settlements, and stock draws',
  },
  {
    id: 'infrastructure',
    name: 'Infrastructure & EPC',
    shortName: 'Infrastructure',
    description: 'BoQs, measurement books, contractors, and milestones',
  },
];

export interface Venture {
  id: string;
  name: string;
  sector: SectorId;
  location: string;
  status: VentureStatus;
  committed: number;
  deployed: number;
  progress: number;
  partnerCount: number;
  operationalMetric: string;
  stage: string;
  accountName: string;
}

export const INITIAL_VENTURES: Venture[] = [
  {
    id: 'oakwood-enclave',
    name: 'Oakwood Enclave',
    sector: 'real-estate',
    location: 'Hyderabad, Telangana',
    status: 'Active',
    committed: 18000000,
    deployed: 12600000,
    progress: 68,
    partnerCount: 42,
    operationalMetric: '48 plots · 31 booked',
    stage: 'Plot approvals',
    accountName: 'RERA protected escrow',
  },
  {
    id: 'aarna-heights',
    name: 'Aarna Heights',
    sector: 'residential',
    location: 'Vijayawada, Andhra Pradesh',
    status: 'Active',
    committed: 32000000,
    deployed: 21400000,
    progress: 57,
    partnerCount: 19,
    operationalMetric: '64 apartments · 41 assigned',
    stage: 'Structure · floor 9',
    accountName: 'Project current account',
  },
  {
    id: 'south-valley-package',
    name: 'South Valley · Package 03',
    sector: 'infrastructure',
    location: 'Warangal, Telangana',
    status: 'Active',
    committed: 8200000,
    deployed: 6600000,
    progress: 80,
    partnerCount: 6,
    operationalMetric: '12.4 km roadworks',
    stage: 'EPC milestone 4',
    accountName: 'Infrastructure project pool',
  },
  {
    id: 'nandi-retail-cluster',
    name: 'Nandi Retail Cluster',
    sector: 'liquor-retail',
    location: 'Karimnagar, Telangana',
    status: 'Review',
    committed: 4500000,
    deployed: 4100000,
    progress: 91,
    partnerCount: 11,
    operationalMetric: '8 vends · 8 reconciled',
    stage: 'Daily settlement review',
    accountName: 'Retail settlement account',
  },
];

export interface VentureAccount {
  id: string;
  name: string;
  type: string;
  balance: number;
  note: string;
  protected?: boolean;
}

export const SAMPLE_ACCOUNTS: VentureAccount[] = [
  {
    id: 'escrow',
    name: 'RERA protected escrow',
    type: 'Statutory account',
    balance: 14210000,
    note: 'Oakwood Enclave',
    protected: true,
  },
  {
    id: 'capital-pool',
    name: 'Syndicate capital pool',
    type: 'Capital pool',
    balance: 8460000,
    note: 'Shared venture capital',
  },
  {
    id: 'operations',
    name: 'Project operations',
    type: 'Current account',
    balance: 2850000,
    note: 'Aarna Heights',
  },
  {
    id: 'site-cash',
    name: 'Site petty cash',
    type: 'Petty cash',
    balance: 124500,
    note: 'South Valley · Package 03',
  },
];

export interface SampleTransaction {
  id: string;
  title: string;
  detail: string;
  amount: number;
  direction: 'in' | 'out';
  date: string;
  status: 'Verified' | 'Pending';
}

export const SAMPLE_TRANSACTIONS: SampleTransaction[] = [
  {
    id: 'tx-1',
    title: 'Plot booking advance',
    detail: 'Oakwood Enclave · booking receipt',
    amount: 575000,
    direction: 'in',
    date: 'Today · 10:42 AM',
    status: 'Verified',
  },
  {
    id: 'tx-2',
    title: 'Partner capital call',
    detail: 'Aarna Heights · contribution',
    amount: 1250000,
    direction: 'in',
    date: 'Yesterday · 4:18 PM',
    status: 'Verified',
  },
  {
    id: 'tx-3',
    title: 'Earthworks milestone',
    detail: 'South Valley · vendor payout',
    amount: 820000,
    direction: 'out',
    date: 'Oct 06 · 1:05 PM',
    status: 'Pending',
  },
];

const INITIAL_ENABLED_SECTORS: SectorId[] = SECTORS.map((sector) => sector.id);
const SECTORS_KEY = 'syndicateos.demo.enabled-sectors.v1';
const VENTURES_KEY = 'syndicateos.demo.ventures.v1';

interface SyndicateContextValue {
  enabledSectors: SectorId[];
  ventures: Venture[];
  isReady: boolean;
  storageError: string | null;
  setSectorEnabled: (sector: SectorId, enabled: boolean) => Promise<void>;
  addVenture: (
    venture: Omit<Venture, 'id' | 'deployed' | 'progress' | 'partnerCount' | 'status' | 'operationalMetric' | 'stage' | 'accountName'>,
  ) => Promise<Venture>;
}

const SyndicateContext = createContext<SyndicateContextValue | null>(null);

function isSectorId(value: unknown): value is SectorId {
  return SECTORS.some((sector) => sector.id === value);
}

export function SyndicateProvider({ children }: PropsWithChildren) {
  const [enabledSectors, setEnabledSectors] = useState<SectorId[]>(
    INITIAL_ENABLED_SECTORS,
  );
  const [ventures, setVentures] = useState<Venture[]>(INITIAL_VENTURES);
  const [isReady, setIsReady] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([
      AsyncStorage.getItem(SECTORS_KEY),
      AsyncStorage.getItem(VENTURES_KEY),
    ])
      .then(([storedSectors, storedVentures]) => {
        if (!active) return;
        if (storedSectors) {
          const parsed: unknown = JSON.parse(storedSectors);
          if (
            Array.isArray(parsed) &&
            parsed.every((sector) => isSectorId(sector))
          ) {
            setEnabledSectors(parsed);
          }
        }
        if (storedVentures) {
          const parsed: unknown = JSON.parse(storedVentures);
          if (
            Array.isArray(parsed) &&
            parsed.every(
              (venture) =>
                typeof venture === 'object' &&
                venture !== null &&
                'id' in venture &&
                'name' in venture &&
                'sector' in venture &&
                isSectorId(venture.sector),
            )
          ) {
            setVentures(parsed as Venture[]);
          }
        }
      })
      .catch(() => {
        if (active) {
          setStorageError(
            'Local demo changes could not be restored. Close and reopen the app to retry.',
          );
        }
      })
      .finally(() => {
        if (active) setIsReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const setSectorEnabled = useCallback(
    async (sector: SectorId, enabled: boolean) => {
      const next = enabled
        ? Array.from(new Set([...enabledSectors, sector]))
        : enabledSectors.filter((item) => item !== sector);
      try {
        await AsyncStorage.setItem(SECTORS_KEY, JSON.stringify(next));
        setEnabledSectors(next);
        setStorageError(null);
      } catch (error) {
        setStorageError('Could not save the module assignment in local demo storage.');
        throw error;
      }
    },
    [enabledSectors],
  );

  const addVenture = useCallback(
    async (
      input: Omit<
        Venture,
        | 'id'
        | 'deployed'
        | 'progress'
        | 'partnerCount'
        | 'status'
        | 'operationalMetric'
        | 'stage'
        | 'accountName'
      >,
    ) => {
      const nextVenture: Venture = {
        ...input,
        id: `${Date.now()}`,
        deployed: 0,
        progress: 0,
        partnerCount: 0,
        status: 'Planning',
        operationalMetric: 'Setup in progress',
        stage: 'Initial setup',
        accountName: 'Not linked yet',
      };
      const next = [nextVenture, ...ventures];
      try {
        await AsyncStorage.setItem(VENTURES_KEY, JSON.stringify(next));
        setVentures(next);
        setStorageError(null);
        return nextVenture;
      } catch (error) {
        setStorageError('Could not save the venture in local demo storage.');
        throw error;
      }
    },
    [ventures],
  );

  const value = useMemo(
    () => ({
      enabledSectors,
      ventures,
      isReady,
      storageError,
      setSectorEnabled,
      addVenture,
    }),
    [
      enabledSectors,
      ventures,
      isReady,
      storageError,
      setSectorEnabled,
      addVenture,
    ],
  );

  return (
    <SyndicateContext.Provider value={value}>
      {children}
    </SyndicateContext.Provider>
  );
}

export function useSyndicate() {
  const value = useContext(SyndicateContext);
  if (!value) {
    throw new Error('useSyndicate must be used inside SyndicateProvider.');
  }
  return value;
}
