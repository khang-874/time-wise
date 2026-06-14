import { useState } from "react";
import type { PomodoroPhase } from "../../../shared/types";

interface Props {
  currentTask: string;
  phase: PomodoroPhase;
  running: boolean;
  elapsedSeconds: number;
  onChange: (task: string) => void;
  onSave: (task: string) => Promise<void>;
  onComplete: () => Promise<void>;
}

export default function TaskInput({
  currentTask,
  phase,
  running,
  elapsedSeconds,
  onChange,
  onSave,
  onComplete,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  if (phase !== "work") return null;

  const isFresh = elapsedSeconds === 0 && !running;

  // Fresh session: simple editable input
  if (isFresh) {
    return (
      <div className="px-4 pb-3">
        <input
          type="text"
          value={currentTask}
          onChange={(e) => onChange(e.target.value)}
          placeholder="What are you working on?"
          aria-label="Session task"
          maxLength={120}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:border-gray-500 bg-white"
        />
      </div>
    );
  }

  // Session in progress, no task set: let user type one
  if (!currentTask && !editing) {
    return (
      <div className="px-4 pb-3 flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && draft.trim()) {
              onSave(draft.trim());
              onChange(draft.trim());
              setDraft("");
            }
          }}
          placeholder="What are you working on?"
          aria-label="Session task"
          maxLength={120}
          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:border-gray-500 bg-white"
        />
        <button
          onClick={() => {
            if (draft.trim()) {
              onSave(draft.trim());
              onChange(draft.trim());
              setDraft("");
            }
          }}
          className="px-3 py-2 text-sm bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          Set
        </button>
      </div>
    );
  }

  // Editing existing task mid-session
  if (editing) {
    return (
      <div className="px-4 pb-3 flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && draft.trim()) {
              onSave(draft.trim());
              onChange(draft.trim());
              setEditing(false);
            } else if (e.key === "Escape") {
              setEditing(false);
            }
          }}
          autoFocus
          maxLength={120}
          aria-label="Edit task"
          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:border-gray-500 bg-white"
        />
        <button
          onClick={() => {
            if (draft.trim()) {
              onSave(draft.trim());
              onChange(draft.trim());
            }
            setEditing(false);
          }}
          className="px-3 py-2 text-sm bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          Save
        </button>
      </div>
    );
  }

  // Task is set and session is running: show task with Done + edit buttons
  return (
    <div className="px-4 pb-3 flex items-center gap-2">
      <span className="flex-1 text-sm text-gray-700 truncate" title={currentTask}>
        {currentTask}
      </span>
      <button
        onClick={() => {
          setDraft(currentTask);
          setEditing(true);
        }}
        aria-label="Edit task"
        className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded transition-colors"
      >
        Edit
      </button>
      <button
        onClick={onComplete}
        aria-label="Mark task done"
        className="text-xs text-green-600 hover:text-green-700 font-medium px-2 py-1 rounded transition-colors"
      >
        ✓ Done
      </button>
    </div>
  );
}
