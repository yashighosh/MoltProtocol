export function pickCarrier(destination: string): string {
  if (destination.startsWith("us-")) return "ground";
  return "air";
}
