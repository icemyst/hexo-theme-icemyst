const WORKBOX_VERSION = '7.3.0';

importScripts(`https://storage.googleapis.com/workbox-cdn/releases/${WORKBOX_VERSION}/workbox-sw.js`);

// Workbox 基础配置
workbox.core.setCacheNameDetails({ prefix: "冰梦" });
workbox.core.skipWaiting();
workbox.core.clientsClaim();
workbox.precaching.precacheAndRoute(self.__WB_MANIFEST, { directoryIndex: null });
workbox.precaching.cleanupOutdatedCaches();
workbox.googleAnalytics.initialize();

// 统一配置常量
const CONFIG = {
    CACHE_NAME: 'icemystCache',
    VERSION_CACHE_NAME: 'icemystCacheTime',
    MAX_ACCESS_CACHE_TIME: 60 * 60 * 24 * 10, // 10天
    CACHE_TIMEOUT: 400,
    DAY: 60 * 60 * 24,
    HOUR: 60 * 60
};

const getCurrentTime = () => Math.floor(Date.now() / 1000);

// 通用缓存插件
const createDefaultPlugins = (maxAge = CONFIG.DAY * 30) => [
    new workbox.expiration.ExpirationPlugin({ maxEntries: 1000, maxAgeSeconds: maxAge }),
    new workbox.cacheableResponse.CacheableResponsePlugin({ statuses: [0, 200] })
];

// 外部资源缓存路由配置
const EXTERNAL_ROUTES = [
    { pattern: /^https:\/\/fonts\.googleapis\.com/, strategy: 'StaleWhileRevalidate', cacheName: 'google-fonts-stylesheets', plugins: [] },
    { pattern: /^https:\/\/fonts\.gstatic\.com/, strategy: 'CacheFirst', cacheName: 'google-fonts-webfonts' },
    { pattern: /^https:\/\/cdn\.jsdelivr\.net/, strategy: 'CacheFirst', cacheName: 'static-libs' }
];

// 注册外部资源缓存路由
EXTERNAL_ROUTES.forEach(({ pattern, strategy, cacheName, plugins }) => {
    workbox.routing.registerRoute(
        pattern,
        new workbox.strategies[strategy]({ 
            cacheName, 
            plugins: plugins || createDefaultPlugins() 
        })
    );
});

// 缓存管理器
class CacheManager {
    static createKey(prefix, key) {
        return new Request(`https://${prefix}/${encodeURIComponent(key)}`);
    }
    
    static async cacheOperation(operation, key, value) {
        try {
            const cache = await caches.open(CONFIG.VERSION_CACHE_NAME);
            switch (operation) {
                case 'read':
                    const res = await caches.match(key);
                    return res ? await res.text() : null;
                case 'write':
                    await cache.put(key, new Response(value));
                    break;
                case 'delete':
                    await cache.delete(key);
                    break;
            }
        } catch (error) {
            console.error(`Cache ${operation} failed:`, error);
            return null;
        }
    }
    
    // 简化的时间戳和访问时间操作
    static async readTime(key) {
        return this.cacheOperation('read', this.createKey('LOCALCACHE', key));
    }
    
    static async writeTime(key, value) {
        return this.cacheOperation('write', this.createKey('LOCALCACHE', key), value);
    }
    
    static async updateAccess(key) {
        return this.cacheOperation('write', this.createKey('ACCESS-CACHE', key), getCurrentTime());
    }
    
    static async checkAccess(key) {
        const realKey = this.createKey('ACCESS-CACHE', key);
        const value = await this.cacheOperation('read', realKey);
        if (value) {
            this.cacheOperation('delete', realKey);
            return getCurrentTime() - value < CONFIG.MAX_ACCESS_CACHE_TIME;
        }
        return false;
    }
}

self.addEventListener('install', () => self.skipWaiting());

