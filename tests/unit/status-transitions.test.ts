import { describe, it, expect } from "vitest";
import { isValidOrderTransition } from "@/lib/validation/schemas";

describe("Order Lifecycle State Transitions", () => {
  it("allows legal linear transitions", () => {
    expect(isValidOrderTransition("PENDING", "ACCEPTED")).toBe(true);
    expect(isValidOrderTransition("ACCEPTED", "PREPARING")).toBe(true);
    expect(isValidOrderTransition("PREPARING", "READY")).toBe(true);
    expect(isValidOrderTransition("READY", "SERVED")).toBe(true);
    expect(isValidOrderTransition("SERVED", "COMPLETED")).toBe(true);
  });

  it("allows cancellation from early states", () => {
    expect(isValidOrderTransition("PENDING", "REJECTED")).toBe(true);
    expect(isValidOrderTransition("PENDING", "CANCELLED")).toBe(true);
    expect(isValidOrderTransition("ACCEPTED", "CANCELLED")).toBe(true);
    expect(isValidOrderTransition("PREPARING", "CANCELLED")).toBe(true);
  });

  it("blocks illegal transitions", () => {
    expect(isValidOrderTransition("PENDING", "READY")).toBe(false);
    expect(isValidOrderTransition("PENDING", "SERVED")).toBe(false);
    expect(isValidOrderTransition("PREPARING", "SERVED")).toBe(false);
    expect(isValidOrderTransition("COMPLETED", "PENDING")).toBe(false);
    expect(isValidOrderTransition("CANCELLED", "ACCEPTED")).toBe(false);
    expect(isValidOrderTransition("READY", "CANCELLED")).toBe(false);
  });
});

