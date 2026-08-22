/**
 * Roda o leitor contra uma planilha real e compara o resultado com os números
 * que a propria planilha ja calcula (Total Mes, SALAO, ONLINE, TKM, PA).
 *   npx tsx scripts/conferirPlanilha.ts "caminho/ARQUIVO.xlsx"
 */
import * as fs from "fs";
import * as path from "path";
import { parseMonthWorkbook } from "../src/lib/xlsx/parseMonthWorkbook";

const arquivo = process.argv[2];
const parsed = parseMonthWorkbook(fs.readFileSync(arquivo), path.basename(arquivo));

const brl = (n: number | null) =>
  n == null ? "sem dado" : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

console.log(`\n### ${path.basename(arquivo)}`);
console.log(`mes detectado: ${parsed.month}/${parsed.year}`);
console.log(`abas ignoradas: ${parsed.ignoredSheets.join(", ") || "(nenhuma)"}`);

for (const s of [parsed.store, ...parsed.sellers].filter(Boolean)) {
  const sheet = s!;
  console.log(
    `\n${sheet.sheetName.padEnd(16)} ${brl(sheet.revenue).padStart(14)} | ${String(sheet.salesCount).padStart(4)} vendas | ${String(sheet.pieces).padStart(4)} pecas | PA ${sheet.pa?.toFixed(2) ?? "-"} | TKM ${brl(sheet.tkm)}`
  );
  console.log(
    `${"".padEnd(16)} salao ${brl(sheet.salao)} | online ${brl(sheet.online)} | projecao ${brl(sheet.projection)} | dias ${sheet.workedDays}/${sheet.workingDays}`
  );
  console.log(
    `${"".padEnd(16)} dias com lancamento: ${sheet.days.filter((d) => (d.revenue ?? 0) > 0).length} | metas: ${sheet.goals.map((g) => `${g.level}=${brl(g.target)}`).join(", ") || "(nenhuma)"}`
  );
}

if (parsed.warnings.length) {
  console.log("\navisos:");
  for (const w of parsed.warnings) console.log(" -", w);
}
