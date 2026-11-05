import assert from "node:assert/strict";
import { calculateTax, roundCurrency } from "./tax.js";

assert.equal(calculateTax(100, "east"), 8);
assert.equal(calculateTax(100, "west"), 9.5);
assert.equal(roundCurrency(1.235), 1.24);
