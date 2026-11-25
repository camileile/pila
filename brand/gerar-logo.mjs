// Gera todos os SVGs da marca Pila a partir de uma geometria única.
// Uso: node brand/gerar-logo.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const COR = { azul: '#0131CD', branco: '#FFFFFF', limao: '#B9FC01', preto: '#14171C' };

const n = (v) => +v.toFixed(2);

// ---------- primitivas ----------
const circulo = (cx, cy, r) =>
  `M${n(cx + r)} ${n(cy)}A${n(r)} ${n(r)} 0 1 0 ${n(cx - r)} ${n(cy)}A${n(r)} ${n(r)} 0 1 0 ${n(cx + r)} ${n(cy)}Z`;

const retArred = (x, y, w, h, k) =>
  `M${n(x + k)} ${n(y)}H${n(x + w - k)}A${k} ${k} 0 0 1 ${n(x + w)} ${n(y + k)}` +
  `V${n(y + h - k)}A${k} ${k} 0 0 1 ${n(x + w - k)} ${n(y + h)}H${n(x + k)}` +
  `A${k} ${k} 0 0 1 ${n(x)} ${n(y + h - k)}V${n(y + k)}A${k} ${k} 0 0 1 ${n(x + k)} ${n(y)}Z`;

// "p": bojo circular + haste à esquerda descendo do centro do bojo.
function letraP({ cx, cy, R, s, desc, k, cr, off }) {
  const x0 = cx - R, xs = cx - R + s, base = cy + desc;
  const yi = cy + Math.sqrt(R * R - (R - s) ** 2);
  const contorno =
    `M${n(x0)} ${n(cy)}A${R} ${R} 0 1 1 ${n(xs)} ${n(yi)}` +
    `V${n(base - k)}A${k} ${k} 0 0 1 ${n(xs - k)} ${n(base)}` +
    `H${n(x0 + k)}A${k} ${k} 0 0 1 ${n(x0)} ${n(base - k)}Z`;
  return { contorno, miolo: circulo(cx + off, cy, cr) };
}

// "a": bojo circular + haste à direita que passa um pouco do bojo (d).
// Topo reto do alto do bojo até a haste; embaixo, o bojo encontra a haste formando o "dente" do a.
function letraA({ cx, cy, R, s, d, kt, kb, kd, cr }) {
  const xs = cx + R - s + d, xr = cx + R + d, base = cy + R;
  const yi = cy + Math.sqrt(R * R - (xs - cx) ** 2);
  const contorno =
    `M${n(cx)} ${n(cy - R)}H${n(xr - kt)}A${kt} ${kt} 0 0 1 ${n(xr)} ${n(cy - R + kt)}` +
    `V${n(base - kb)}A${kb} ${kb} 0 0 1 ${n(xr - kb)} ${n(base)}` +
    `H${n(xs + kd)}A${kd} ${kd} 0 0 1 ${n(xs)} ${n(base - kd)}V${n(yi)}` +
    `A${R} ${R} 0 1 1 ${n(cx)} ${n(cy - R)}Z`;
  return { contorno, miolo: circulo(cx, cy, cr) };
}

// ---------- símbolo (grade 512) ----------
const SIMB = 512;
const simbP = letraP({ cx: 231, cy: 266, R: 123, s: 73, desc: 178, k: 20, cr: 46, off: 0 });
const simbPonto = circulo(358, 117, 46);
const simbQuadro = retArred(0, 0, SIMB, SIMB, 136);

function simbolo(variante, { quadro = simbQuadro } = {}) {
  if (variante === 'cor' || variante === 'negativo') {
    const fundo = variante === 'cor' ? COR.azul : COR.branco;
    const letra = variante === 'cor' ? COR.branco : COR.azul;
    return (
      `<path fill="${fundo}" d="${quadro}"/>` +
      `<path fill="${letra}" fill-rule="evenodd" d="${simbP.contorno}${simbP.miolo}"/>` +
      `<path fill="${COR.limao}" d="${simbPonto}"/>`
    );
  }
  // monocromático: p e ponto vazados no quadrado (um único path, evenodd)
  const tinta = variante === 'preto' ? COR.preto : COR.branco;
  return `<path fill="${tinta}" fill-rule="evenodd" d="${quadro}${simbP.contorno}${simbP.miolo}${simbPonto}"/>`;
}

