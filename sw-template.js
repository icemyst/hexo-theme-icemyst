const workboxVersion = '7.3.0';

importScripts(`https://storage.googleapis.com/workbox-cdn/releases/${workboxVersion}/workbox-sw.js`);

workbox.core.setCacheNameDetails({
    prefix: "冰梦",
    suffix: workboxVersion
});

workbox.core.skipWaiting();
workbox.core.clientsClaim();

// 优化缓存配置
const CACHE_CONFIG = {
    defaultMaxAge: 60 * 60 * 24 * 30, // 30天
    defaultMaxEntries: 1000,
    imageMaxAge: 60 * 60 * 24 * 7,    // 图片缓存7天
    fontMaxAge: 60 * 60 * 24 * 180,   // 字体缓存180天
    staticMaxAge: 60 * 60 * 24 * 7    // 静态资源缓存7天
};

// 注册成功后要立即缓存的资源列表
// 具体缓存列表在gulpfile.js中配置，见下文
workbox.precaching.precacheAndRoute(self.__WB_MANIFEST, {
    directoryIndex: null
});

// 清空过期缓存
workbox.precaching.cleanupOutdatedCaches();

// 创建通用的缓存配置生成器
function createCacheStrategy(cacheName, options = {}) {
    const { maxEntries = CACHE_CONFIG.defaultMaxEntries, maxAgeSeconds = CACHE_CONFIG.defaultMaxAge, strategy = 'CacheFirst' } = options;
    
    const plugins = [
        new workbox.expiration.ExpirationPlugin({
            maxEntries,
            maxAgeSeconds,
            purgeOnQuotaError: true
        }),
        new workbox.cacheableResponse.CacheableResponsePlugin({
            statuses: [0, 200]
        })
    ];

    return new workbox.strategies[strategy]({
        cacheName,
        plugins,
        matchOptions: {
            ignoreSearch: true
        }
    });
}

// 资源缓存配置优化
const resourceRoutes = [
    {
        pattern: /\.(?:png|jpg|jpeg|gif|bmp|webp|svg|ico)$/,
        cacheName: "images",
        options: {
            maxEntries: 2000,
            maxAgeSeconds: CACHE_CONFIG.imageMaxAge,
            strategy: 'CacheFirst'  // 图片优先使用缓存
        }
    },
    {
        pattern: /\.(?:eot|ttf|woff|woff2)$/,
        cacheName: "fonts",
        options: {
            maxEntries: 100,
            maxAgeSeconds: CACHE_CONFIG.fontMaxAge,
            strategy: 'CacheFirst'  // 字体优先使用缓存
        }
    },
    {
        pattern: /^https:\/\/cdn\.jsdelivr\.net/,
        cacheName: "static-libs",
        options: {
            strategy: 'StaleWhileRevalidate',
            maxAgeSeconds: CACHE_CONFIG.staticMaxAge
        }
    }
];

// 注册资源路由
resourceRoutes.forEach(({ pattern, cacheName }) => {
    workbox.routing.registerRoute(
        pattern,
        createCacheStrategy(cacheName)
    );
});

// 谷歌字体（可选，不需要就注释掉）
workbox.routing.registerRoute(
    /^https:\/\/fonts\.googleapis\.com/,
    new workbox.strategies.StaleWhileRevalidate({
        cacheName: "google-fonts-stylesheets"
    })
);
workbox.routing.registerRoute(
    /^https:\/\/fonts\.gstatic\.com/,
    new workbox.strategies.CacheFirst({
        cacheName: 'google-fonts-webfonts',
        plugins: [
            new workbox.expiration.ExpirationPlugin({
                maxEntries: 1000,
                maxAgeSeconds: 60 * 60 * 24 * 30
            }),
            new workbox.cacheableResponse.CacheableResponsePlugin({
                statuses: [0, 200]
            })
        ]
    })
);

workbox.googleAnalytics.initialize();

/** 缓存库（数据）名称 */
const CACHE_NAME = 'icemystCache'
/** 缓存库（时间戳）名称 */
const VERSION_CACHE_NAME = 'icemystCacheTime'
/** 缓存离线超时时间 */
const MAX_ACCESS_CACHE_TIME = 60 * 60 * 24 * 10

function time() {
    return new Date().getTime()
}

// 统一的缓存操作辅助类
class CacheHelper {
    constructor(prefix) {
        this.prefix = prefix;
    }

    getKey(key) {
        return new Request(`https://${this.prefix}/${encodeURIComponent(key)}`);
    }

    async read(key) {
        try {
            const res = await caches.match(this.getKey(key));
            return res ? await res.text() : null;
        } catch {
            return null;
        }
    }

    async write(key, value) {
        try {
            const cache = await caches.open(VERSION_CACHE_NAME);
            await cache.put(this.getKey(key), new Response(value));
            return true;
        } catch {
            return false;
        }
    }

