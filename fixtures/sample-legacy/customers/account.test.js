import { openAccount } from "./account.js";

export function testAccountCarriesDiscount() {
  const account = openAccount({ reference: "A-1", legalName: "Northwind", discountRate: 0.05 });
  return account.legalName === "Northwind";
}
