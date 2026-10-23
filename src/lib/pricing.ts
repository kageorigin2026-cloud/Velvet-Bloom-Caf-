export interface PricingItemInput {
  unitPrice: number;
  quantity: number;
  optionsExtraPrice?: number;
}

export interface CalculatedBill {
  subtotal: number;
  tax: number;
  serviceCharge: number;
  discount: number;
  finalTotal: number;
}

/**
 * Authoritatively calculates subtotal, tax, service charge, and total.
 * Never trust client totals!
 */
export function calculateOrderPricing(
  items: PricingItemInput[],
  taxRatePercent: number = 5,
  serviceChargePercent: number = 0,
  discountAmount: number = 0
): CalculatedBill {
  let subtotal = 0;

  for (const item of items) {
    const qty = Math.max(1, Math.floor(item.quantity || 1));
    const extra = Number(item.optionsExtraPrice || 0);
    const itemTotal = (Number(item.unitPrice || 0) + extra) * qty;
    subtotal += itemTotal;
  }

  // Round subtotal to 2 decimals
  subtotal = Math.round(subtotal * 100) / 100;

  const validDiscount = Math.min(subtotal, Math.max(0, Number(discountAmount || 0)));
  const discountedSubtotal = Math.max(0, subtotal - validDiscount);

  const tax = Math.round((discountedSubtotal * (taxRatePercent / 100)) * 100) / 100;
  const serviceCharge = Math.round((discountedSubtotal * (serviceChargePercent / 100)) * 100) / 100;

  const finalTotal = Math.round((discountedSubtotal + tax + serviceCharge) * 100) / 100;

  return {
    subtotal,
    tax,
    serviceCharge,
    discount: validDiscount,
    finalTotal,
  };
}

/**
 * Calculates equal split per person, allocating any remainder penny to split[0]
 */
export function calculateEqualSplit(totalAmount: number, numberOfPeople: number): number[] {
  const people = Math.max(1, Math.floor(numberOfPeople));
  const baseSplit = Math.floor((totalAmount / people) * 100) / 100;
  const splits: number[] = new Array(people).fill(baseSplit);

  // Distribute remainder cents to first split
  const sum = splits.reduce((acc, curr) => acc + curr, 0);
  const remainder = Math.round((totalAmount - sum) * 100) / 100;
  splits[0] = Math.round((splits[0] + remainder) * 100) / 100;

  return splits;
}

