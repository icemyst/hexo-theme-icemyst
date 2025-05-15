const CACHE_CONFIG = {
  MAIN: 'icemyst-main',
  STATIC: 'icemyst-static',
  MEDIA: 'icemyst-media',
  MAX_AGE: { STATIC: 604800, MEDIA: 2592000 },
  MAX_ENTRIES: { STATIC: 1000, MEDIA: 500 }
};

const cacheRules = [
  { type: CACHE_CONFIG.STATIC, match: /\.(?:js|css|html|json|xml)$/i, strategy: 'stale-while-revalidate' },
  { type: CACHE_CONFIG.MEDIA, match: /\.(?:png|jpe?g|gif|webp|svg|ico|bmp|eot|ttf|woff2?)$/i, strategy: 'cache-first' },
  { type: CACHE_CONFIG.STATIC, match: /\.(?:mp3|mp4|webm|ogg|flac|wav|aac)$/i, strategy: 'network-first' }
];

const CDN_MAP = {
  jsdelivr_gh: {
    pattern: /^https?:\/\/cdn\.jsdelivr\.net\/gh/,
    replacement: '//gcore.jsdelivr.net/gh',
    fallbacks: ['//cdn1.tianli0.top/gh', '//cdn.jsdmirror.com/gh', '//cdn.jsdmirror.cn/gh', '//jsd.cdn.zzko.cn/gh', '//cdn.staticaly.com/gh']
  },
  jsdelivr_npm: {
    pattern: /^https?:\/\/cdn\.jsdelivr\.net\/npm/,
    replacement: '//npm.elemecdn.com',
    fallbacks: ['//cdn.jsdmirror.com/npm', '//cdn.onmicrosoft.cn/npm', '//npm.onmicrosoft.cn', '//unpkg.com']
  },
  SMMS: {
    pattern: /^https?:\/\/s2\.loli\.net/,
    replacements: [
      '//cdn.statically.io/img/s2.loli.net',
      '//images.weserv.nl/?url=s2.loli.net',
      '//image.baidu.com/search/down?url=https://s2.loli.net',
      '//i0.wp.com/s2.loli.net',
      '//wsrv.nl/?url=s2.loli.net'
    ]
  },
  google_fonts: {
    pattern: /^https?:\/\/fonts\.googleapis\.com/,
    replacement: '//fonts.loli.net',
    fallbacks: ['//fonts.geekzu.org', '//fonts.css.network']
  },
  gstatic: {
    pattern: /^https?:\/\/fonts\.gstatic\.com/,
    replacement: '//gstatic.loli.net',
    fallbacks: ['//gapis.geekzu.org/g-fonts', '//fonts.gstatic.cn']
  },
  gravatar: {
    pattern: /^https?:\/\/www\.gravatar\.com\/avatar/,
    replacement: '//gravatar.loli.net/avatar',
    fallbacks: ['//cravatar.cn/avatar', '//sdn.geekzu.org/avatar', '//gravatar.inwao.com/avatar']
  },
  github_raw: {
    pattern: /^https?:\/\/raw\.githubusercontent\.com/,
    replacement: '//raw.gitmirror.com',
    fallbacks: ['//cdn.staticaly.com/gh', '//ghproxy.net/raw.githubusercontent.com']
  },
  cdnjs: {
    pattern: /^https?:\/\/cdnjs\.cloudflare\.com\/ajax\/libs/,
    replacement: '//s4.zstatic.net/ajax/libs',
    fallbacks: ['//cdnjs.webstatic.cn/ajax/libs', '//cdnjs.loli.net/ajax/libs', '//lib.baomitu.com']
  },
  unpkg: {
    pattern: /^https?:\/\/unpkg\.com/,
    replacement: '//s4.zstatic.net/npm',
    fallbacks: ['//cdn.onmicrosoft.cn/npm', '//npm.onmicrosoft.cn', '//npm.elemecdn.com']
  }
};

class CDNManager {
  constructor() {
    this.status = new Map();
    this.pending = new Map();
    this.cache = new Map();
    this.TTL = 3600000;
    this.cleanupInterval = setInterval(() => this.clean(), 60000);
  }

