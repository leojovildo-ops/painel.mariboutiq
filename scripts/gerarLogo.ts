/**
 * Gera a versao clara da logo a partir da variacao preta do kit da marca.
 *
 * A logo original e preta sobre branco: no fundo escuro do painel, a palavra
 * "boutique" sumiria. Este script troca o preto por creme mantendo o
 * antialiasing (a opacidade de cada pixel vem da luminancia do original),
 * deixa o fundo transparente e recorta as margens vazias.
 *
 *   npx tsx scripts/gerarLogo.ts <origem.png> <destino.png> [#RRGGBB]
 */
import * as fs from "fs";
import { PNG } from "pngjs";

const [origem, destino, corHex = "#F6EBE1"] = process.argv.slice(2);
const cor = {
  r: parseInt(corHex.slice(1, 3), 16),
  g: parseInt(corHex.slice(3, 5), 16),
  b: parseInt(corHex.slice(5, 7), 16)
};

const src = PNG.sync.read(fs.readFileSync(origem));

// Passada 1: opacidade de cada pixel e limites do desenho.
const alpha = new Uint8Array(src.width * src.height);
let minX = src.width, minY = src.height, maxX = -1, maxY = -1;

for (let y = 0; y < src.height; y++) {
  for (let x = 0; x < src.width; x++) {
    const i = (src.width * y + x) << 2;
    const a0 = src.data[i + 3];
    // Luminancia perceptual: quanto mais escuro, mais opaco fica na versao clara.
    const lum = (0.2126 * src.data[i] + 0.7152 * src.data[i + 1] + 0.0722 * src.data[i + 2]) / 255;
    const op = Math.round((1 - lum) * (a0 / 255) * 255);
    alpha[src.width * y + x] = op;
    if (op > 8) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
}

if (maxX < 0) throw new Error("A imagem de origem parece vazia.");

const margem = 4;
minX = Math.max(0, minX - margem);
minY = Math.max(0, minY - margem);
maxX = Math.min(src.width - 1, maxX + margem);
maxY = Math.min(src.height - 1, maxY + margem);

const out = new PNG({ width: maxX - minX + 1, height: maxY - minY + 1 });
for (let y = 0; y < out.height; y++) {
  for (let x = 0; x < out.width; x++) {
    const o = (out.width * y + x) << 2;
    out.data[o] = cor.r;
    out.data[o + 1] = cor.g;
    out.data[o + 2] = cor.b;
    out.data[o + 3] = alpha[src.width * (y + minY) + (x + minX)];
  }
}

fs.writeFileSync(destino, PNG.sync.write(out));
console.log(`${destino}: ${out.width}x${out.height} (recortado de ${src.width}x${src.height}), cor ${corHex}`);
