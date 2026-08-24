/**
 * Monta os icones do app a partir do logotipo.
 *
 * O logotipo e horizontal e transparente; o icone precisa ser quadrado e ter
 * fundo, senao no Android ele aparece recortado dentro de um circulo branco.
 * O fundo usa o terracota da marca.
 *
 *   npx tsx scripts/gerarIcones.ts
 */
import * as fs from "fs";
import { PNG } from "pngjs";

const FUNDO = { r: 0x16, g: 0x0f, b: 0x0d }; // base escura do painel
const ORIGEM = "/tmp/logo-icone.png";

function compor(tamanho: number, ocupacao: number, destino: string) {
  const logo = PNG.sync.read(fs.readFileSync(ORIGEM));
  const out = new PNG({ width: tamanho, height: tamanho });

  for (let y = 0; y < tamanho; y++) {
    for (let x = 0; x < tamanho; x++) {
      const i = (tamanho * y + x) << 2;
      out.data[i] = FUNDO.r;
      out.data[i + 1] = FUNDO.g;
      out.data[i + 2] = FUNDO.b;
      out.data[i + 3] = 255;
    }
  }

  // Escala por vizinho mais proximo: o logotipo e tracado limpo, entao nao
  // perde qualidade visivel nesses tamanhos.
  const larguraAlvo = Math.round(tamanho * ocupacao);
  const alturaAlvo = Math.round((larguraAlvo * logo.height) / logo.width);
  const offsetX = Math.round((tamanho - larguraAlvo) / 2);
  const offsetY = Math.round((tamanho - alturaAlvo) / 2);

  for (let y = 0; y < alturaAlvo; y++) {
    for (let x = 0; x < larguraAlvo; x++) {
      const sx = Math.min(logo.width - 1, Math.floor((x * logo.width) / larguraAlvo));
      const sy = Math.min(logo.height - 1, Math.floor((y * logo.height) / alturaAlvo));
      const s = (logo.width * sy + sx) << 2;
      const alpha = logo.data[s + 3] / 255;
      if (alpha === 0) continue;

      const d = (tamanho * (y + offsetY) + (x + offsetX)) << 2;
      for (let canal = 0; canal < 3; canal++) {
        out.data[d + canal] = Math.round(logo.data[s + canal] * alpha + out.data[d + canal] * (1 - alpha));
      }
    }
  }

  fs.writeFileSync(destino, PNG.sync.write(out));
  console.log(`${destino}: ${tamanho}x${tamanho}`);
}

// O icone "maskable" do Android e recortado nas bordas, entao o logo ocupa menos.
compor(192, 0.78, "public/icone-192.png");
compor(512, 0.78, "public/icone-512.png");
compor(512, 0.58, "public/icone-maskable.png");
compor(180, 0.78, "public/apple-touch-icon.png");
