/** Formatação pt-BR usada em todas as telas. Valores nulos aparecem como "—" (sem dado). */
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dec = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const int = new Intl.NumberFormat("pt-BR");

export const SEM_DADO = "—";

export function money(value: number | null | undefined): string {
  return value == null ? SEM_DADO : brl.format(value);
}

/** Versão curta para cartões grandes: R$ 12,4 mil / R$ 1,2 mi. */
export function moneyShort(value: number | null | undefined): string {
  if (value == null) return SEM_DADO;
  if (Math.abs(value) >= 1_000_000) return `R$ ${dec.format(value / 1_000_000)} mi`;
  if (Math.abs(value) >= 10_000) return `R$ ${int.format(Math.round(value / 1000))} mil`;
  return brl.format(value);
}

export function decimal(value: number | null | undefined): string {
  return value == null ? SEM_DADO : dec.format(value);
}

export function integer(value: number | null | undefined): string {
  return value == null ? SEM_DADO : int.format(value);
}

export function percent(value: number | null | undefined): string {
  return value == null ? SEM_DADO : `${int.format(Math.round(value))}%`;
}

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export function monthName(month: number): string {
  return MESES[month - 1] ?? String(month);
}

export function periodLabel(year: number, month: number): string {
  return `${monthName(month)} de ${year}`;
}

/** Primeiro nome, para o cumprimento ("Olá, Mayara"). */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}
