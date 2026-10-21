import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { LoginForm } from "./LoginPage";

describe("LoginForm", () => {
  it("asks for both fields and surfaces a credential error", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const { rerender } = render(<MemoryRouter><LoginForm busy={false} error="" onSubmit={onSubmit} /></MemoryRouter>);
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toMatch(/email and the password/);
    await user.type(screen.getByLabelText("Email"), "ada.okonkwo@moltprotocol.demo");
    await user.type(screen.getByLabelText("Password"), "wrong");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(onSubmit).toHaveBeenCalledWith("ada.okonkwo@moltprotocol.demo", "wrong");
    rerender(<MemoryRouter><LoginForm busy={false} error="Password does not match this demo identity." onSubmit={onSubmit} /></MemoryRouter>);
    expect(screen.getByRole("alert").textContent).toMatch(/Password does not match/);
    expect(screen.getByText(/Demo sign-in/)).toBeInTheDocument();
  });
});
