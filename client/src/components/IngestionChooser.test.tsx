import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { IngestionChooser } from "./IngestionChooser";

describe("IngestionChooser", () => {
  it("blocks an invalid git URL and accepts a ready https URL", async () => {
    const user = userEvent.setup();
    const onGit = vi.fn();
    render(<IngestionChooser busy={false} serverError="" onUpload={vi.fn()} onGit={onGit} onSample={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Git URL" }));
    await user.type(screen.getByLabelText("Project name"), "Billing");
    await user.type(screen.getByLabelText("Git URL"), "http://127.0.0.1/repo.git");
    await user.click(screen.getByRole("button", { name: "Submit codebase" }));
    expect(onGit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toMatch(/https:\/\//);
    await user.clear(screen.getByLabelText("Git URL"));
    await user.type(screen.getByLabelText("Git URL"), "https://github.com/example/legacy");
    await user.click(screen.getByRole("button", { name: "Submit codebase" }));
    expect(onGit).toHaveBeenCalledWith("Billing", "https://github.com/example/legacy");
  });
});
