import assert from "node:assert/strict";
import { adjustStock, getAvailable } from "./stock";

adjustStock("AB-1001", "east", 10);
assert.equal(getAvailable("AB-1001", "east"), 10);
adjustStock("AB-1001", "east", -4);
assert.equal(getAvailable("AB-1001", "east"), 6);
