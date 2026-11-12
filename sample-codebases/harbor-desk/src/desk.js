import { reserveSlip } from "./slips/reserve.js";
import { findMember } from "./members/member.js";
import { quoteStay } from "./fees/quote.js";
import { postStay } from "./ledger/post.js";
import { sendArrivalNote } from "./notices/notice.js";

/**
 * Open one paid stay for a named member and a numbered slip.
 * The desk quotes the stay, posts the charge, and sends the arrival note.
 */
export function openStay(memberName, slipNumber, nights) {
  const member = findMember(memberName);
  if (!member) return { ok: false, reason: "Member is not on the roll." };
  const reserved = reserveSlip(slipNumber, nights);
  if (!reserved.ok) return reserved;
  const amount = quoteStay(reserved.slip, nights, member);
  const posted = postStay(amount, member);
  sendArrivalNote(member, reserved.slip);
  return { ok: true, amount, receipt: posted.receipt };
}
