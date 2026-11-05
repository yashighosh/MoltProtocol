/**
 * Customers are local records with a credit ceiling.
 * A missing id returns null instead of inventing an account.
 */
import { nextId } from "../util/ids.js";

const customers = [];

export function createCustomer(name, creditLimit) {
  const customer = {
    id: nextId("cus"),
    name,
    status: "active",
    creditLimit,
  };
  customers.push(customer);
  return customer;
}

export function getCustomer(id) {
  return customers.find((customer) => customer.id === id) ?? null;
}

export function checkCreditLimit(customer, amount) {
  if (!customer) return false;
  return amount <= customer.creditLimit;
}
