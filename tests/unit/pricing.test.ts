import { describe, it, expect } from "vitest";
import { calculateOrderPricing, calculateEqualSplit } from "@/lib/pricing";

describe("Pricing and Tax Calculations", () => {
  it("calculates basic order subtotal, 5% GST tax, and total accurately", () => {
    const items = [
      { unitPrice: 320, quantity: 2, optionsExtraPrice: 40 }, // (320 + 40) * 2 = 720
      { unitPrice: 440, quantity: 1, optionsExtraPrice: 0 },  // 440 * 1 = 440
    ];

    const result = calculateOrderPricing(items, 5, 0, 0);

    expect(result.subtotal).toBe(1160.0);
    expect(result.tax).toBe(58.0); // 5% of 1160
    expect(result.serviceCharge).toBe(0);
    expect(result.discount).toBe(0);
    expect(result.finalTotal).toBe(1218.0); // 1160 + 58
  });

  it("handles valid discounts without allowing negative total", () => {
    const items = [{ unitPrice: 500, quantity: 1, optionsExtraPrice: 0 }];

    // 100 discount on 500 subtotal -> 400 taxable subtotal
    const resultWithDiscount = calculateOrderPricing(items, 5, 0, 100);
    expect(resultWithDiscount.subtotal).toBe(500);
    expect(resultWithDiscount.discount).toBe(100);
    expect(resultWithDiscount.tax).toBe(20); // 5% of 400
    expect(resultWithDiscount.finalTotal).toBe(420);

    // Excessive discount capping
    const resultExcessive = calculateOrderPricing(items, 5, 0, 9999);
    expect(resultExcessive.discount).toBe(500);
    expect(resultExcessive.tax).toBe(0);
    expect(resultExcessive.finalTotal).toBe(0);
  });

  it("calculates service charge when configured", () => {
    const items = [{ unitPrice: 1000, quantity: 1, optionsExtraPrice: 0 }];
    const result = calculateOrderPricing(items, 5, 10, 0);

    expect(result.subtotal).toBe(1000);
    expect(result.tax).toBe(50); // 5% GST
    expect(result.serviceCharge).toBe(100); // 10% service charge
    expect(result.finalTotal).toBe(1150);
  });
});

describe("Equal Bill Split Calculations", () => {
  it("splits clean divisible amounts equally", () => {
    const splits = calculateEqualSplit(300, 3);
    expect(splits).toEqual([100, 100, 100]);
  });

  it("allocates remainder cents to the first split cleanly without fractional pennies", () => {
    const splits = calculateEqualSplit(100, 3);
    // 100 / 3 = 33.33 * 3 = 99.99 (remainder 0.01 added to first split)
    expect(splits).toEqual([33.34, 33.33, 33.33]);

    const sum = splits.reduce((acc, curr) => acc + curr, 0);
    expect(sum).toBe(100.0);
  });

  it("handles 1 person split gracefully", () => {
    const splits = calculateEqualSplit(450.5, 1);
    expect(splits).toEqual([450.5]);
  });
});

