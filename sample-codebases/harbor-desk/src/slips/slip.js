/**
 * A slip is one berth. The nightly rate is the posted rate, not a negotiated price.
 */
export function describeSlip(number, nightlyRate, lengthFeet) {
  return {
    number,
    nightlyRate,
    lengthFeet,
    label: `Slip ${number}`,
  };
}

export function fitsBoat(slip, boatFeet) {
  return boatFeet <= slip.lengthFeet;
}
