export interface Product {
  sku: string;
  name: string;
  unitPrice: number;
}

export function validateSku(sku: string): boolean {
  return /^[A-Z]{2}-\d{4}$/.test(sku);
}

export function registerProduct(sku: string, name: string, unitPrice: number): Product {
  if (!validateSku(sku)) {
    throw new Error("sku is not in the expected form");
  }
  return { sku, name, unitPrice };
}
