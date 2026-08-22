/**
 * Roda o leitor da planilha financeira e mostra o que foi extraido, para
 * conferencia contra o arquivo antes de importar.
 *   npx tsx scripts/conferirDespesas.ts "caminho/DESPESAS 2026.xlsx"
 */
import * as fs from "fs";
import * as path from "path";
import { parseExpensesWorkbook } from "../src/lib/xlsx/parseExpensesWorkbook";

const arquivo = process.argv[2];
const p = parseExpensesWorkbook(fs.readFileSync(arquivo), path.basename(arquivo));
const brl = (n: number | null) =>
  n == null ? "sem dado" : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

console.log(`\n### ${path.basename(arquivo)}  |  ano: ${p.year}`);
console.log(`abas ignoradas: ${p.ignoredSheets.join(", ")}\n`);
console.log("MES  LANC.        DESPESAS        FATURAMENTO          LUCRO   MARGEM");
for (const m of p.months) {
  const fat = m.grossRevenue;
  const lucro = fat == null ? null : fat - m.total;
  const margem = fat && lucro != null ? `${((lucro / fat) * 100).toFixed(1)}%` : "-";
  console.log(
    `${String(m.month).padStart(3)} ${String(m.expenses.length).padStart(5)} ${brl(m.total).padStart(15)} ${brl(fat).padStart(18)} ${brl(lucro).padStart(15)} ${margem.padStart(8)}`
  );
}
const porGrupo = new Map<string, number>();
for (const m of p.months) for (const e of m.expenses) porGrupo.set(e.group, (porGrupo.get(e.group) ?? 0) + e.amount);
console.log("\npor grupo (ano):");
for (const [g, v] of Array.from(porGrupo.entries()).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${g.padEnd(30)} ${brl(v).padStart(15)}`);
}
if (p.warnings.length) { console.log("\navisos:"); for (const w of p.warnings) console.log(" -", w); }
