const CACHE_CONFIG = {
  MAIN: 'icemyst-main',
  STATIC: 'icemyst-static',
  MEDIA: 'icemyst-media',
  MAX_AGE: { STATIC: 604800, MEDIA: 2592000 },
  MAX_ENTRIES: { STATIC: 1000, MEDIA: 500 }
};

const CACHE_RULES = [
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
    this.config = {
      ttl: 3600000,          // 1小时缓存有效期
      pendingTimeout: 30000, // 30秒挂起超时
      statusTimeout: 86400000 // 24小时状态超时
    };
    
    // 每分钟清理一次过期数据
    this.cleanupInterval = setInterval(() => this.clean(), 60000);
  }

  getCDN(url) {
    if (!url) return null;
    
    // 检查缓存
    const cached = this.cache.get(url);
    if (cached && (Date.now() - cached.time < this.config.ttl)) return cached.value;

    // 匹配CDN规则
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
    // 使用多个替换选项
    if (rule.replacements) {
      return url.replace(rule.pattern, rule.replacements[Math.floor(Math.random() * rule.replacements.length)]);
    }
    
    // 根据健康状态选择CDN
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
      
      // 如果失败，清除缓存以避免使用失效的CDN
      if (!success) this.cache.clear();
    } catch (error) {
      console.error('Failed to update CDN status:', error);
    }
  }

  // 简化挂起状态管理
  isPending(url) { return this.pending.has(url); }
  markPending(url) { this.pending.set(url, Date.now()); }
  clearPending(url) { this.pending.delete(url); }

  clean() {
    const now = Date.now();
    
    // 使用简洁的方式遍历和清理各个Map
    this.cleanMap(this.pending, now, this.config.pendingTimeout);
    this.cleanMap(this.cache, now, this.config.ttl, 'time');
    this.cleanMap(this.status, now, this.config.statusTimeout, 'timestamp');
  }
  
  // 辅助方法，用于清理过期项目
  cleanMap(map, now, timeout, timeKey) {
    map.forEach((value, key) => {
      const timestamp = timeKey ? value[timeKey] : value;
      if (now - timestamp > timeout) map.delete(key);
    });
  }
}

const cdnManager = new CDNManager();

// Service Worker 事件监听器
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => {
            const validCaches = [CACHE_CONFIG.MAIN, CACHE_CONFIG.STATIC, CACHE_CONFIG.MEDIA];
            return !validCaches.includes(key) && !key.startsWith('workbox-');
          })
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  
  const url = event.request.url;
  
  // 检查是否有匹配的CDN规则且请求未挂起
  const cdnRule = Object.values(CDN_MAP).find(rule => rule.pattern.test(url));
  if (!cdnRule || cdnManager.isPending(url)) return;
  
  const newUrl = cdnManager.getCDN(url);
  if (!newUrl) return;

  cdnManager.markPending(url);
  event.respondWith(handleFetch(event.request, newUrl));
});

async function handleFetch(request, newUrl) {
  try {
    // 首先尝试从缓存获取
    const cached = await caches.match(request);
    if (cached) {
      cdnManager.clearPending(request.url);
      return cached;
    }

    // 尝试从新CDN获取
    const response = await fetch(newUrl, { mode: 'no-cors', credentials: 'omit' });
    cdnManager.updateStatus(newUrl, true);
    
    // 只缓存成功的响应
    if (response.ok || response.type === 'opaque') {
      const cache = await caches.open(CACHE_CONFIG.MAIN);
      await cache.put(request, response.clone());
    }
    
    cdnManager.clearPending(request.url);
    return response;
  } catch (error) {
    // 如果CDN失败，更新状态并回退到原始请求
    cdnManager.updateStatus(newUrl, false);
    cdnManager.clearPending(request.url);
    return fetch(request);
  }
}

// Workbox 配置
importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.3.0/workbox-sw.js');
const { core, precaching, routing, strategies, expiration, cacheableResponse } = workbox;

// 基本配置
core.setCacheNameDetails({ prefix: "冰梦" });
core.skipWaiting();
core.clientsClaim();
precaching.cleanupOutdatedCaches();
precaching.precacheAndRoute(self.__WB_MANIFEST || []);

// 注册缓存规则
CACHE_RULES.forEach(rule => {
  // 将短横线命名转换为驼峰命名
  const strategyName = rule.strategy.replace(/(^|-)(\w)/g, (_, __, c) => c.toUpperCase());
  
  // 提取缓存类型
  const cacheType = rule.type.split('-').pop();
  
  routing.registerRoute(
    rule.match,
    new strategies[strategyName]({
      cacheName: rule.type,
      plugins: [
        new expiration.ExpirationPlugin({
          maxEntries: CACHE_CONFIG.MAX_ENTRIES[cacheType] || 500,
          maxAgeSeconds: CACHE_CONFIG.MAX_AGE[cacheType] || 604800
        }),
        new cacheableResponse.CacheableResponsePlugin({ statuses: [0, 200] })
      ]
    })
  );
});

// 启用 Google Analytics 离线支持
workbox.googleAnalytics.initialize();
