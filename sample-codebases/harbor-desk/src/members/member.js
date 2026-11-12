const ROLL = [
  { name: "Mina Cole", kind: "member" },
  { name: "Harbor Guest", kind: "visitor" },
];

/**
 * Members receive the slip discount. Visitors pay the posted rate.
 */
export function findMember(name) {
  return ROLL.find((person) => person.name === name) ?? null;
}

export function isMember(person) {
  return person?.kind === "member";
}
