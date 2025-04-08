const CACHE_CONFIG = {
  MAIN: 'icemyst-main',
  STATIC: 'icemyst-static',
  MEDIA: 'icemyst-media',
  MAX_AGE: {
    STATIC: 7 * 24 * 60 * 60,
    MEDIA: 30 * 24 * 60 * 60
  }
};

const getTime = () => new Date().getTime();

const cacheDB = {
  read: key => caches.match(key).then(res => res ? res.text() : null).catch(() => null),
  write: (key, value) => caches.open(CACHE_CONFIG.VERSION).then(cache => cache.put(key, new Response(value))),
  delete: key => caches.match(key).then(res => res && caches.open(CACHE_CONFIG.VERSION).then(cache => cache.delete(key))),
  meta: {
    get: (prefix, key) => cacheDB.read(new Request(`https://${prefix}/${encodeURIComponent(key)}`)),
    set: (prefix, key, value) => cacheDB.write(new Request(`https://${prefix}/${encodeURIComponent(key)}`), value),
    remove: (prefix, key) => cacheDB.delete(new Request(`https://${prefix}/${encodeURIComponent(key)}`)),
    updateAccess: key => cacheDB.meta.set('ACCESS-CACHE', key, getTime()),
    checkExpiry: async (key, maxAge) => {
      const time = await cacheDB.meta.get('LOCALCACHE', key);
      return time && (getTime() - time < maxAge);
    }
  }
};

const cacheRules = [
  { type: CACHE_CONFIG.STATIC, match: /\.(?:js|css|html|json|xml)$/i, maxAge: CACHE_CONFIG.MAX_AGE.STATIC },
  { type: CACHE_CONFIG.MEDIA, match: /\.(?:png|jpg|jpeg|gif|webp|svg|ico|bmp)$/i, maxAge: CACHE_CONFIG.MAX_AGE.MEDIA, isImage: true },
  { type: CACHE_CONFIG.MEDIA, match: /\.(?:eot|ttf|woff|woff2)$/i, maxAge: CACHE_CONFIG.MAX_AGE.MEDIA },
  { type: CACHE_CONFIG.STATIC, match: /\.(?:mp3|mp4|webm|ogg|flac|wav|aac)$/i, maxAge: CACHE_CONFIG.MAX_AGE.STATIC }
];

const replaceRules = [
  { pattern: /^(https?:)?\/\/cdn\.jsdelivr\.net\/gh/i, replacement: '//cdn1.tianli0.top/gh' },
  { pattern: /^(https?:)?\/\/cdn\.jsdelivr\.net\/npm/i, replacement: '//npm.elemecdn.com' },
  { pattern: /^(https?:)?\/\/fonts\.googleapis\.com/i, replacement: '//fonts.loli.net' },
  { pattern: /^(https?:)?\/\/fonts\.gstatic\.com/i, replacement: '//gstatic.loli.net' },
  { pattern: /^(https?:)?\/\/www\.gravatar\.com\/avatar/i, replacement: '//gravatar.loli.net/avatar' },
  { pattern: /^(https?:)?\/\/s2\.loli\.net/i, replacements: ['//images.weserv.nl/?url=s2.loli.net', '//image.baidu.com/search/down?url=https://s2.loli.net'] },
  { pattern: /^(https?:)?\/\/raw\.githubusercontent\.com/i, replacement: '//raw.gitmirror.com' }
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_CONFIG.MAIN).then(cache => {
      return cache.addAll([
        '/',
        '/index.html',
        '/css/index.css',
        '/js/main.js'
      ]);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(cacheName => 
          ![CACHE_CONFIG.MAIN, CACHE_CONFIG.STATIC, CACHE_CONFIG.MEDIA].includes(cacheName)
        ).map(cacheName => caches.delete(cacheName))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (event.data?.type === 'ACTIVATED_NO_REFRESH') {
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({type: 'SW_READY'});
      });
    });
  } else if (event.data?.type === 'CACHE_UPDATED') {
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({type: 'CACHE_UPDATED'});
      });
    });
  }
});

