import { renderNotice } from "./templates.js";

/**
 * Send the arrival note after a slip is reserved.
 * The note names the member and the slip. It does not change the charge.
 */
export function sendArrivalNote(member, slip) {
  return renderNotice(`${member.name} arrives at ${slip.label}`);
}
