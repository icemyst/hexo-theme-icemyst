const workboxVersion = '7.3.0';

importScripts(`https://storage.googleapis.com/workbox-cdn/releases/${workboxVersion}/workbox-sw.js`);

// Core configuration
const CORE_CONFIG = {
    prefix: "冰梦",
    suffix: workboxVersion,
    CACHE_NAME: 'icemystCache',
    VERSION_CACHE_NAME: 'icemystCacheTime',
    MAX_ACCESS_CACHE_TIME: 60 * 60 * 24 * 10,
    TIMEOUT_DURATION: 400
};

workbox.core.setCacheNameDetails({
    prefix: CORE_CONFIG.prefix,
    suffix: CORE_CONFIG.suffix
});

workbox.core.skipWaiting();
workbox.core.clientsClaim();

// 预缓存配置
workbox.precaching.precacheAndRoute(self.__WB_MANIFEST, {
    directoryIndex: null
});
workbox.precaching.cleanupOutdatedCaches();

// Common cache configuration factory
const createCacheConfig = (cacheName, maxEntries = 500, maxAgeSeconds = 60 * 60 * 24 * 7) => ({
    cacheName,
    plugins: [
        new workbox.expiration.ExpirationPlugin({
            maxEntries,
            maxAgeSeconds,
            purgeOnQuotaError: true
        }),
        new workbox.cacheableResponse.CacheableResponsePlugin({
            statuses: [0, 200]
        }),
        new workbox.rangeRequests.RangeRequestsPlugin()
    ]
});

// 资源路由配置
const resourceRoutes = [
    {
        pattern: /\.(?:png|jpg|jpeg|gif|bmp|webp|svg|ico)$/,
        config: createCacheConfig("images")
    },
    {
        pattern: /\.(?:eot|ttf|woff|woff2)$/,
        config: createCacheConfig("fonts", 50, 60 * 60 * 24 * 30)
    },
    {
        pattern: /^https:\/\/fonts\.googleapis\.com/,
        strategy: 'StaleWhileRevalidate',
        config: { cacheName: "google-fonts-stylesheets" }
    },
    {
        pattern: /^https:\/\/fonts\.gstatic\.com/,
        config: createCacheConfig('google-fonts-webfonts')
    },
    {
        pattern: /^https:\/\/cdn\.jsdelivr\.net/,
        config: createCacheConfig("static-libs")
    }
];

// Register routes
resourceRoutes.forEach(({ pattern, strategy = 'CacheFirst', config }) => {
    workbox.routing.registerRoute(
        pattern,
        new workbox.strategies[strategy](config)
    );
});

// API 缓存配置
workbox.routing.registerRoute(
    /\/api\//,
    new workbox.strategies.NetworkFirst({
        cacheName: 'api-cache',
        plugins: [
            new workbox.expiration.ExpirationPlugin({
                maxEntries: 50,
                maxAgeSeconds: 60 * 60
            }),
            new workbox.cacheableResponse.CacheableResponsePlugin({
                statuses: [0, 200]
            })
        ]
    })
);

workbox.googleAnalytics.initialize();

// Helper functions
const time = () => new Date().getTime();
const createCacheKey = (prefix, key) => new Request(`https://${prefix}/${encodeURIComponent(key)}`);

// Database helper with unified error handling
const dbHelper = {
    handleError: (operation, error) => {
        console.error(`Database ${operation} failed:`, error);
        return null;
    },
    read: async (key) => {
        try {
            const res = await caches.match(key);
            return res ? await res.text() : null;
        } catch (error) {
            return dbHelper.handleError('read', error);
        }
    },
    write: async (key, value) => {
        try {
            const cache = await caches.open(CORE_CONFIG.VERSION_CACHE_NAME);
            await cache.put(key, new Response(value));
        } catch (error) {
            dbHelper.handleError('write', error);
        }
    },
    delete: async (key) => {
        try {
            const response = await caches.match(key);
            if (response) {
                const cache = await caches.open(CORE_CONFIG.VERSION_CACHE_NAME);
                await cache.delete(key);
            }
        } catch (error) {
            dbHelper.handleError('delete', error);
        }
    }
};

// 数据库接口
const dbTime = {
    read: (key) => dbHelper.read(createCacheKey('LOCALCACHE', key)),
    write: (key, value) => dbHelper.write(createCacheKey('LOCALCACHE', key), value),
    delete: (key) => dbHelper.delete(createCacheKey('LOCALCACHE', key))
};

