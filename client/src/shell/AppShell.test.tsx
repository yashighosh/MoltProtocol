import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../auth";
import { AppShell } from "./AppShell";

vi.mock("../api", () => ({
  api: vi.fn(async (path: string) => {
    if (String(path).includes("/auth/me")) {
      return { user: { id: "user-ada", email: "ada.okonkwo@moltprotocol.demo", displayName: "Ada Okonkwo", isDemo: true, identityLabel: "Demo identity" } };
    }
    if (path === "/api/v1/projects") return { projects: [] };
    return {};
  }),
}));

describe("AppShell", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("moltprotocol-welcome-seen", "1");
  });

  it("aligns header controls and keeps collapse readable", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <AuthProvider>
          <AppShell />
        </AuthProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByText(/Signed in as Ada Okonkwo/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Search" })).toHaveClass("chrome-control");
    expect(screen.getByRole("button", { name: "Notifications" })).toHaveClass("chrome-control");
    expect(screen.getByRole("combobox", { name: "Project" })).toHaveClass("chrome-control");
    const collapse = screen.getByRole("button", { name: "Collapse sidebar" });
    expect(collapse).toHaveClass("side-action");
    await user.click(collapse);
    expect(localStorage.getItem("moltprotocol-sidebar")).toBe("1");
    expect(document.querySelector(".shell")).toHaveClass("collapsed");
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Architecture draft/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Settings/ })).toBeInTheDocument();
  });
});
