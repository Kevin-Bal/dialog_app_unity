/**
 * Petit serveur statique sans dépendance, pour développer en local.
 * Les modules ES exigent un serveur (pas d'ouverture en file://).
 * Lancement : npm run serve   →   http://localhost:4321
 * (port 4321 par défaut ; 8123 entrait en conflit avec le proxy SOCKS du VPN)
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PORT = process.env.PORT || 4321;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    if (path === "/") path = "/index.html";
    // empêche de sortir du dossier du projet
    const file = normalize(join(ROOT, path));
    if (!file.startsWith(ROOT)) {
      res.writeHead(403).end("Forbidden");
      return;
    }
    const data = await readFile(file);
    res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404).end("Not found");
  }
}).listen(PORT, () => {
  console.log(`Éditeur dispo sur http://localhost:${PORT}`);
});
