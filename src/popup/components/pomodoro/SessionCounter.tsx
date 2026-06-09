interface Props {
  completedToday: number;
}

export default function SessionCounter({ completedToday }: Props) {
  return (
    <div className="flex items-center justify-center gap-1.5 pb-3 text-sm text-gray-500">
      <span>Today:</span>
      <span className="font-semibold text-gray-700">{completedToday}</span>
      <span>{completedToday === 1 ? "Pomodoro" : "Pomodoros"}</span>
    </div>
  );
}