  getCDN(url) {
    if (!url) return null;
    
    const cached = this.cache.get(url);
    if (cached && (Date.now() - cached.time < this.TTL)) return cached.value;

    for (const rule of Object.values(CDN_MAP)) {
      if (!rule.pattern.test(url)) continue;
      
      const newUrl = this.generateNewUrl(url, rule);
      if (newUrl) {
        this.cache.set(url, { value: newUrl, time: Date.now() });
        return newUrl;
      }
    }
    return null;
  }

  generateNewUrl(url, rule) {
    if (rule.replacements) {
      return url.replace(rule.pattern, rule.replacements[Math.floor(Math.random() * rule.replacements.length)]);
    }
    
    const state = this.status.get(rule.replacement);
    const useFallback = state?.failCount > 2 && rule.fallbacks?.length;
    const cdn = useFallback
      ? rule.fallbacks[Math.floor(Math.random() * rule.fallbacks.length)]
      : rule.replacement;
    
    return url.replace(rule.pattern, cdn);
  }

  updateStatus(url, success) {
    try {
      const host = '//' + new URL(url).host;
      const old = this.status.get(host) || { failCount: 0 };
      this.status.set(host, {
        health: success,
        failCount: success ? 0 : old.failCount + 1,
        timestamp: Date.now()
      });
      
      if (!success) this.cache.clear();
    } catch (error) {
      console.error('Failed to update CDN status:', error);
    }
  }

  isPending(url) { return this.pending.has(url); }
  markPending(url) { this.pending.set(url, Date.now()); }
  clearPending(url) { this.pending.delete(url); }

  clean() {
    const now = Date.now();
    this.pending.forEach((t, k) => { if (now - t > 30000) this.pending.delete(k); });
    this.cache.forEach((v, k) => { if (now - v.time > this.TTL) this.cache.delete(k); });
    this.status.forEach((v, k) => { if (now - v.timestamp > 86400000) this.status.delete(k); });
  }
}

const cdnManager = new CDNManager();

// Service Worker Event Listeners
self.addEventListener('install', e => e.waitUntil(self.skipWaiting()));

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => ![CACHE_CONFIG.MAIN, CACHE_CONFIG.STATIC, CACHE_CONFIG.MEDIA].includes(k) && !k.startsWith('workbox-'))
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  
  const url = e.request.url;
  const cdnRule = Object.values(CDN_MAP).find(rule => rule.pattern.test(url));
  
  if (!cdnRule || cdnManager.isPending(url)) return;
  
  const newUrl = cdnManager.getCDN(url);
  if (!newUrl) return;

  cdnManager.markPending(url);
  e.respondWith(handleFetch(e.request, newUrl));
});

async function handleFetch(request, newUrl) {
  const cached = await caches.match(request);
  if (cached) {
    cdnManager.clearPending(request.url);
    return cached;
  }

  try {
    const resp = await fetch(newUrl, { mode: 'no-cors', credentials: 'omit' });
    cdnManager.updateStatus(newUrl, true);
    
    if (resp.ok || resp.type === 'opaque') {
      const cache = await caches.open(CACHE_CONFIG.MAIN);
      await cache.put(request, resp.clone());
    }
    
    cdnManager.clearPending(request.url);
    return resp;
  } catch (error) {
    cdnManager.updateStatus(newUrl, false);
    cdnManager.clearPending(request.url);
    return fetch(request);
  }
}

// Workbox Configuration
importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.3.0/workbox-sw.js');
const { core, precaching, routing, strategies, expiration, cacheableResponse } = workbox;

core.setCacheNameDetails({ prefix: "冰梦" });
core.skipWaiting();
core.clientsClaim();
precaching.cleanupOutdatedCaches();
precaching.precacheAndRoute(self.__WB_MANIFEST || []);

cacheRules.forEach(rule => {
  const strategyName = rule.strategy.replace(/(^|-)(\w)/g, (_, __, c) => c.toUpperCase());
  routing.registerRoute(
    rule.match,
    new strategies[strategyName]({
      cacheName: rule.type,
      plugins: [
        new expiration.ExpirationPlugin({
          maxEntries: CACHE_CONFIG.MAX_ENTRIES[rule.type.split('-').pop()] || 500,
          maxAgeSeconds: CACHE_CONFIG.MAX_AGE[rule.type.split('-').pop()] || 604800
        }),
        new cacheableResponse.CacheableResponsePlugin({ statuses: [0, 200] })
      ]
    })
  );
});

workbox.googleAnalytics.initialize();
