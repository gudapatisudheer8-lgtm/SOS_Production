// Ported from source utils/formatters.ts. Tally output escapes every interpolated value.
export function formatINR(amount: number): string {
  if (!Number.isFinite(amount)) return 'Rs 0';
  return 'Rs ' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
}
export function formatIndianCompact(amount: number): string {
  if (!amount) return 'Rs 0';
  const abs = Math.abs(amount); const sign = amount < 0 ? '-' : '';
  if (abs >= 1e7) return `${sign}Rs ${(abs / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `${sign}Rs ${(abs / 1e5).toFixed(2)} L`;
  if (abs >= 1e3) return `${sign}Rs ${(abs / 1e3).toFixed(1)} K`;
  return `${sign}Rs ${abs}`;
}
export type AreaUnit = 'Acres' | 'Sq. Yards' | 'Guntas / Cents';
export const AREA_UNITS: AreaUnit[] = ['Acres', 'Sq. Yards', 'Guntas / Cents'];
export const ROAD_WIDTHS = [20, 30, 40, 60] as const;
export function convertToSqYards(v: number, u: AreaUnit): number { return u === 'Acres' ? v * 4840 : u === 'Guntas / Cents' ? v * 121 : v; }
export function calculateLayoutMetrics(totalExtentValue: number, unit: AreaUnit, roadWidth: number, openSpacePercent = 10) {
  const gross = convertToSqYards(totalExtentValue, unit);
  const roadLossPercent = roadWidth === 20 ? 22 : roadWidth === 30 ? 28 : roadWidth === 40 ? 33 : roadWidth === 60 ? 38 : 25;
  const road = Math.round(gross * (roadLossPercent / 100));
  const park = Math.round(gross * (openSpacePercent / 100));
  const net = Math.max(0, gross - road - park);
  return { grossSqYards: gross, roadLossPercent, roadLossSqYards: road, parkAmenityLossSqYards: park, totalDeductions: road + park, netSellableSqYards: net,
    netSellablePercent: gross > 0 ? ((net / gross) * 100).toFixed(1) : '0', estimatedPlotsOf200SqYds: Math.floor(net / 200),
    equivalentGuntas: (net / 121).toFixed(1), equivalentCents: (net / 48.4).toFixed(1), equivalentAnkanams: Math.round(net / 8) };
}
export interface Voucher { date: string; voucherType: string; ledgerName: string; amount: number; narration: string; contraLedger: string; }
export const xmlEsc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
export function generateTallyXML(firmName: string, vouchers: Voucher[]): string {
  const list = vouchers.map((v, i) => `
    <TALLYMESSAGE xmlns:UDF="TallyUDF">
      <VOUCHER VCHTYPE="${xmlEsc(v.voucherType)}" ACTION="Create" OBJVIEW="Accounting Voucher View">
        <DATE>${xmlEsc(v.date.replace(/-/g, ''))}</DATE>
        <VOUCHERTYPENAME>${xmlEsc(v.voucherType)}</VOUCHERTYPENAME>
        <VOUCHERNUMBER>SYN-${1000 + i}</VOUCHERNUMBER>
        <PARTYLEDGERNAME>${xmlEsc(v.ledgerName)}</PARTYLEDGERNAME>
        <NARRATION>${xmlEsc(v.narration)}</NARRATION>
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>${xmlEsc(v.ledgerName)}</LEDGERNAME>
          <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
          <AMOUNT>-${v.amount}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>${xmlEsc(v.contraLedger)}</LEDGERNAME>
          <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
          <AMOUNT>${v.amount}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>
      </VOUCHER>
    </TALLYMESSAGE>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES><SVCURRENTCOMPANY>${xmlEsc(firmName)}</SVCURRENTCOMPANY></STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
${list}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}
const csvCell = (s: string) => `"${s.replace(/"/g, '""')}"`;
export function generateTallyCSV(firmName: string, vouchers: Voucher[]): string {
  const head = ['Voucher Date', 'Voucher Type', 'Debit Ledger', 'Credit Ledger', 'Amount (INR)', 'Narration', 'Company'];
  return [head.join(','), ...vouchers.map((v) => [csvCell(v.date), csvCell(v.voucherType), csvCell(v.ledgerName), csvCell(v.contraLedger), String(v.amount), csvCell(v.narration), csvCell(firmName)].join(','))].join('\n');
}