// ---------- assinatura "pila." (linha de base y=74, centro do bojo y=0) ----------
const R = 74, S = 44, K = 14;
const asP = letraP({ cx: 74, cy: 0, R, s: S, desc: 118, k: K, cr: 30, off: 0 });
const asI = retArred(178, -R, S, 2 * R, K);
const asIPingo = circulo(200, -111, 27);
const asL = retArred(244, -148, S, 148 + R, K);
const asA = letraA({ cx: 384, cy: 0, R, s: S, d: 10, kt: 18, kb: 14, kd: 6, cr: 30 });
const asPonto = circulo(509, 47, 27);
const AS = { x: 0, y: -148, w: 536, h: 266 }; // caixa da assinatura

function assinatura(variante) {
  const letras = `${asP.contorno}${asP.miolo}${asI}${asL}${asA.contorno}${asA.miolo}`;
  const tinta = { cor: COR.azul, negativo: COR.branco, preto: COR.preto, branco: COR.branco }[variante];
  const pontos = variante === 'cor' || variante === 'negativo' ? COR.limao : tinta;
  return (
    `<path fill="${tinta}" fill-rule="evenodd" d="${letras}"/>` +
    `<path fill="${pontos}" d="${asIPingo}${asPonto}"/>`
  );
}

// ---------- composições ----------
const svg = (w, h, corpo, titulo) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n(w)} ${n(h)}" role="img" aria-label="${titulo}">` +
  `<title>${titulo}</title>${corpo}</svg>\n`;

const g = (tx, ty, esc, corpo) =>
  `<g transform="translate(${n(tx)} ${n(ty)}) scale(${n(esc * 10000) / 10000})">${corpo}</g>`;

function horizontal(v) {
  const H = 333, gap = 43, esc = H / SIMB;
  const tyAs = H / 2 - (AS.y + AS.h / 2);
  return svg(H + gap + AS.w, H, g(0, 0, esc, simbolo(v)) + g(H + gap, tyAs, 1, assinatura(v)), 'Pila');
}

function vertical(v) {
  const H = 300, gap = 60, esc = H / SIMB;
  return svg(AS.w, H + gap + AS.h,
    g((AS.w - H) / 2, 0, esc, simbolo(v)) + g(0, H + gap - AS.y, 1, assinatura(v)), 'Pila');
}

const soSimbolo = (v) => svg(SIMB, SIMB, simbolo(v), 'Pila');
const soAssinatura = (v) => svg(AS.w, AS.h, g(0, -AS.y, 1, assinatura(v)), 'Pila');

// Ícone maskable/Apple: quadro sem cantos (o sistema recorta) e símbolo reduzido para a zona segura.
function iconeCheio() {
  const esc = 0.8, d = (SIMB * (1 - esc)) / 2;
  const corpo =
    `<rect width="${SIMB}" height="${SIMB}" fill="${COR.azul}"/>` +
    g(d, d, esc, simbolo('cor', { quadro: '' }).replace(/<path fill="#0131CD" d=""\/>/, ''));
  return svg(SIMB, SIMB, corpo, 'Pila');
}

// ---------- gravação ----------
const arquivos = {};
for (const v of ['cor', 'negativo', 'preto', 'branco']) {
  arquivos[`logo/pila-horizontal-${v}.svg`] = horizontal(v);
  arquivos[`logo/pila-vertical-${v}.svg`] = vertical(v);
  arquivos[`logo/pila-simbolo-${v}.svg`] = soSimbolo(v);
  arquivos[`logo/pila-assinatura-${v}.svg`] = soAssinatura(v);
}
arquivos['icones/favicon.svg'] = soSimbolo('cor');
arquivos['icones/icone-maskable.svg'] = iconeCheio();

for (const [rel, conteudo] of Object.entries(arquivos)) {
  const destino = join(AQUI, rel);
  mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, conteudo);
}
console.log(`${Object.keys(arquivos).length} arquivos gerados em ${AQUI}`);