// 本地资源缓存配置
const LOCAL_CACHE_CONFIG = {
    html: { pattern: /\.html$/i, maxAge: CONFIG.DAY },
    pages: { pattern: /\/(categories|tags|about|archives|link)\/?$/i, maxAge: CONFIG.DAY },
    api: { pattern: /\/api\//i, maxAge: CONFIG.HOUR }
};

// URL替换配置
const URL_REPLACEMENTS = [
    { sources: ['//s2.loli.net'], target: '//images.weserv.nl/?url=s2.loli.net' },
    { sources: ['//cdn.jsdelivr.net/gh', '//jsd.onmicrosoft.cn/gh'], target: '//cdn.jsdmirror.cn/gh' }
];

// 静态资源模式（由Workbox处理）
const STATIC_RESOURCE_PATTERN = /\.(js|css|jpg|jpeg|png|gif|webp|ico|svg|woff|woff2|ttf|eot|mp3|mp4)$/i;

// 查找匹配的缓存配置
function findCacheConfig(url) {
    if (STATIC_RESOURCE_PATTERN.test(url)) return null;
    
    for (const config of Object.values(LOCAL_CACHE_CONFIG)) {
        if (config.pattern.test(url)) return config;
    }
    return null;
}

// URL替换处理
function replaceRequestUrl(request) {
    let url = request.url;
    
    for (const { sources, target } of URL_REPLACEMENTS) {
        const matchedSource = sources.find(source => url.includes(source));
        if (matchedSource) {
            return new Request(url.replace(matchedSource, target), {
                method: request.method,
                headers: request.headers,
                body: request.body,
                mode: request.mode,
                credentials: request.credentials,
                cache: request.cache,
                redirect: request.redirect,
                referrer: request.referrer
            });
        }
    }
    
    return null;
}

// 请求拦截模式
const BLOCKED_PATTERNS = [
    /google-analytics\.com\/collect/,
    /googletagmanager\.com/,
    /doubleclick\.net/
];

function shouldBlockRequest(url) {
    return BLOCKED_PATTERNS.some(pattern => pattern.test(url));
}

// 自定义缓存处理
async function handleCustomCache(request, cachedResponse, config) {
    const now = getCurrentTime();
    const url = request.url;
    
    CacheManager.updateAccess(url);
    
    // 检查缓存有效性
    if (cachedResponse) {
        const cacheTime = await CacheManager.readTime(url);
        if (cacheTime && (now - cacheTime) < config.maxAge) {
            return cachedResponse;
        }
    }
    
    // 网络请求处理
    const fetchAndCache = async () => {
        try {
            const networkResponse = await fetch(request);
            
            if (networkResponse.ok) {
                await CacheManager.writeTime(url, now);
                const cache = await caches.open(CONFIG.CACHE_NAME);
                await cache.put(request, networkResponse.clone());
            }
            
            return networkResponse;
        } catch (error) {
            console.error(`网络请求失败: ${url}`, error);
            return cachedResponse || new Response('网络不可用', { 
                status: 503, 
                statusText: 'Service Unavailable' 
            });
        }
    };
    
    // 缓存竞速策略
    if (cachedResponse) {
        const cacheTimeout = new Promise(resolve => 
            setTimeout(() => resolve(cachedResponse), CONFIG.CACHE_TIMEOUT)
        );
        return Promise.race([cacheTimeout, fetchAndCache()]);
    }
    
    return fetchAndCache();
}

// Fetch事件处理器
self.addEventListener('fetch', event => {
    const originalRequest = event.request;
    const replacedRequest = replaceRequestUrl(originalRequest);
    const request = replacedRequest || originalRequest;
    
    // 拦截不需要的请求
    if (shouldBlockRequest(request.url)) {
        event.respondWith(new Response(null, { status: 204 }));
        return;
    }
    
    // 自定义缓存处理
    const cacheConfig = findCacheConfig(request.url);
    if (cacheConfig) {
        event.respondWith(
            caches.match(request)
                .then(cachedResponse => handleCustomCache(request, cachedResponse, cacheConfig))
        );
        return;
    }
    
    // URL替换请求
    if (replacedRequest) {
        event.respondWith(fetch(request));
        return;
    }
    
    // 其他请求由Workbox处理
});