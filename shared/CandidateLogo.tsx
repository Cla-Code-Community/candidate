interface CandidateLogoProps {
  size?: "sm" | "md";
}

const SIZE = {
  sm: {
    text: "text-xl",
    symbol: "text-base",
    dot: "text-xs",
  },
  md: {
    text: "text-2xl",
    symbol: "text-lg",
    dot: "text-sm",
  },
};

export function CandidateLogo({ size = "md" }: CandidateLogoProps) {
  return (
    <span
      aria-label="Cand!Date!"
      className="inline-flex items-baseline whitespace-nowrap font-black tracking-tight leading-none"
    >
      <span className={`${SIZE[size].symbol} text-[#3B82F6]`}>&lt;</span>

      <span className={`${SIZE[size].text} text-black dark:text-[#EEF2F6]`}>
        Cand
      </span>

      <span className={`${SIZE[size].text} text-[#F59E0B]`}>!</span>

      <span className={`${SIZE[size].text} text-black dark:text-[#EEF2F6]`}>
        Date
      </span>

      <span className={`${SIZE[size].text} text-[#A855F7]`}>!</span>

      <span className={`${SIZE[size].text} text-[#3B82F6]`}>&gt;</span>
    </span>
  );
}
