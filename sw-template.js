const CACHE_CONFIG = {
  MAIN: 'icemyst-main',
  STATIC: 'icemyst-static',
  MEDIA: 'icemyst-media',
  MAX_AGE: { STATIC: 604800, MEDIA: 2592000 }
};

const cacheRules = [
  { type: CACHE_CONFIG.STATIC, match: /\.(?:js|css|html|json|xml)$/i, maxAge: CACHE_CONFIG.MAX_AGE.STATIC },
  { type: CACHE_CONFIG.MEDIA, match: /\.(?:png|jpg|jpeg|gif|webp|svg|ico|bmp)$/i, maxAge: CACHE_CONFIG.MAX_AGE.MEDIA, isImage: true },
  { type: CACHE_CONFIG.MEDIA, match: /\.(?:eot|ttf|woff|woff2)$/i, maxAge: CACHE_CONFIG.MAX_AGE.MEDIA },
  { type: CACHE_CONFIG.STATIC, match: /\.(?:mp3|mp4|webm|ogg|flac|wav|aac)$/i, maxAge: CACHE_CONFIG.MAX_AGE.STATIC }
];

const CDN_REPLACEMENTS = {
  jsdelivr_gh: { pattern: /^(https?:)?\/\/cdn\.jsdelivr\.net\/gh/i, replacement: '//cdn1.tianli0.top/gh' },
  jsdelivr_npm: { pattern: /^(https?:)?\/\/cdn\.jsdelivr\.net\/npm/i, replacement: '//npm.elemecdn.com' },
  google_fonts: { pattern: /^(https?:)?\/\/fonts\.googleapis\.com/i, replacement: '//fonts.loli.net' },
  gstatic: { pattern: /^(https?:)?\/\/fonts\.gstatic\.com/i, replacement: '//gstatic.loli.net' },
  gravatar: { pattern: /^(https?:)?\/\/www\.gravatar\.com\/avatar/i, replacement: '//gravatar.loli.net/avatar' },
  loli: { pattern: /^(https?:)?\/\/s2\.loli\.net/i, replacements: ['//image.baidu.com/search/down?url=https://s2.loli.net','//images.weserv.nl/?url=s2.loli.net'] },
  github_raw: { pattern: /^(https?:)?\/\/raw\.githubusercontent\.com/i, replacement: '//raw.gitmirror.com' }
};

// Core utilities
const utils = {
  findCacheRule: url => cacheRules.find(rule => url.match(rule.match)),
  fixUrl: url => url?.startsWith('//') ? 'https:' + url : url,
  getReplacedUrl: url => {
    if (!url) return null;
    for (const rule of Object.values(CDN_REPLACEMENTS)) {
      if (rule.pattern.test(url)) {
        if (rule.replacements) {
          const isImage = url.match(/\.(jpe?g|png|gif|webp|svg)$/i);
          return url.replace(rule.pattern, rule.replacements[isImage ? 0 : Math.floor(Math.random() * rule.replacements.length)]);
        } 
        return url.replace(rule.pattern, rule.replacement);
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
  cacheResponse: (cache, req, res) => {
    if (res?.ok || res?.type === 'opaque') {
      try { cache.put(req, res.clone()); } catch (e) {}
    }
  }
};

// Service Worker core functions
async function fetchResource(request, url) {
  const cached = await caches.match(request);
  if (cached) return cached;
  
  const cacheRule = utils.findCacheRule(url);
  const isImage = cacheRule?.isImage || false;
  
  // Add priority handling for non-image resources
  if (!isImage) {
    try {
      const response = await fetch(request);
      const cache = await caches.open(CACHE_CONFIG.MAIN);
      utils.cacheResponse(cache, request, response);
      return response;
    } catch (e) {
      return new Response('', { status: 503 });
    }
  }
  
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
    // Try both requests, with better fallback handling
    let response;
    try {
      // First try the CDN replacement
      response = await fetch(fallbackReq.clone());
      
      // Check if response is valid - if not, throw to try original
      if (!response.ok && response.status !== 0) {
        throw new Error('CDN replacement failed');
      }
      
      utils.cacheResponse(cache, request, response);
      return response;
    } catch (cdnError) {
      // If CDN fails, try the original request
      try {
        response = await fetch(request.clone());
        utils.cacheResponse(cache, request, response);
        return response;
      } catch (originalError) {
        // If both fail and it's an image, return empty image
        if (isImage) {
          return new Response('', { status: 200, headers: { 'Content-Type': 'image/svg+xml' }});
        }
        return new Response('', { status: 503 });
      }
    }
  } catch (e) {
    return isImage 
      ? new Response('', { status: 200, headers: { 'Content-Type': 'image/svg+xml' }})
      : new Response('', { status: 503 });
  }
}

// Service Worker event listeners
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_CONFIG.MAIN).then(cache => 
    cache.addAll(['/', '/index.html', '/css/index.css', '/js/main.js'])
  ));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(names => 
    Promise.all(names.filter(name => 
      ![CACHE_CONFIG.MAIN, CACHE_CONFIG.STATIC, CACHE_CONFIG.MEDIA].includes(name)
    ).map(name => caches.delete(name)))
  ));
  self.clients.claim();
});

self.addEventListener('message', e => {
  const { type } = e.data || {};
  if (type === 'SKIP_WAITING') self.skipWaiting();
  else if (type === 'ACTIVATED_NO_REFRESH' || type === 'CACHE_UPDATED') {
    self.clients.matchAll().then(clients => 
      clients.forEach(client => client.postMessage({
        type: type === 'ACTIVATED_NO_REFRESH' ? 'SW_READY' : 'CACHE_UPDATED'
      }))
    );
  }
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  
  const url = e.request.url;
  const needsIntercept = utils.findCacheRule(url) || 
                         Object.values(CDN_REPLACEMENTS).some(rule => rule.pattern.test(url));
  
  if (needsIntercept) e.respondWith(fetchResource(e.request, url));
});

// Initialize Workbox if available
try {
  importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.3.0/workbox-sw.js');
  
  const wb = workbox;
  wb.core.setCacheNameDetails({ prefix: "冰梦" });
  wb.core.skipWaiting();
  wb.core.clientsClaim();
  wb.precaching.cleanupOutdatedCaches();
  wb.precaching.precacheAndRoute(self.__WB_MANIFEST || []);
  
  // Register cache rules
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
  
  // Register cross-origin route
  wb.routing.registerRoute(
    /^https?:\/\/(images\.weserv\.nl|image\.baidu\.com|loli\.net|cdn1\.tianli0\.top)/,
    new wb.strategies.CacheFirst({
      cacheName: "cross-origin",
      plugins: [
        new wb.expiration.ExpirationPlugin({ maxEntries: 500, maxAgeSeconds: 2592000 }),
        new wb.cacheableResponse.CacheableResponsePlugin({ statuses: [0, 200] })
      ],
      fetchOptions: { mode: 'no-cors', credentials: 'omit' }
    })
  );
  
  wb.googleAnalytics.initialize();
} catch (error) {
  console.error('Workbox初始化失败:', error);
} 