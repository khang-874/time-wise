import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import TimerDisplay from "../../popup/components/pomodoro/TimerDisplay";

describe("TimerDisplay", () => {
  it("shows 25:00 for 1500 seconds", () => {
    render(<TimerDisplay remainingSeconds={1500} phase="work" durationSeconds={1500} />);
    expect(screen.getByText("25:00")).toBeInTheDocument();
  });

  it("shows 00:00 for 0 seconds", () => {
    render(<TimerDisplay remainingSeconds={0} phase="work" durationSeconds={1500} />);
    expect(screen.getByText("00:00")).toBeInTheDocument();
  });

  it("shows 01:30 for 90 seconds", () => {
    render(<TimerDisplay remainingSeconds={90} phase="shortBreak" durationSeconds={300} />);
    expect(screen.getByText("01:30")).toBeInTheDocument();
  });

  it("shows 'Focus' label for work phase", () => {
    render(<TimerDisplay remainingSeconds={1500} phase="work" durationSeconds={1500} />);
    expect(screen.getByText("Focus")).toBeInTheDocument();
  });

  it("shows 'Short Break' label for shortBreak phase", () => {
    render(<TimerDisplay remainingSeconds={300} phase="shortBreak" durationSeconds={300} />);
    expect(screen.getByText("Short Break")).toBeInTheDocument();
  });

  it("shows 'Long Break' label for longBreak phase", () => {
    render(<TimerDisplay remainingSeconds={900} phase="longBreak" durationSeconds={900} />);
    expect(screen.getByText("Long Break")).toBeInTheDocument();
  });
});
