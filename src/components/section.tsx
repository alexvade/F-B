import { navyText, orange, inkSoft } from "@/lib/design-tokens";

export function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <h1
        className="text-lg font-semibold mb-1 inline-block pb-1"
        style={{ color: navyText, borderBottom: `3px solid ${orange}` }}
      >
        {title}
      </h1>
      {subtitle && (
        <p className="text-sm mb-6 mt-2" style={{ color: inkSoft }}>
          {subtitle}
        </p>
      )}
      {children}
    </div>
  );
}
