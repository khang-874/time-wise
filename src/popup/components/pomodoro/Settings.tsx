import { useState } from "react";
import type { PomodoroSettings } from "../../../shared/types";

interface Props {
  settings: PomodoroSettings;
  onSave: (s: PomodoroSettings) => void;
  onClose: () => void;
}

type FieldKey = "workMinutes" | "shortBreakMinutes" | "longBreakMinutes" | "longBreakInterval";

const FIELDS: { key: FieldKey; label: string; min: number; max: number }[] = [
  { key: "workMinutes", label: "Focus (min)", min: 1, max: 60 },
  { key: "shortBreakMinutes", label: "Short break (min)", min: 1, max: 30 },
  { key: "longBreakMinutes", label: "Long break (min)", min: 1, max: 60 },
  { key: "longBreakInterval", label: "Long break every", min: 1, max: 10 },
];

export default function Settings({ settings, onSave, onClose }: Props) {
  const [draft, setDraft] = useState<PomodoroSettings>(settings);
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});

  const validate = (): boolean => {
    const errs: Partial<Record<FieldKey, string>> = {};
    for (const f of FIELDS) {
      const v = draft[f.key];
      if (!Number.isInteger(v) || v < f.min || v > f.max) {
        errs[f.key] = `Must be ${f.min}–${f.max}`;
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = () => {
    if (validate()) {
      onSave(draft);
      onClose();
    }
  };

  const update = (key: FieldKey, raw: string) => {
    const v = parseInt(raw, 10);
    setDraft((prev) => ({ ...prev, [key]: isNaN(v) ? 0 : v }));
  };

  return (
    <div className="px-4 py-3 border-t border-gray-100">
      <div className="text-sm font-semibold text-gray-700 mb-3">Settings</div>
      {FIELDS.map((f) => (
        <div key={f.key} className="flex items-center justify-between mb-2">
          <label htmlFor={f.key} className="text-sm text-gray-600">
            {f.label}
          </label>
          <div className="flex flex-col items-end">
            <input
              id={f.key}
              type="number"
              min={f.min}
              max={f.max}
              value={draft[f.key]}
              onChange={(e) => update(f.key, e.target.value)}
              className="w-16 text-right border border-gray-200 rounded px-2 py-1 text-sm"
            />
            {errors[f.key] && (
              <span className="text-xs text-red-500 mt-0.5">{errors[f.key]}</span>
            )}
          </div>
        </div>
      ))}
      <div className="flex items-center justify-between mb-3">
        <label htmlFor="notificationsEnabled" className="text-sm text-gray-600">
          Notifications
        </label>
        <input
          id="notificationsEnabled"
          type="checkbox"
          checked={draft.notificationsEnabled}
          onChange={(e) => setDraft((prev) => ({ ...prev, notificationsEnabled: e.target.checked }))}
          className="w-4 h-4"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={onClose}
          className="flex-1 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="flex-1 py-1.5 text-sm text-white bg-gray-800 rounded-lg hover:bg-gray-700"
        >
          Save
        </button>
      </div>
    </div>
  );
}
