import Link from "next/link";

const sizes = {
  xs: { mark: "size-8 rounded-lg", text: "text-sm" },
  sm: { mark: "size-9 rounded-lg", text: "text-sm" },
  md: { mark: "size-10 rounded-xl", text: "text-sm" },
} as const;

export function Brand({
  href = "/",
  subtitle = "SHORT DRAMAS",
  size = "md",
  className = "",
  onClick,
}: {
  href?: string;
  subtitle?: string;
  size?: keyof typeof sizes;
  className?: string;
  onClick?: () => void;
}) {
  const scale = sizes[size];
  return (
    <Link
      className={`flex items-center gap-3 font-extrabold tracking-widest text-neutral-50 ${scale.text} ${className}`.trim()}
      href={href}
      aria-label={subtitle ? `Timeless: ${subtitle}` : "Timeless home"}
      onClick={onClick}
    >
      <img className={scale.mark} src="/timeless-icon.png" alt="" width={40} height={40} />
      <span className="grid gap-0.5">
        TIMELESS
        {subtitle ? <small className="font-mono text-xs tracking-widest text-rose-400">{subtitle}</small> : null}
      </span>
    </Link>
  );
}
