/* Suivi des notes CM2 – IEF Tivaouane : ouverture sans réseau.
   Les données (notes, élèves) ne sont JAMAIS mises en mémoire ici : elles viennent toujours de Supabase.
   Pour désactiver : supprimer ce fichier sur GitHub (ou le remplacer par un script qui se désinscrit). */
const C = "suivi-notes-v1";
const INDEX = new URL("index.html", self.registration.scope).href;
const LOCAL = ["manifest.json", "icon-192.png", "icon-512.png"];
const CDN = [
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/dist/umd/supabase.js",
  "https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"
];

self.addEventListener("install", e => {
  e.waitUntil((async () => {
    const c = await caches.open(C);
    await Promise.allSettled([
      c.add(new Request(INDEX, { cache: "reload" })),
      ...LOCAL.map(u => c.add(u)),
      ...CDN.map(async u => { const r = await fetch(u, { mode: "cors" }); if (r.ok) await c.put(u, r); })
    ]);
    self.skipWaiting();
  })());
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== C) await caches.delete(k);
    await self.clients.claim();
  })());
});

/* Page : réseau d'abord (nouvelle version toujours prioritaire), copie locale seulement si pas de réseau */
async function page(req) {
  const c = await caches.open(C);
  try {
    const n = await Promise.race([fetch(req), new Promise((_, no) => setTimeout(no, 7000))]);
    if (n.ok && !n.redirected) c.put(INDEX, n.clone());
    return n;
  } catch (_) {
    return (await c.match(INDEX)) || Response.error();
  }
}
async function netFirst(req) {
  const c = await caches.open(C);
  try {
    const n = await fetch(req);
    if (n.ok) c.put(req, n.clone());
    return n;
  } catch (_) {
    return (await c.match(req)) || Response.error();
  }
}
/* Bibliothèques (versions fixées) : copie locale d'abord */
async function cdn(req) {
  const c = await caches.open(C);
  const m = await c.match(req.url);
  if (m) return m;
  try {
    const n = await fetch(req.url, { mode: "cors" });
    if (n.ok) c.put(req.url, n.clone());
    return n;
  } catch (_) {
    return fetch(req);
  }
}

self.addEventListener("fetch", e => {
  const r = e.request;
  if (r.method !== "GET") return;
  const u = new URL(r.url);
  if (r.mode === "navigate" && u.origin === location.origin) return e.respondWith(page(r));
  if (u.origin === location.origin) return e.respondWith(netFirst(r));
  if (u.hostname === "cdn.jsdelivr.net" || u.hostname === "cdnjs.cloudflare.com") return e.respondWith(cdn(r));
  /* tout le reste (Supabase, WhatsApp…) passe directement par le réseau, sans mise en mémoire */
});
