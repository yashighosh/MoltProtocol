import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { CoverageBar } from "./CoverageBar";
import { DataTable } from "./DataTable";
import { FilterBar, useFilterParams } from "./FilterBar";
import { RiskBadge } from "./RiskBadge";

function FilterProbe() {
  const { params, setFilter } = useFilterParams();
  return (
    <div>
      <FilterBar label="Areas" search={params.get("q") ?? ""} onSearch={(value) => setFilter("q", value)} />
      <p>Query {params.get("q") ?? ""}</p>
    </div>
  );
}

describe("workspace building blocks", () => {
  it("sorts with aria-sort and keeps an empty table honest", async () => {
    const user = userEvent.setup();
    const onSort = vi.fn();
    render(
      <DataTable
        caption="Areas"
        columns={[{ id: "name", header: "Area", sortable: true, render: (row: { id: string; name: string }) => row.name }]}
        rows={[]}
        sort="name"
        dir="desc"
        onSort={onSort}
        empty="No areas match this filter."
      />,
    );
    expect(screen.getByRole("columnheader", { name: /Area/ })).toHaveAttribute("aria-sort", "descending");
    expect(screen.getByText("No areas match this filter.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Area/ }));
    expect(onSort).toHaveBeenCalledWith("name");
  });

  it("writes a search filter into the address", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/leadership/p1"]}>
        <Routes>
          <Route path="/leadership/:projectId" element={<FilterProbe />} />
        </Routes>
      </MemoryRouter>,
    );
    await user.type(screen.getByRole("textbox", { name: "Search" }), "billing");
    expect(screen.getByText("Query billing")).toBeInTheDocument();
  });

  it("shows coverage counts and does not treat a missing count as zero", () => {
    render(<CoverageBar counts={{ preserved: null, mentionedOnly: 1, distorted: 1, dropped: 2, retired: 0, notInScope: null }} />);
    expect(screen.getByText(/Preserved: Not assessed/)).toBeInTheDocument();
    expect(screen.getByText(/Dropped: 2/)).toBeInTheDocument();
    expect(screen.getByText(/Retired: 0/)).toBeInTheDocument();
  });

  it("labels an unassessed risk without calling it low", () => {
    render(<RiskBadge band="not_assessed" />);
    expect(screen.getByText("Not assessed")).toBeInTheDocument();
    expect(screen.queryByText("Low risk")).not.toBeInTheDocument();
  });
});
