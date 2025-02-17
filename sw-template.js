const workboxVersion = '7.3.0';

importScripts(`https://storage.googleapis.com/workbox-cdn/releases/${workboxVersion}/workbox-sw.js`);

// 性能监控配置
const PERFORMANCE_CONFIG = {
    METRICS: {
        CACHE_HIT: 'cache_hit',
        CACHE_MISS: 'cache_miss',
        NETWORK_ERROR: 'network_error'
    },
    MAX_LOGS: 1000
};

// 缓存配置常量
const CACHE_CONFIG = {
    NAMES: {
        MAIN: 'icemystCache',
        VERSION: 'icemystCacheTime',
        METRICS: 'icemystMetrics'
    },
    MAX_AGE: 60 * 60 * 24 * 10, // 10天
    TIMEOUT: 3000 // 3秒超时
};

workbox.core.setCacheNameDetails({
    prefix: "冰梦"
});

workbox.core.skipWaiting();
workbox.core.clientsClaim();

// 注册成功后要立即缓存的资源列表
workbox.precaching.precacheAndRoute(self.__WB_MANIFEST, {
    directoryIndex: null
});

// 清空过期缓存
workbox.precaching.cleanupOutdatedCaches();

// 性能监控类
class PerformanceMonitor {
    constructor() {
        this.metricsCache = new CacheHelper(CACHE_CONFIG.NAMES.METRICS);
    }

    async logMetric(metric, value = 1) {
        try {
            const metrics = JSON.parse(await this.metricsCache.read('metrics') || '{}');
            metrics[metric] = (metrics[metric] || 0) + value;
            await this.metricsCache.write('metrics', JSON.stringify(metrics));

            // 定期清理旧的指标数据
            if (Object.keys(metrics).length > PERFORMANCE_CONFIG.MAX_LOGS) {
                const sortedMetrics = Object.entries(metrics)
                    .sort(([,a], [,b]) => b - a)
                    .slice(0, PERFORMANCE_CONFIG.MAX_LOGS);
                await this.metricsCache.write('metrics', JSON.stringify(Object.fromEntries(sortedMetrics)));
            }
        } catch (error) {
            console.error('性能指标记录失败:', error);
        }
    }
}

// 缓存策略工厂
class CacheStrategyFactory {
    static createStrategy(config) {
        return new workbox.strategies.CacheFirst({
            cacheName: config.cacheName,
            plugins: [
                new workbox.expiration.ExpirationPlugin({
                    maxEntries: config.maxEntries || 1000,
                    maxAgeSeconds: config.maxAgeSeconds || 60 * 60 * 24 * 30
                }),
                new workbox.cacheableResponse.CacheableResponsePlugin({
                    statuses: [0, 200]
                })
            ]
        });
    }
}

// 注册缓存路由
const registerCacheRoutes = () => {
    // 图片资源
    workbox.routing.registerRoute(
        /\.(?:png|jpg|jpeg|gif|bmp|webp|svg|ico)$/,
        CacheStrategyFactory.createStrategy({ cacheName: 'images' })
    );

    // 字体文件
    workbox.routing.registerRoute(
        /\.(?:eot|ttf|woff|woff2)$/,
        CacheStrategyFactory.createStrategy({ cacheName: 'fonts' })
    );

    // 谷歌字体
    workbox.routing.registerRoute(
        /^https:\/\/fonts\.googleapis\.com/,
        new workbox.strategies.StaleWhileRevalidate({
            cacheName: "google-fonts-stylesheets"
        })
    );
    workbox.routing.registerRoute(
        /^https:\/\/fonts\.gstatic\.com/,
        CacheStrategyFactory.createStrategy({ cacheName: 'google-fonts-webfonts' })
    );

    // jsdelivr的CDN资源
    workbox.routing.registerRoute(
        /^https:\/\/cdn\.jsdelivr\.net/,
        CacheStrategyFactory.createStrategy({ cacheName: 'static-libs' })
    );
};

// 初始化路由
registerCacheRoutes();
workbox.googleAnalytics.initialize();

function time() {
    return Date.now();
}

class CacheHelper {
    constructor(cacheName) {
        this.cacheName = cacheName;
        this.cache = null;
    }

    async getCache() {
        if (!this.cache) {
            this.cache = await caches.open(this.cacheName);
        }
        return this.cache;
    }

    createKey(key) {
        return `https://${this.cacheName}/${encodeURIComponent(key)}`;
    }

