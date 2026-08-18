import { describe, it, expect } from "vitest";
import { PLANS_CONFIG } from "../billing.routes";

describe("Billing configuration & plan pricing", () => {
  it("defines FREE, BASIC, STANDARD, and ENTERPRISE plans", () => {
    expect(PLANS_CONFIG.FREE).toBeDefined();
    expect(PLANS_CONFIG.BASIC).toBeDefined();
    expect(PLANS_CONFIG.STANDARD).toBeDefined();
    expect(PLANS_CONFIG.ENTERPRISE).toBeDefined();
  });

  it("sets correct prices and features for plans", () => {
    expect(PLANS_CONFIG.FREE.price).toBe(0);
    expect(PLANS_CONFIG.BASIC.price).toBe(29);
    expect(PLANS_CONFIG.STANDARD.price).toBe(79);
    expect(PLANS_CONFIG.ENTERPRISE.price).toBe(199);

    expect(PLANS_CONFIG.BASIC.currency).toBe("USD");
    expect(PLANS_CONFIG.STANDARD.currency).toBe("USD");
    expect(PLANS_CONFIG.ENTERPRISE.currency).toBe("USD");

    expect(PLANS_CONFIG.BASIC.features.length).toBeGreaterThan(0);
    expect(PLANS_CONFIG.STANDARD.features.length).toBeGreaterThan(0);
    expect(PLANS_CONFIG.ENTERPRISE.features.length).toBeGreaterThan(0);
  });
});
