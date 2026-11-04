import { describe, expect, it } from "vitest";

function channel(value: number) {
  const ratio = value / 255;
  return ratio <= 0.04045 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string) {
  const value = Number.parseInt(hex.slice(1), 16);
  const red = channel((value >> 16) & 255);
  const green = channel((value >> 8) & 255);
  const blue = channel(value & 255);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(ink: string, wash: string) {
  const lighter = Math.max(luminance(ink), luminance(wash));
  const darker = Math.min(luminance(ink), luminance(wash));
  return (lighter + 0.05) / (darker + 0.05);
}

describe("workspace ink and wash contrast", () => {
  it("meets 4.5:1 for the added pairs", () => {
    const pairs = [
      ["#4b5f3d", "#e3e9d9"],
      ["#1f5c60", "#d8e8e8"],
      ["#6b5d4c", "#e6ddd0"],
      ["#2b1f17", "#f4eee3"],
    ];
    for (const [ink, wash] of pairs) {
      expect(contrast(ink, wash)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
