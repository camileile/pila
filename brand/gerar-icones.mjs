// Gera os ícones PNG do PWA a partir dos SVGs da marca.
// Uso: npm run icones   (rode antes `npm run logo` se mudar a logo)
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const AQUI = dirname(fileURLToPath(import.meta.url));
const PUBLICO = join(AQUI, '..', 'public');
const icones = join(PUBLICO, 'icons');
mkdirSync(icones, { recursive: true });

const simbolo = join(AQUI, 'icones', 'favicon.svg');
const cheio = join(AQUI, 'icones', 'icone-maskable.svg');

const saidas = [
  [simbolo, 'icon-192.png', 192],
  [simbolo, 'icon-512.png', 512],
  [cheio, 'maskable-512.png', 512],
  [cheio, 'apple-touch-icon.png', 180],
];

for (const [origem, nome, tamanho] of saidas) {
  await sharp(origem, { density: 300 }).resize(tamanho, tamanho).png().toFile(join(icones, nome));
}
copyFileSync(simbolo, join(PUBLICO, 'favicon.svg'));
mkdirSync(join(PUBLICO, 'logo'), { recursive: true });
copyFileSync(join(AQUI, 'logo', 'pila-horizontal-cor.svg'), join(PUBLICO, 'logo', 'pila-horizontal-cor.svg'));
console.log(`${saidas.length} ícones gerados em public/icons`);
