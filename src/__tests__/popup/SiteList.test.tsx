import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import SiteList from "../../popup/components/stats/SiteList";

describe("SiteList", () => {
  it("shows loading state", () => {
    render(<SiteList usage={{}} loading={true} />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("shows empty state when no entries", () => {
    render(<SiteList usage={{}} loading={false} />);
    expect(screen.getByText("No browsing data for this day")).toBeInTheDocument();
  });

  it("renders all site rows", () => {
    render(
      <SiteList
        usage={{ "github.com": 300, "youtube.com": 150 }}
        loading={false}
      />
    );
    expect(screen.getByText("github.com")).toBeInTheDocument();
    expect(screen.getByText("youtube.com")).toBeInTheDocument();
  });

  it("sorts sites by seconds descending", () => {
    render(
      <SiteList
        usage={{ "b.com": 100, "a.com": 500 }}
        loading={false}
      />
    );
    const sites = screen.getAllByText(/\.com/);
    expect(sites[0].textContent).toContain("a.com");
    expect(sites[1].textContent).toContain("b.com");
  });
});