const utils = {
  findCacheRule: url => cacheRules.find(rule => url.match(rule.match)),
  
  fixUrl: url => url?.startsWith('//') ? 'https:' + url : url,
  
  getReplacedUrl: url => {
    if (!url) return null;
    
    for (const rule of replaceRules) {
      if (rule.pattern.test(url)) {
        if (rule.replacements) {
          const isImage = url.match(/\.(jpe?g|png|gif|webp|svg)$/i);
          const index = isImage ? 0 : Math.floor(Math.random() * rule.replacements.length);
          return url.replace(rule.pattern, rule.replacements[index]);
        } else if (rule.replacement) {
          return url.replace(rule.pattern, rule.replacement);
        }
      }
    }
    return null;
  },
  
  createRequest: (url, isImage = false) => new Request(url, {
    method: 'GET',
    headers: { 'Accept': isImage ? 'image/*' : '*/*' },
    mode: 'no-cors',
    credentials: 'omit'
  }),
  
  cacheResponse: (cache, request, response) => {
    if (response?.ok || response?.type === 'opaque') {
      try {
        cache.put(request, response.clone());
      } catch (e) {}
    }
  }
};

async function fetchResource(request, url) {
  const cached = await caches.match(request);
  if (cached) return cached;
  
  const cacheRule = utils.findCacheRule(url);
  const isImage = cacheRule?.isImage || false;
  const replacedUrl = utils.getReplacedUrl(url);
  const fixedReplaceUrl = replacedUrl ? utils.fixUrl(replacedUrl) : null;
  
  const cache = await caches.open(CACHE_CONFIG.MAIN);
  
  if (!fixedReplaceUrl) {
    try {
      const response = await fetch(request);
      utils.cacheResponse(cache, request, response);
      return response;
    } catch (e) {
      return new Response('', { status: 503 });
    }
  }
  
  const fallbackReq = utils.createRequest(fixedReplaceUrl, isImage);
  
  try {
    const originalPromise = fetch(request.clone());
    const fallbackPromise = fetch(fallbackReq.clone());
    
    const response = await Promise.race([originalPromise, fallbackPromise]);
    
    if (response) {
      utils.cacheResponse(cache, request, response);
      return response;
    }
    
    return await Promise.any([originalPromise, fallbackPromise]);
  } catch (e) {
    if (isImage) {
      return new Response('', {
        status: 200,
        headers: { 'Content-Type': 'image/svg+xml' }
      });
    }
    return new Response('', { status: 503 });
  }
}

self.addEventListener('fetch', event => {
  const url = event.request.url;
  
  if (event.request.method !== 'GET') return;
  
  const needsIntercept = utils.findCacheRule(url) || 
                         replaceRules.some(rule => rule.pattern.test(url));
  
  if (needsIntercept) {
    event.respondWith(fetchResource(event.request, url));
  }
});

try {
  importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.3.0/workbox-sw.js');
  
  const wb = workbox;
  wb.core.setCacheNameDetails({ prefix: "icemyst" });
  wb.core.skipWaiting();
  wb.core.clientsClaim();
  wb.precaching.cleanupOutdatedCaches();
  wb.precaching.precacheAndRoute(self.__WB_MANIFEST || []);
  
  cacheRules.forEach(rule => {
    wb.routing.registerRoute(
      rule.match,
      new wb.strategies.StaleWhileRevalidate({
        cacheName: rule.type,
        plugins: [
          new wb.expiration.ExpirationPlugin({
            maxEntries: rule.isImage ? 500 : 1000, 
            maxAgeSeconds: rule.maxAge
          }),
          new wb.cacheableResponse.CacheableResponsePlugin({ statuses: [0, 200] })
        ]
      })
    );
  });
  
  wb.routing.registerRoute(
    /^https?:\/\/(images\.weserv\.nl|image\.baidu\.com|loli\.net|cdn1\.tianli0\.top)/,
    new wb.strategies.CacheFirst({
      cacheName: "cross-origin",
      plugins: [
        new wb.expiration.ExpirationPlugin({
          maxEntries: 500,
          maxAgeSeconds: 30 * 24 * 60 * 60
        }),
        new wb.cacheableResponse.CacheableResponsePlugin({ statuses: [0, 200] })
      ],
      fetchOptions: { mode: 'no-cors', credentials: 'omit' }
    })
  );
  
  wb.googleAnalytics.initialize();
} catch (error) {
  console.error('Workbox初始化失败:', error);
}