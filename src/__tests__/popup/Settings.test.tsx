import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import Settings from "../../popup/components/pomodoro/Settings";
import { DEFAULT_SETTINGS } from "../../shared/constants";

describe("Settings", () => {
  it("renders current settings values", () => {
    render(
      <Settings
        settings={DEFAULT_SETTINGS}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByLabelText("Focus (min)")).toHaveValue(25);
    expect(screen.getByLabelText("Short break (min)")).toHaveValue(5);
  });

  it("calls onSave with updated values", async () => {
    const onSave = vi.fn();
    render(
      <Settings settings={DEFAULT_SETTINGS} onSave={onSave} onClose={vi.fn()} />
    );
    const input = screen.getByLabelText("Focus (min)");
    fireEvent.change(input, { target: { value: "30" } });
    fireEvent.click(screen.getByText("Save"));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ workMinutes: 30 })));
  });

  it("shows validation error for out-of-range value", async () => {
    render(
      <Settings settings={DEFAULT_SETTINGS} onSave={vi.fn()} onClose={vi.fn()} />
    );
    const input = screen.getByLabelText("Focus (min)");
    fireEvent.change(input, { target: { value: "0" } });
    fireEvent.click(screen.getByText("Save"));
    await waitFor(() => expect(screen.getByText("Must be 1–60")).toBeInTheDocument());
  });

  it("does not call onSave when validation fails", () => {
    const onSave = vi.fn();
    render(
      <Settings settings={DEFAULT_SETTINGS} onSave={onSave} onClose={vi.fn()} />
    );
    fireEvent.change(screen.getByLabelText("Focus (min)"), { target: { value: "0" } });
    fireEvent.click(screen.getByText("Save"));
    expect(onSave).not.toHaveBeenCalled();
  });

  it("calls onClose when Cancel is clicked", () => {
    const onClose = vi.fn();
    render(
      <Settings settings={DEFAULT_SETTINGS} onSave={vi.fn()} onClose={onClose} />
    );
    fireEvent.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalled();
  });
});
