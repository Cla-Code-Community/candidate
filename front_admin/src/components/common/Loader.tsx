interface LoaderProps {
  text?: string;
  size?: "sm" | "md" | "lg";
}

export const Loader: React.FC<LoaderProps> = ({
  text = "Carregando...",
  size = "md",
}) => {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-8 w-8",
  };

  return (
    <div className="flex items-center gap-2">
      <svg
        className={`animate-spin ${sizeClasses[size]} text-white`}
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      <span>{text}</span>
    </div>
  );
};
