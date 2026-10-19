// What the screens on the desk show (SPEC: Arnav is an AI engineer): code, a loss curve, a terminal. Drawn on canvases in the
// room's colours (never an image), then lit as emissive surfaces. The code is original and generic.
import { CanvasTexture, Color, SRGBColorSpace } from 'three';
import type { Palette } from './palette';
import { canvas, seeded } from './textures';

export type ScreenKind = 'editor' | 'terminal' | 'chart';

const css = (c: Color): string => `#${c.getHexString()}`;
const MONO = '"JetBrains Mono", ui-monospace, monospace';

const CODE = [
  ['def', ' forward', '(self, x):'],
  ['  h = ', 'self', '.embed(x)'],
  ['  for ', 'blk', ' in self.blocks:'],
  ['    h = ', 'blk', '(h)  # attn + ffn'],
  ['  return ', 'softmax', '(self.head(h))'],
  [''],
  ['async def', ' answer', '(q: str):'],
  ['  ctx = ', 'await', ' retrieve(q, k=5)'],
  ['  return ', 'await', ' llm.stream(q, ctx)'],
  [''],
  ['# ECE 0.169 -> 0.011'],
  ['model', '.calibrate', '(temperature=1.4)'],
];

/** Draws one screen. 16:10, 1024 × 640. */
export function createScreen(
  kind: ScreenKind,
  palette: Palette,
): { texture: CanvasTexture; redraw: () => void } {
  const [cv, ctx] = canvas(1024, 640);
  const texture = new CanvasTexture(cv);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  const screen = css(palette.screen);
  const ink = css(palette.paper);
  const amber = css(palette.time);
  const cyan = css(palette.holo);
  const dim = `${ink}66`;
  const redraw = (): void => {
    ctx.fillStyle = screen;
    ctx.fillRect(0, 0, 1024, 640);
    ctx.textBaseline = 'alphabetic';
    if (kind === 'editor') {
      ctx.fillStyle = `${ink}14`;
      ctx.fillRect(0, 0, 1024, 44);
      for (const [i, x] of [0, 1, 2].entries()) {
        ctx.fillStyle = i === 0 ? amber : dim;
        ctx.beginPath();
        ctx.arc(26 + x * 26, 22, 7, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.font = `500 13px ${MONO}`;
      ctx.fillStyle = dim;
      ctx.fillText('model.py', 440, 27);
      ctx.font = `500 27px ${MONO}`;
      CODE.forEach((line, i) => {
        const y = 104 + i * 40;
        ctx.fillStyle = dim;
        ctx.font = `500 18px ${MONO}`;
        ctx.fillText(String(i + 1).padStart(2, ' '), 28, y);
        ctx.font = `500 27px ${MONO}`;
        let x = 84;
        line.forEach((part, j) => {
          ctx.fillStyle = line.length === 1 ? dim : j % 2 === 1 ? amber : ink;
          if (part.includes('self') || part.includes('await') || part.includes('def'))
            ctx.fillStyle = cyan;
          ctx.fillText(part, x, y);
          x += ctx.measureText(part).width;
        });
      });
    } else if (kind === 'terminal') {
      ctx.font = `500 26px ${MONO}`;
      const lines = [
        ['$ python train.py --epochs 40', ink],
        ['epoch 38  loss 0.214  val 0.231', dim],
        ['epoch 39  loss 0.209  val 0.228', dim],
        ['epoch 40  loss 0.205  val 0.226', dim],
        ['saved  checkpoints/best.pt', cyan],
        ['', ink],
        ['$ pnpm kb:build', ink],
        ['embedding 214 chunks ........ ok', dim],
        ['[ OK ] rag.sys', amber],
        ['[ !! ] chai.sys ... low', amber],
        ['', ink],
        ['$ ▌', ink],
      ] as const;
      lines.forEach(([t, col], i) => {
        ctx.fillStyle = col;
        ctx.fillText(t, 36, 70 + i * 46);
      });
    } else {
      const rand = seeded(5);
      ctx.strokeStyle = `${ink}22`;
      ctx.lineWidth = 1;
      for (let i = 0; i <= 8; i++) {
        ctx.beginPath();
        ctx.moveTo(80, 80 + i * 60);
        ctx.lineTo(960, 80 + i * 60);
        ctx.stroke();
      }
      ctx.lineWidth = 5;
      for (const [col, base] of [
        [amber, 0],
        [cyan, 36],
      ] as const) {
        ctx.strokeStyle = col;
        ctx.beginPath();
        for (let x = 0; x <= 880; x += 8) {
          const y = 120 + base + 360 * (1 - Math.exp(-x / 260)) * 0.82 + (rand() - 0.5) * 8;
          if (x === 0) ctx.moveTo(80 + x, y);
          else ctx.lineTo(80 + x, y);
        }
        ctx.stroke();
      }
      ctx.font = `500 22px ${MONO}`;
      ctx.fillStyle = ink;
      ctx.fillText('train / val loss', 80, 56);
    }
    texture.needsUpdate = true;
  };
  redraw();
  return { texture, redraw };
}
