import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { GraphCanvas } from "./GraphCanvas";

const nodes = [
  { id: "m1", name: "billing/invoice.js", kind: "file", directory: "billing", resolution: "confirmed" },
  { id: "m2", name: "billing/tax.js", kind: "file", directory: "billing", resolution: "confirmed" },
];
const edges = [
  { id: "e1", from: "m1", to: "m2", relationship: "import", resolution: "confirmed", detail: null },
];

describe("GraphCanvas", () => {
  it("selects a module from the keyboard-reachable node", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<GraphCanvas projectId="p1" nodes={nodes} edges={edges} selectedId="" onSelect={onSelect} />);
    expect(screen.getByText("Confirmed relationship")).toBeInTheDocument();
    expect(screen.getByText("Unresolved relationship")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "billing/invoice.js" }));
    expect(onSelect).toHaveBeenCalledWith("m1");
    await user.type(screen.getByLabelText("Search modules"), "tax");
    expect(screen.getByRole("button", { name: "billing/invoice.js" })).toHaveClass("dim");
  });
});
