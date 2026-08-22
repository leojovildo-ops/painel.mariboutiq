export function ProgressBar({
  value,
  size = "md",
  tone = "coral"
}: {
  /** 0-100. */
  value: number;
  size?: "sm" | "md" | "lg";
  tone?: "coral" | "prata" | "ouro" | "diamante";
}) {
  const height = size === "lg" ? "h-4" : size === "sm" ? "h-1.5" : "h-2.5";
  const fill = {
    coral: "bg-gradient-to-r from-terracota to-coral",
    prata: "bg-gradient-to-r from-creme-700 to-nivel-prata",
    ouro: "bg-gradient-to-r from-terracota-400 to-nivel-ouro",
    diamante: "bg-gradient-to-r from-coral to-nivel-diamante"
  }[tone];

  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div
      className={`${height} w-full overflow-hidden rounded-full bg-base-700`}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className={`${height} ${fill} rounded-full transition-[width] duration-700`} style={{ width: `${clamped}%` }} />
    </div>
  );
}
