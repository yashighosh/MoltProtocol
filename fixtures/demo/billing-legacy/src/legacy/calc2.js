// Keep the legacy rate path beside billing.
// Callers still expect a numeric result.
// The rate table lives outside this folder.
// Do not rename the exported entry.
import { rate } from "./old_rates.js";

export function q(x) {
  let n = x;
  if (n > 0) {
    if (n > 10) {
      if (n > 20) {
        if (n > 40) {
          n = rate(n);
        } else {
          n = n - 1;
        }
      } else if (n > 15) {
        n = n + 2;
      } else {
        n = n + 1;
      }
    } else if (n > 5) {
      n = n * 2;
    } else {
      n = n + 3;
    }
  } else if (n < 0) {
    if (n < -5) {
      n = 0;
    } else {
      n = 1;
    }
  } else {
    n = 4;
  }
  // TODO: replace the nested rate branches
  return n;
}
