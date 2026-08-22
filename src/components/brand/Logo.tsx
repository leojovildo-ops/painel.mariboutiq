/** Marca Mari Boutique: monograma "MB" em coral sobre terracota. */
export function Logo({ size = 44 }: { size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-terracota to-coral font-display font-bold text-base shadow-glow"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      aria-hidden
    >
      MB
    </span>
  );
}

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-3">
      <Logo size={compact ? 36 : 44} />
      <span className="leading-tight">
        <span className="block font-display text-lg font-bold tracking-tight text-creme">
          Painel Mariboutique <span className="text-coral">360</span>
        </span>
        <span className="label block">Mari Boutique</span>
      </span>
    </span>
  );
}
