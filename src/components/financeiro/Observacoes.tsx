import type { Observacao, Tom } from "@/lib/finance/insights";

const ESTILO: Record<Tom, { titulo: string; borda: string; fundo: string; texto: string; ponto: string }> = {
  POSITIVO: {
    titulo: "Positivo",
    borda: "border-emerald-500/30",
    fundo: "bg-emerald-500/[0.07]",
    texto: "text-emerald-300",
    ponto: "bg-emerald-400"
  },
  ATENCAO: {
    titulo: "Ponto de atenção",
    borda: "border-nivel-ouro/35",
    fundo: "bg-nivel-ouro/[0.08]",
    texto: "text-nivel-ouro",
    ponto: "bg-nivel-ouro"
  },
  NEGATIVO: {
    titulo: "Negativo",
    borda: "border-coral/45",
    fundo: "bg-coral/[0.09]",
    texto: "text-coral-300",
    ponto: "bg-coral"
  }
};

/** A leitura do mês em texto: o que está bom, o que vigiar e o que está ruim. */
export function Observacoes({ tom, itens }: { tom: Tom; itens: Observacao[] }) {
  const estilo = ESTILO[tom];

  return (
    <section className={`rounded-2xl border ${estilo.borda} ${estilo.fundo} p-5`}>
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${estilo.ponto}`} aria-hidden />
        <h3 className={`text-sm font-bold uppercase tracking-wider ${estilo.texto}`}>{estilo.titulo}</h3>
        <span className="ml-auto text-xs text-creme-700">{itens.length}</span>
      </div>

      {itens.length === 0 ? (
        <p className="mt-3 text-sm text-creme-700">
          {tom === "NEGATIVO" ? "Nada crítico neste mês." : "Nada a destacar neste mês."}
        </p>
      ) : (
        <ul className="mt-3 space-y-3.5">
          {itens.map((item) => (
            <li key={item.titulo}>
              <p className="text-sm font-semibold text-creme">{item.titulo}</p>
              <p className="mt-0.5 text-sm leading-relaxed text-creme-500">{item.texto}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
