/**
 * Utilities for Indian Rupee currency formatting, Land Area calculations,
 * and Tally Prime XML sanitization.
 */

export function formatINR(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatIndianCompact(amount: number): string {
  if (!amount || amount === 0) return '₹0';
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  
  if (abs >= 10000000) {
    return `${sign}₹${(abs / 10000000).toFixed(2)} Cr`;
  }
  if (abs >= 100000) {
    return `${sign}₹${(abs / 100000).toFixed(2)} L`;
  }
  if (abs >= 1000) {
    return `${sign}₹${(abs / 1000).toFixed(1)} K`;
  }
  return `${sign}₹${abs}`;
}

export function convertToSqYards(value: number, unit: 'Acres' | 'Sq. Yards' | 'Guntas / Cents'): number {
  if (unit === 'Acres') {
    return value * 4840;
  }
  if (unit === 'Guntas / Cents') {
    // 40 guntas or 100 cents per acre -> approx 121 sq yds per gunta or 48.4 per cent
    return value * 121;
  }
  return value;
}

export function calculateLayoutMetrics(
  totalExtentValue: number,
  unit: 'Acres' | 'Sq. Yards' | 'Guntas / Cents',
  roadWidth: 20 | 30 | 40 | 60,
  openSpacePercent: number = 10
) {
  const grossSqYards = convertToSqYards(totalExtentValue, unit);
  
  // Standard road width deduction percentages based on DTCP/HMDA layout standards
  let roadLossPercent = 25;
  if (roadWidth === 20) roadLossPercent = 22;
  else if (roadWidth === 30) roadLossPercent = 28;
  else if (roadWidth === 40) roadLossPercent = 33;
  else if (roadWidth === 60) roadLossPercent = 38;

  const roadLossSqYards = Math.round(grossSqYards * (roadLossPercent / 100));
  const parkAmenityLossSqYards = Math.round(grossSqYards * (openSpacePercent / 100));
  const totalDeductions = roadLossSqYards + parkAmenityLossSqYards;
  const netSellableSqYards = Math.max(0, grossSqYards - totalDeductions);
  const netSellablePercent = grossSqYards > 0 ? ((netSellableSqYards / grossSqYards) * 100).toFixed(1) : '0';

  // Standard 200 sq yd plots feasible
  const estimatedPlotsOf200SqYds = Math.floor(netSellableSqYards / 200);

  return {
    grossSqYards,
    roadLossPercent,
    roadLossSqYards,
    parkAmenityLossSqYards,
    totalDeductions,
    netSellableSqYards,
    netSellablePercent,
    estimatedPlotsOf200SqYds,
    equivalentGuntas: (netSellableSqYards / 121).toFixed(1),
    equivalentCents: (netSellableSqYards / 48.4).toFixed(1),
    equivalentAnkanams: Math.round(netSellableSqYards / 8),
  };
}

/**
 * Generate sanitized Tally Prime compliant XML string for formal accounting export.
 * Strips raw personal notes and creates standard ledger vouchers.
 */
export function generateTallyXML(
  firmName: string,
  vouchers: Array<{
    date: string;
    voucherType: string;
    ledgerName: string;
    amount: number;
    narration: string;
    contraLedger: string;
  }>
): string {
  const dateFormatted = new Date().toISOString().split('T')[0].replace(/-/g, '');
  
  const voucherXmlList = vouchers.map((v, i) => `
    <TALLYMESSAGE xmlns:UDF="TallyUDF">
      <VOUCHER VCHTYPE="${v.voucherType}" ACTION="Create" OBJVIEW="Accounting Voucher View">
        <DATE>${dateFormatted}</DATE>
        <VOUCHERTYPENAME>${v.voucherType}</VOUCHERTYPENAME>
        <VOUCHERNUMBER>SYN-${1000 + i}</VOUCHERNUMBER>
        <PARTYLEDGERNAME>${v.ledgerName}</PARTYLEDGERNAME>
        <NARRATION>${v.narration.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</NARRATION>
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>${v.ledgerName}</LEDGERNAME>
          <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
          <AMOUNT>-${v.amount}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>${v.contraLedger}</LEDGERNAME>
          <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
          <AMOUNT>${v.amount}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>
      </VOUCHER>
    </TALLYMESSAGE>
  `).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${firmName.replace(/&/g, '&amp;')}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
${voucherXmlList}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}

export function generateTallyCSV(
  firmName: string,
  vouchers: Array<{
    date: string;
    voucherType: string;
    ledgerName: string;
    amount: number;
    narration: string;
    contraLedger: string;
  }>
): string {
  const headers = ['Voucher Date', 'Voucher Type', 'Debit Ledger', 'Credit Ledger', 'Amount (INR)', 'Narration', 'Company'];
  const rows = vouchers.map((v) => [
    v.date,
    v.voucherType,
    `"${v.ledgerName}"`,
    `"${v.contraLedger}"`,
    v.amount,
    `"${v.narration.replace(/"/g, '""')}"`,
    `"${firmName.replace(/"/g, '""')}"`,
  ]);
  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}
