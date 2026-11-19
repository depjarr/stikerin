import { makeCanvas } from './sticker.js';
import { ensureFonts } from './exporter.js';

// Stiker contoh (digambar pakai canvas) biar user bisa nyobain tanpa foto.
export async function makeSamples() {
  await ensureFonts();
  const out = [];

  // Hati
  {
    const c = makeCanvas(420, 380);
    const x = c.getContext('2d');
    x.fillStyle = '#b3123a';
    x.beginPath();
    x.moveTo(210, 360);
    x.bezierCurveTo(-60, 170, 60, -40, 210, 90);
    x.bezierCurveTo(360, -40, 480, 170, 210, 360);
    x.fill();
    x.fillStyle = '#ffe9ef';
    x.font = '64px "Caprasimo", Georgia, serif';
    x.textAlign = 'center';
    x.fillText('baper', 210, 190);
    x.fillText('club.', 210, 250);
    out.push({ name: 'baper club', cut: c });
  }

  // Pil teks
  {
    const c = makeCanvas(520, 200);
    const x = c.getContext('2d');
    x.fillStyle = '#ffd23f';
    x.beginPath();
    x.roundRect(0, 0, 520, 200, 100);
    x.fill();
    x.fillStyle = '#e63946';
    x.font = '800 92px "Bricolage Grotesque", sans-serif';
    x.textAlign = 'center';
    x.fillText('yippi!', 260, 132);
    out.push({ name: 'yippi', cut: c });
  }

  // Bintang
  {
    const c = makeCanvas(400, 400);
    const x = c.getContext('2d');
    x.fillStyle = '#5b3cc4';
    x.beginPath();
    for (let i = 0; i < 16; i++) {
      const r = i % 2 ? 120 : 200;
      const a = (Math.PI * i) / 8 - Math.PI / 2;
      x.lineTo(200 + Math.cos(a) * r, 200 + Math.sin(a) * r);
    }
    x.closePath();
    x.fill();
    x.fillStyle = '#c8d932';
    x.font = '800 54px "Bricolage Grotesque", sans-serif';
    x.textAlign = 'center';
    x.fillText('NEW', 200, 196);
    x.fillText('ERA', 200, 248);
    out.push({ name: 'new era', cut: c });
  }

  // Name tag
  {
    const c = makeCanvas(460, 300);
    const x = c.getContext('2d');
    x.fillStyle = '#e63946';
    x.beginPath();
    x.roundRect(0, 0, 460, 300, 34);
    x.fill();
    x.fillStyle = '#fff';
    x.fillRect(0, 96, 460, 150);
    x.font = '600 50px "Bricolage Grotesque", sans-serif';
    x.textAlign = 'center';
    x.fillText('Hello, aku', 230, 70);
    x.fillStyle = '#1d1a17';
    x.font = '76px "Caprasimo", Georgia, serif';
    x.fillText('KALCER', 230, 198);
    out.push({ name: 'name tag', cut: c });
  }

  return out;
}