    async delete(key) {
        const response = await caches.match(this.getKey(key));
        if (response) {
            const cache = await caches.open(VERSION_CACHE_NAME);
            await cache.delete(this.getKey(key));
        }
    }
}

const dbTime = new CacheHelper('LOCALCACHE');
const dbAccess = new CacheHelper('ACCESS-CACHE');

// 扩展访问时间相关方法
Object.assign(dbAccess, {
    update: (key) => dbAccess.write(key, time()),
    async check(key) {
        const value = await this.read(key);
        if (value) {
            await this.delete(key);
            return time() - value < MAX_ACCESS_CACHE_TIME;
        }
        return false;
    }
});

self.addEventListener('install', () => self.skipWaiting())

// 优化 cacheList 的结构和使用方式
const cacheList = {
    static: {
        clean: false,
        match: url => {
            const patterns = [
                /\.(woff2|woff|ttf|cur)$/,
                /\/(pjax\.min|fancybox\.umd\.min|twikoo\.all\.min)\.js$/,
                /\/(all\.min|fancybox\.min)\.css/
            ];
            return patterns.some(pattern => pattern.test(url.pathname));
        }
    }
};

// 优化 replaceList 的结构
const replaceList = [
    {
        source: ['//cdn.jsdelivr.net/gh'],
        dist: '//cdn1.tianli0.top/gh'
    }
];

// 优化 findCache 函数
function findCache(url) {
    try {
        const urlObj = new URL(url);
        return Object.entries(cacheList)
            .find(([_, value]) => value.match(urlObj))?.[1] ?? null;
    } catch {
        return null;
    }
}

/**
 * 检查连接是否需要重定向至另外的链接，如果需要则返回新的Request，否则返回null<br/>
 * 该函数会顺序匹配{@link replaceList}中的所有项目，即使已经有可用的替换项<br/>
 * 故该函数允许重复替换，例如：<br/>
 * 如果第一个匹配项把链接由"http://abc.com/"改为了"https://abc.com/"<br/>
 * 此时第二个匹配项可以以此为基础继续进行修改，替换为"https://abc.net/"<br/>
 */
function replaceRequest(request) {
    return replaceList.reduce((url, { source, dist }) => {
        source.forEach(pattern => {
            url = url.replace(pattern, dist);
        });
        return url;
    }, request.url) !== request.url ? new Request(url) : null;
}

/** 判断是否拦截指定的request */
function blockRequest(request) {
    return false
}

// 优化 fetchEvent 函数
async function fetchEvent(request, response, cacheDist) {
    const NOW_TIME = time();
    
    // 添加请求超时控制
    const fetchWithTimeout = async (req, timeout = 3000) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        try {
            const res = await fetch(req, { signal: controller.signal });
            clearTimeout(timeoutId);
            return res;
        } catch (err) {
            clearTimeout(timeoutId);
            throw err;
        }
    };

    // 优化缓存策略
    const fetchAndCache = async () => {
        try {
            const networkResponse = await fetchWithTimeout(request);
            
            if (networkResponse.ok || networkResponse.status === 0) {
                const cache = await caches.open(CACHE_NAME);
                const clonedResponse = networkResponse.clone();
                
                // 并行处理缓存写入
                await Promise.all([
                    cache.put(request, clonedResponse),
                    dbTime.write(request.url, NOW_TIME),
                    dbAccess.update(request.url)
                ]);
                
                return networkResponse;
            }
            throw new Error('Network response was not ok');
        } catch (err) {
            if (response) return response;
            throw err;
        }
    };

    // 如果有缓存响应且未过期，直接返回
    if (response) {
        const [cachedTime, isAccessValid] = await Promise.all([
            dbTime.read(request.url),
            dbAccess.check(request.url)
        ]);
        
        if (cachedTime && isAccessValid && (NOW_TIME - cachedTime < cacheDist.time)) {
            return response;
        }
    }

    return fetchAndCache();
}

// 优化 fetch 事件监听器
self.addEventListener('fetch', event => {
    const request = replaceRequest(event.request) ?? event.request;
    
    if (blockRequest(request)) {
        event.respondWith(new Response(null, { status: 204 }));
        return;
    }

    const cacheDist = findCache(request.url);
    if (!cacheDist && request === event.request) return;

    event.respondWith((async () => {
        try {
            if (cacheDist) {
                const cachedResponse = await caches.match(request);
                return fetchEvent(request, cachedResponse, cacheDist);
            }
            return fetch(request);
        } catch (err) {
            // 如果有缓存就使用缓存
            const cachedResponse = await caches.match(request);
            if (cachedResponse) return cachedResponse;
            throw err;
        }
    })());
});