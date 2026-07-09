interface ProgressCircleProps {
  value: number;
  color: string;
  size?: number;
  strokeWidth?: number;
  label?: string;
}

/**
 * Círculo de progresso usado nos widgets de uso de recursos (CPU, memória, disco).
 */
export function ProgressCircle({
  value,
  color,
  size = 80,
  strokeWidth = 5.5,
  label,
}: ProgressCircleProps) {
  const radius = size / 2 - strokeWidth * 1.5;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - value / 100);

  return (
    <div className="flex flex-col items-center">
      <div
        className="relative flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <svg width={size} height={size} className="transform -rotate-90">
          <circle
            cx={center}
            cy={center}
            r={radius}
            stroke="#e2e8f0"
            strokeWidth={strokeWidth}
            fill="none"
          />
          <circle
            cx={center}
            cy={center}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </svg>
        <span className="absolute text-sm font-extrabold text-slate-800 dark:text-slate-100">
          {value}%
        </span>
      </div>
      {label && (
        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-2">
          {label}
        </span>
      )}
    </div>
  );
}