const dbAccess = {
    update: (key) => dbHelper.write(createCacheKey('ACCESS-CACHE', key), time()),
    check: async (key) => {
        const realKey = createCacheKey('ACCESS-CACHE', key);
        const value = await dbHelper.read(realKey);
        if (value) {
            await dbHelper.delete(realKey);
            return time() - value < CORE_CONFIG.MAX_ACCESS_CACHE_TIME * 1000;
        }
        return false;
    }
};

// URL 替换配置
const replaceList = {
    jsdelivr: {
        source: ['//cdn.jsdelivr.net/gh'],
        dist: '//cdn1.tianli0.top/gh'
    },
    npm: {
        source: ['//cdn.jsdelivr.net/npm'],
        dist: '//npm.elemecdn.com'
    },
    googlefonts: {
        source: ['//fonts.googleapis.com'],
        dist: '//fonts.loli.net'
    },
    googlestatic: {
        source: ['//fonts.gstatic.com'],
        dist: '//gstatic.loli.net'
    },
    gravatar: {
        source: ['//www.gravatar.com/avatar'],
        dist: '//gravatar.loli.net/avatar'
    },
    // zhihu: {
    //     source: ['//pic1.zhimg.com', '//pic2.zhimg.com', '//pic3.zhimg.com', '//pic4.zhimg.com'],
    //     dist: '//images.weserv.nl/?url=pic1.zhimg.com'
    // },
    smms: {
        source: ['//s2.loli.net'],
        dist: '//image.baidu.com/search/down?url=https://s2.loli.net'
    },
    Github: {
        source: ['//raw.githubusercontent.com'],
        dist: '//raw.gitmirror.com'

    }
};

// 缓存配置
const cacheList = {
    static: {
        clean: false,
        time: 60 * 60 * 24 * 7,
        match: url => {
            const pathname = url.pathname;
            return pathname.match(/\.(woff2|woff|ttf|cur)$/) ||
                   pathname.match(/\/(pjax\.min|fancybox\.umd\.min|twikoo\.all\.min)\.js$/) ||
                   pathname.match(/\/(all\.min|fancybox\.min)\.css/);
        }
    }
};

// URL 处理函数
const findCache = (url) => {
    try {
        const urlObj = new URL(url);
        return Object.values(cacheList).find(value => value.match?.(urlObj)) || null;
    } catch (error) {
        console.error('URL 解析错误:', error);
        return null;
    }
};

const replaceRequest = (request) => {
    let url = request.url;
    let isModified = false;

    Object.values(replaceList).forEach(({ source, dist }) => {
        source.forEach(src => {
            if (url.includes(src)) {
                url = url.replace(src, dist);
                isModified = true;
            }
        });
    });

    return isModified ? new Request(url, {
        method: request.method,
        headers: request.headers,
        mode: request.mode,
        credentials: request.credentials,
        redirect: request.redirect
    }) : null;
};

const blockRequest = () => false;

// 获取事件处理
const handleFetchResponse = async (request, response, cacheDist) => {
    const NOW_TIME = time();
    await dbAccess.update(request.url);

    const maxTime = cacheDist.time * 1000;
    
    if (response) {
        const cacheTime = await dbTime.read(request.url);
        if (cacheTime && (NOW_TIME - cacheTime < maxTime)) {
            return response;
        }
    }

    const fetchAndCache = async () => {
        const newResponse = await fetch(request);
        if ((newResponse.ok || newResponse.status === 0) && request.method === 'GET') {
            await dbTime.write(request.url, NOW_TIME.toString());
            const clone = newResponse.clone();
            const cache = await caches.open(CORE_CONFIG.CACHE_NAME);
            await cache.put(request, clone);
        }
        return newResponse;
    };

    return response ? 
        Promise.race([
            new Promise(resolve => setTimeout(() => resolve(response), CORE_CONFIG.TIMEOUT_DURATION)),
            fetchAndCache()
        ]).catch(() => response) :
        fetchAndCache().catch(() => new Response('网络请求失败', { status: 408 }));
};

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('fetch', async event => {
    if (event.request.method !== 'GET') return;

    try {
        const replace = replaceRequest(event.request);
        const request = replace || event.request;
        const cacheDist = findCache(request.url);

        if (blockRequest(request)) {
            event.respondWith(new Response(null, { status: 204 }));
        } else if (cacheDist) {
            event.respondWith(
                caches.match(request)
                    .then(response => handleFetchResponse(request, response, cacheDist))
                    .catch(() => fetch(request))
            );
        } else if (replace) {
            event.respondWith(fetch(request));
        }
    } catch (error) {
        console.error('获取事件处理错误:', error);
    }
});