import { navyText } from "@/lib/design-tokens";

export function CocktailGlass({ shape, color }: { shape: string | null; color: string | null }) {
  const stroke = navyText;
  const fill = color ?? "#E8A33D";

  if (shape === "rocks") {
    return (
      <svg viewBox="0 0 100 140" className="w-full h-full">
        <path d="M30,40 L70,40 L66,112 Q66,116 62,116 L38,116 Q34,116 34,112 Z" fill={fill} stroke={stroke} strokeWidth="2" />
      </svg>
    );
  }
  if (shape === "highball") {
    return (
      <svg viewBox="0 0 100 140" className="w-full h-full">
        <path d="M38,20 L62,20 L60,118 Q60,122 56,122 L44,122 Q40,122 40,118 Z" fill={fill} stroke={stroke} strokeWidth="2" />
      </svg>
    );
  }
  if (shape === "coupe") {
    return (
      <svg viewBox="0 0 100 140" className="w-full h-full">
        <path d="M28,38 C28,55 40,62 50,62 C60,62 72,55 72,38 Z" fill={fill} stroke={stroke} strokeWidth="2" />
        <rect x="48" y="62" width="4" height="35" fill={stroke} />
        <ellipse cx="50" cy="100" rx="18" ry="5" fill="none" stroke={stroke} strokeWidth="2" />
      </svg>
    );
  }
  if (shape === "martini") {
    return (
      <svg viewBox="0 0 100 140" className="w-full h-full">
        <path d="M25,35 L75,35 L50,68 Z" fill={fill} stroke={stroke} strokeWidth="2" />
        <rect x="48" y="68" width="4" height="30" fill={stroke} />
        <ellipse cx="50" cy="100" rx="18" ry="5" fill="none" stroke={stroke} strokeWidth="2" />
      </svg>
    );
  }
  if (shape === "flute") {
    return (
      <svg viewBox="0 0 100 140" className="w-full h-full">
        <path d="M42,25 L58,25 L54,85 L46,85 Z" fill={fill} stroke={stroke} strokeWidth="2" />
        <rect x="48" y="85" width="4" height="15" fill={stroke} />
        <ellipse cx="50" cy="102" rx="14" ry="4" fill="none" stroke={stroke} strokeWidth="2" />
      </svg>
    );
  }
  if (shape === "mug") {
    return (
      <svg viewBox="0 0 100 140" className="w-full h-full">
        <rect x="32" y="30" width="44" height="80" rx="8" fill={fill} stroke={stroke} strokeWidth="2" />
        <path d="M76,45 Q95,45 95,65 Q95,85 76,85" fill="none" stroke={stroke} strokeWidth="4" />
      </svg>
    );
  }
  // balloon (default)
  return (
    <svg viewBox="0 0 100 140" className="w-full h-full">
      <path
        d="M30,45 C30,70 35,80 50,80 C65,80 70,70 70,45 C70,30 60,25 50,25 C40,25 30,30 30,45 Z"
        fill={fill}
        stroke={stroke}
        strokeWidth="2"
      />
      <rect x="48" y="80" width="4" height="20" fill={stroke} />
      <ellipse cx="50" cy="104" rx="16" ry="4" fill="none" stroke={stroke} strokeWidth="2" />
    </svg>
  );
}
