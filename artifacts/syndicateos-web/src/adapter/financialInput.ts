/** Explicit form contracts: display and local approval fields are never money instructions. */
export function investmentInput(d: Record<string, any>) {
  if (!d.partnerId || String(d.partnerId).startsWith('partner-'))
    throw new Error('Select a registered project partner before recording an investment.');
  const { status, approvedBy, approvedAt, partnerName, accountName, accountType, proofSlip, ...data } = d;
  return data;
}
export function drawingInput(d: Record<string, any>) {
  return {
    partnerId: d.partnerId, accountId: d.sourceAccountId, amount: d.amount,
    date: String(d.date || d.requestedAt || '').slice(0, 10),
    payoutMode: d.payoutMode, purpose: d.purpose,
    destinationAccountDetails: d.destinationAccountDetails,
  };
}
export function bookingInput(d: Record<string, any>, inventoryId: string) {
  return {
    inventoryId, date: String(d.bookedAt || '').slice(0, 10),
    accountId: d.bookingAccountId, buyerName: d.buyerName, buyerPhone: d.buyerPhone,
    buyerRegistrationId: d.buyerRegistrationId, ratePerSqYard: d.ratePerSqYard,
    bookingStatus: d.status, paymentMilestone: d.paymentMilestone,
    advanceReceived: d.advanceReceived, paymentMode: d.paymentMode,
    paymentRefNumber: d.paymentRefNumber, notes: d.notes,
  };
}
