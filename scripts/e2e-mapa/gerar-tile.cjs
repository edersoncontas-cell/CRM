// Azulejo "parecido com o OpenStreetMap": bege, matas, rios, estradas e NOMES de cidade — o que
// aparecia por baixo da cor antes de o preenchimento ficar opaco. (Pillow deste ambiente está quebrado.)
const { chromium } = require("playwright");
const fs = require("fs");
const OUT = process.env.E2E_OUT || "/tmp/mapa-e2e/";
const CHROMIUM = process.env.CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch({ executablePath: CHROMIUM });
  const p = await b.newPage();
  const url = await p.evaluate(() => {
    let s = 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d");
    g.fillStyle = "#f2efe9"; g.fillRect(0, 0, 256, 256);
    g.fillStyle = "#c8dfb7"; for (let i = 0; i < 5; i++) g.fillRect(r() * 200, r() * 200, 30 + r() * 60, 20 + r() * 50);
    g.strokeStyle = "#aad3df"; g.lineWidth = 3; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(r() * 256, 0); g.quadraticCurveTo(r() * 256, 90, r() * 256, 256); g.stroke(); }
    for (let i = 0; i < 9; i++) { g.strokeStyle = "#fcd6a4"; g.lineWidth = 4; g.beginPath(); g.moveTo(r() * 256, r() * 256); g.lineTo(r() * 256, r() * 256); g.lineTo(r() * 256, r() * 256); g.stroke(); g.strokeStyle = "#fff"; g.lineWidth = 2; g.stroke(); }
    g.strokeStyle = "#fff"; g.lineWidth = 1; for (let i = 0; i < 14; i++) { g.beginPath(); g.moveTo(r() * 256, r() * 256); g.lineTo(r() * 256, r() * 256); g.stroke(); }
    g.fillStyle = "#606060"; g.font = "11px sans-serif";
    for (const [t, x, y] of [["Cachoeiro de Itapemirim", 20, 40], ["Domingos Martins", 60, 120], ["Ibitirama", 10, 200], ["Santa Teresa", 130, 20], ["Iúna", 150, 170], ["Guarapari", 90, 80]]) g.fillText(t, x, y);
    g.strokeStyle = "#e1dcd4"; g.strokeRect(0.5, 0.5, 255, 255);
    return c.toDataURL("image/png");
  });
  fs.writeFileSync(OUT + "tile-osm.png", Buffer.from(url.split(",")[1], "base64"));
  await b.close(); console.log("tile ok", fs.statSync(OUT + "tile-osm.png").size, "bytes");
})();