    async read(key) {
        try {
            const cache = await this.getCache();
            const response = await cache.match(this.createKey(key));
            return response ? await response.text() : null;
        } catch (error) {
            console.error('缓存读取错误:', error);
            return null;
        }
    }

    async write(key, value) {
        try {
            const cache = await this.getCache();
            const response = new Response(String(value));
            await cache.put(this.createKey(key), response);
            return true;
        } catch (error) {
            console.error('缓存写入错误:', error);
            return false;
        }
    }

    async delete(key) {
        try {
            const cache = await this.getCache();
            await cache.delete(this.createKey(key));
            return true;
        } catch (error) {
            console.error('缓存删除错误:', error);
            return false;
        }
    }
}

// 初始化缓存管理器和性能监控
const cacheManagers = {
    time: new CacheHelper(CACHE_CONFIG.NAMES.VERSION),
    access: new CacheHelper(CACHE_CONFIG.NAMES.MAIN)
};
const performanceMonitor = new PerformanceMonitor();

async function handleFetch(request, cachedResponse, cacheConfig) {
    const currentTime = time();
    
    const networkPromise = fetch(request).then(async response => {
        if (response.ok || response.status === 0) {
            const cache = await caches.open(CACHE_CONFIG.NAMES.MAIN);
            const clonedResponse = response.clone();
            await cache.put(request, clonedResponse);
            await cacheManagers.time.write(request.url, currentTime);
            await performanceMonitor.logMetric(PERFORMANCE_CONFIG.METRICS.CACHE_MISS);
        }
        return response;
    }).catch(async error => {
        await performanceMonitor.logMetric(PERFORMANCE_CONFIG.METRICS.NETWORK_ERROR);
        throw error;
    });

    if (!cachedResponse) {
        return networkPromise;
    }

    const cachedTime = await cacheManagers.time.read(request.url);
    if (cachedTime && (currentTime - parseInt(cachedTime, 10)) < cacheConfig.time) {
        await performanceMonitor.logMetric(PERFORMANCE_CONFIG.METRICS.CACHE_HIT);
        return cachedResponse;
    }

    const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Network timeout')), CACHE_CONFIG.TIMEOUT)
    );

    return Promise.race([networkPromise, timeoutPromise])
        .catch(async () => {
            await performanceMonitor.logMetric(PERFORMANCE_CONFIG.METRICS.NETWORK_ERROR);
            return cachedResponse;
        });
}

// 优化的CDN替换配置
const CDN_CONFIG = {
    REPLACEMENTS: [
        {
            source: '//cdn.jsdelivr.net/npm',
            target: '//jsd.onmicrosoft.cn/npm'
        },
        {
            source: '//cdn.jsdelivr.net/gh',
            target: '//jsd.onmicrosoft.cn/gh'
        }
    ]
};

// 缓存配置
const cacheList = {
    static: {
        clean: false,
        time: 60 * 60 * 24 * 30,
        match: url => {
            const pathname = url.pathname;
            return pathname.match(/\.(woff2|woff|ttf|cur)$/) ||
                   pathname.match(/\/(pjax\.min|fancybox\.umd\.min|twikoo\.all\.min)\.js$/) ||
                   pathname.match(/\/(all\.min|fancybox\.min)\.css/);
        }
    }
};

function findCache(url) {
    try {
        const urlObj = new URL(url);
        return Object.values(cacheList).find(config => config.match(urlObj)) || null;
    } catch (error) {
        console.error('URL解析失败:', error);
        return null;
    }
}

function replaceRequest(request) {
    let url = request.url;
    
    for (const { source, target } of CDN_CONFIG.REPLACEMENTS) {
        if (url.includes(source)) {
            url = url.replace(source, target);
            return new Request(url);
        }
    }
    
    return null;
}

function blockRequest(request) {
    // 可以在这里添加请求拦截逻辑
    return false;
}

// 优化的fetch事件监听器
self.addEventListener('fetch', event => {
    const request = event.request;
    
    if (request.method !== 'GET') return;

    const replacedRequest = replaceRequest(request);
    if (replacedRequest) {
        event.respondWith(fetch(replacedRequest));
        return;
    }

    if (blockRequest(request)) {
        event.respondWith(new Response(null, { status: 204 }));
        return;
    }

    const cacheConfig = findCache(request.url);
    if (cacheConfig) {
        event.respondWith(
            caches.match(request)
                .then(cachedResponse => handleFetch(request, cachedResponse, cacheConfig))
                .catch(() => fetch(request))
        );
    }
});