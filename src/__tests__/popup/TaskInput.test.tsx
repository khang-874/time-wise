import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import TaskInput from "../../popup/components/pomodoro/TaskInput";

function renderInput(props: Partial<Parameters<typeof TaskInput>[0]> = {}) {
  const defaults = {
    currentTask: "",
    phase: "work" as const,
    running: false,
    elapsedSeconds: 0,
    onChange: vi.fn(),
    onSave: vi.fn().mockResolvedValue(undefined),
    onComplete: vi.fn().mockResolvedValue(undefined),
  };
  return render(<TaskInput {...defaults} {...props} />);
}

describe("TaskInput", () => {
  it("renders null when phase is not work", () => {
    const { container } = renderInput({ phase: "shortBreak" });
    expect(container.firstChild).toBeNull();
  });

  it("renders null during longBreak", () => {
    const { container } = renderInput({ phase: "longBreak" });
    expect(container.firstChild).toBeNull();
  });

  it("shows editable input for a fresh session", () => {
    renderInput({ elapsedSeconds: 0, running: false });
    expect(screen.getByLabelText("Session task")).toBeInTheDocument();
    expect(screen.getByLabelText("Session task")).not.toBeDisabled();
  });

  it("calls onChange when typing in the fresh-session input", () => {
    const onChange = vi.fn();
    renderInput({ onChange });
    fireEvent.change(screen.getByLabelText("Session task"), { target: { value: "Write tests" } });
    expect(onChange).toHaveBeenCalledWith("Write tests");
  });

  it("shows task text, Edit, and Done buttons when running with a task", () => {
    renderInput({ currentTask: "Write PR", running: true, elapsedSeconds: 60 });
    expect(screen.getByText("Write PR")).toBeInTheDocument();
    expect(screen.getByLabelText("Edit task")).toBeInTheDocument();
    expect(screen.getByLabelText("Mark task done")).toBeInTheDocument();
  });

  it("calls onComplete when Done is clicked", () => {
    const onComplete = vi.fn().mockResolvedValue(undefined);
    renderInput({ currentTask: "Write PR", running: true, elapsedSeconds: 60, onComplete });
    fireEvent.click(screen.getByLabelText("Mark task done"));
    expect(onComplete).toHaveBeenCalled();
  });

  it("switches to edit mode when Edit is clicked", () => {
    renderInput({ currentTask: "Write PR", running: true, elapsedSeconds: 60 });
    fireEvent.click(screen.getByLabelText("Edit task"));
    expect(screen.getByLabelText("Edit task")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Write PR")).toBeInTheDocument();
  });

  it("calls onSave and leaves edit mode when Save is clicked", () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onChange = vi.fn();
    renderInput({ currentTask: "Write PR", running: true, elapsedSeconds: 60, onSave, onChange });
    fireEvent.click(screen.getByLabelText("Edit task"));
    fireEvent.change(screen.getByDisplayValue("Write PR"), { target: { value: "Fix bug" } });
    fireEvent.click(screen.getByText("Save"));
    expect(onSave).toHaveBeenCalledWith("Fix bug");
  });

  it("shows a free-form input when running but no task is set", () => {
    renderInput({ currentTask: "", running: true, elapsedSeconds: 60 });
    expect(screen.getByPlaceholderText("What are you working on?")).toBeInTheDocument();
    expect(screen.getByText("Set")).toBeInTheDocument();
  });

  it("calls onSave when Set is clicked with a non-empty draft", () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderInput({ currentTask: "", running: true, elapsedSeconds: 60, onSave });
    fireEvent.change(screen.getByPlaceholderText("What are you working on?"), {
      target: { value: "New task" },
    });
    fireEvent.click(screen.getByText("Set"));
    expect(onSave).toHaveBeenCalledWith("New task");
  });
});
