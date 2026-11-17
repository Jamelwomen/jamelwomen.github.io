/* Jamel Women — офлайн-кэш: сайт открывается сразу, без повторной загрузки, даже при плохом интернете */
const CACHE = "jw-v1";
const PAGE = new URL("./", self.location).href;

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll([PAGE, new URL("apple-touch-icon.png", self.location).href]).catch(()=>{})));
  self.skipWaiting();
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

function timeout(ms){ return new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms)); }
async function put(key, res){ if(res && res.ok){ const c = await caches.open(CACHE); await c.put(key, res.clone()); } return res; }

self.addEventListener("fetch", e => {
  const req = e.request;
  if(req.method !== "GET") return;
  const url = new URL(req.url);

  /* GitHub API (сохранение у владельца) — только сеть */
  if(url.hostname === "api.github.com") return;

  /* шрифты Google — из кэша, без ожидания сети */
  if(/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)){
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => put(req, r))));
    return;
  }
  if(url.origin !== self.location.origin) return;

  const isPage = req.mode === "navigate" || url.href.split(/[?#]/)[0] === PAGE || /\/index\.html$/.test(url.pathname);

  /* страница: проверка новой версии (?nocache) — из сети, и сразу сохраняем как новую страницу */
  if(isPage && url.searchParams.has("nocache")){
    e.respondWith(fetch(req, {cache: "no-store"}).then(r => put(PAGE, r)).catch(() => caches.match(PAGE)));
    return;
  }
  /* страница: сразу из кэша, в фоне тихо обновляем */
  if(isPage){
    const net = fetch(PAGE, {cache: "no-store"}).then(r => put(PAGE, r));
    e.respondWith(caches.match(PAGE).then(hit => hit || net));
    e.waitUntil(net.catch(()=>{}));
    return;
  }
  /* данные сайта и ключ — свежие из сети, но не дольше 3 секунд; иначе последняя сохранённая копия */
  if(/\/data\/[^/]+\.json$/.test(url.pathname)){
    const key = url.origin + url.pathname;
    const net = fetch(req, {cache: "no-store"}).then(r => put(key, r));
    e.respondWith(Promise.race([net, timeout(3000)]).catch(() => caches.match(key).then(hit => hit || net)));
    e.waitUntil(net.catch(()=>{}));
    return;
  }
  /* фото и иконки — из кэша, если уже были */
  const key = url.origin + url.pathname;
  e.respondWith(caches.match(key).then(hit => hit || fetch(req).then(r => put(key, r))));
});
