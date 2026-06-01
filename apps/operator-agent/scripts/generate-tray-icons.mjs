/**
 * Gera os ícones de status do tray do Sprint Operator Agent (BL-C3-013).
 *
 * Produz `build/tray-{gray,yellow,red,green}.png` — círculos sólidos
 * coloridos 32×32 (com leve anti-alias na borda), que o Electron Tray
 * reduz para 16/24px conforme o DPI (downscale = sempre nítido).
 *
 * - **cinza**: carregando / conexão desconhecida.
 * - **verde**: conectado e ocioso.
 * - **amarelo**: sprint pendente na fila (cor de atenção da marca).
 * - **vermelho**: sem conexão com a pasta compartilhada OU config inválida.
 *
 * Sem dependências — encoder PNG (RGBA, sem filtro) feito à mão sobre
 * `zlib.deflateSync`. Determinístico e reproduzível em qualquer plataforma.
 * Roda via `pnpm --filter sprint-operator-agent gen:tray-icons`. Os PNGs
 * gerados são commitados (não roda no build/CI). Este script fica em
 * `scripts/` (fora de `build/`) para não entrar no asar empacotado.
 */

import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) === 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) {
    c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(size, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.writeUInt8(8, 8); // bit depth
  ihdr.writeUInt8(6, 9); // color type: RGBA
  ihdr.writeUInt8(0, 10); // compression
  ihdr.writeUInt8(0, 11); // filter method
  ihdr.writeUInt8(0, 12); // interlace
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(size * stride);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0; // filter type: none
    rgba.copy(raw, y * stride + 1, y * size * 4, (y + 1) * size * 4);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function circleRgba(size, [r, g, b]) {
  const buf = Buffer.alloc(size * size * 4);
  const center = (size - 1) / 2;
  const radius = size / 2 - 1.5; // margem p/ não encostar na borda
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - center;
      const dy = y - center;
      const dist = Math.sqrt(dx * dx + dy * dy);
      let alpha = 0;
      if (dist <= radius - 0.5) alpha = 255;
      else if (dist < radius + 0.5) alpha = Math.round(255 * (radius + 0.5 - dist));
      const i = (y * size + x) * 4;
      buf[i] = r;
      buf[i + 1] = g;
      buf[i + 2] = b;
      buf[i + 3] = alpha;
    }
  }
  return buf;
}

const COLORS = {
  gray: [139, 143, 148],
  yellow: [245, 165, 87], // acento quente da marca ARTFLEXÍVEIS
  red: [229, 72, 77],
  green: [46, 160, 67],
};

const SIZE = 32;
const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'build');

for (const [name, rgb] of Object.entries(COLORS)) {
  const png = encodePng(SIZE, circleRgba(SIZE, rgb));
  const file = path.join(outDir, `tray-${name}.png`);
  writeFileSync(file, png);
  console.log(`wrote ${file} (${png.length} bytes)`);
}
