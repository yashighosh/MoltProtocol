export function z(x: number, y: number): number {
  let n = x;
  if (n > 0) {
    if (y > 0) {
      if (n > y) {
        if (n > 10) {
          n = n - y;
        } else {
          n = y;
        }
      } else if (y > 4) {
        n = n + 1;
      } else {
        n = n + y;
      }
    } else if (y < 0) {
      n = n + 2;
    } else {
      n = n + 3;
    }
  } else if (n < 0) {
    if (y < 0) {
      n = 0;
    } else {
      n = 1;
    }
  } else {
    n = y > 2 ? 4 : 5;
  }
  return n;
}
