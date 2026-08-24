/**
 * Icone do ambiente de demonstracao.
 *
 * Nao usa o logotipo da Mari Boutique (a demo nao carrega a marca da loja) e
 * nao da para escrever "Painel360 Demo" dentro de um icone pequeno sem virar
 * borrao. O simbolo e um anel -- a volta completa, 360 graus -- em branco sobre
 * azul, e o nome aparece embaixo do icone, vindo do manifesto.
 *
 *   npx tsx scripts/gerarIconeDemo.ts
 */
import * as fs from "fs";
import { PNG } from "pngjs";

const FUNDO = { r: 0x09, g: 0x0c, b: 0x11 };
const ANEL = { r: 0x4f, g: 0x8f, b: 0xf7 };
const MARCA = { r: 0xf8, g: 0xfa, b: 0xfc };

function gerar(tamanho: number, ocupacao: number, destino: string) {
  const png = new PNG({ width: tamanho, height: tamanho });
  const centro = tamanho / 2;
  const raio = (tamanho * ocupacao) / 2;
  const espessura = tamanho * 0.085;

  for (let y = 0; y < tamanho; y++) {
    for (let x = 0; x < tamanho; x++) {
      const i = (tamanho * y + x) << 2;
      png.data[i] = FUNDO.r;
      png.data[i + 1] = FUNDO.g;
      png.data[i + 2] = FUNDO.b;
      png.data[i + 3] = 255;

      const dx = x - centro;
      const dy = y - centro;
      const distancia = Math.sqrt(dx * dx + dy * dy);
      const distanciaDaBorda = Math.abs(distancia - raio);

      // Abertura no topo, como o ponteiro de um mostrador: sem ela o anel
      // vira só um círculo e não sugere movimento.
      const angulo = Math.atan2(dy, dx);
      const noVao = angulo < -Math.PI / 2 - 0.34 || angulo > -Math.PI / 2 + 0.34 ? false : true;
      if (noVao) continue;

      if (distanciaDaBorda <= espessura / 2) {
        // Suaviza a borda para o anel não sair serrilhado.
        const suave = Math.max(0, Math.min(1, (espessura / 2 - distanciaDaBorda) / 1.6));
        const cor = distancia < raio ? ANEL : MARCA;
        for (let canal = 0; canal < 3; canal++) {
          const valor = canal === 0 ? cor.r : canal === 1 ? cor.g : cor.b;
          const fundo = canal === 0 ? FUNDO.r : canal === 1 ? FUNDO.g : FUNDO.b;
          png.data[i + canal] = Math.round(valor * suave + fundo * (1 - suave));
        }
      }
    }
  }

  fs.writeFileSync(destino, PNG.sync.write(png));
  console.log(`${destino}: ${tamanho}x${tamanho}`);
}

gerar(192, 0.62, "public/icone-demo-192.png");
gerar(512, 0.62, "public/icone-demo-512.png");
gerar(512, 0.46, "public/icone-demo-maskable.png");
gerar(180, 0.62, "public/apple-touch-icon-demo.png");
