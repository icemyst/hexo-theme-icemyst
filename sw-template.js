const workboxVersion = '7.3.0';

importScripts(`https://storage.googleapis.com/workbox-cdn/releases/${workboxVersion}/workbox-sw.js`);

// 将配置对象合并和规范化
const CONFIG = {
    core: {
        prefix: "冰梦",
        suffix: workboxVersion,
        cacheNames: {
            main: 'icemystCache',
            version: 'icemystCacheTime'
        }
    },
    cache: {
        maxAccessTime: 60 * 60 * 24 * 10,
        timeouts: {
            DEFAULT: 3000,
            IMAGE: 3000,
            FONT: 5000
        }
    }
};

workbox.core.setCacheNameDetails({
    prefix: CONFIG.core.prefix,
    suffix: CONFIG.core.suffix
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

// 资源路由配置优化
const RESOURCE_ROUTES = {
    images: {
        pattern: /\.(?:png|jpg|jpeg|gif|bmp|webp|svg|ico)$/,
        strategy: 'CacheFirst',
        config: {
            maxEntries: 200,
            maxAge: 60 * 60 * 24 * 30
        }
    },
    fonts: {
        pattern: /\.(?:eot|ttf|woff|woff2)$/,
        strategy: 'CacheFirst',
        config: {
            maxEntries: 20,
            maxAge: 60 * 60 * 24 * 30
        }
    },
    staticResources: {
        pattern: /^https:\/\/fonts\.(?:googleapis\.com|gstatic\.com)|cdn\.jsdelivr\.net/,
        strategy: 'StaleWhileRevalidate',
        config: {
            maxEntries: 50,
            maxAge: 60 * 60 * 24 * 30
        }
    }
};

// 注册路由的优化方法
Object.entries(RESOURCE_ROUTES).forEach(([key, { pattern, strategy, config }]) => {
    workbox.routing.registerRoute(
        pattern,
        new workbox.strategies[strategy](
            createCacheConfig(key, config.maxEntries, config.maxAge)
        )
    );
});

// API 缓存配置
workbox.routing.registerRoute(
    /\/api\//,
    new workbox.strategies.StaleWhileRevalidate({
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
            const cache = await caches.open(CONFIG.core.cacheNames.version);
            await cache.put(key, new Response(value));
        } catch (error) {
            dbHelper.handleError('write', error);
        }
    },
    delete: async (key) => {
        try {
            const response = await caches.match(key);
            if (response) {
                const cache = await caches.open(CONFIG.core.cacheNames.version);
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
            return time() - value < CONFIG.cache.maxAccessTime * 1000;
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

const replaceRequest = (request) => {
    const url = request.url;
    
    // 使用Map优化查找效率
    const replacements = new Map(
        Object.entries(replaceList).map(([key, value]) => [
            value.source,
            value.dist
        ])
    );

    for (const [sources, dist] of replacements) {
        if (sources.some(source => url.includes(source))) {
            const newUrl = url.replace(
                new RegExp(sources.join('|')),
                dist
            );
            
            return new Request(newUrl, {
                method: request.method,
                headers: request.headers,
                mode: request.mode,
                credentials: request.credentials,
                redirect: request.redirect
            });
        }
    }
    
    return null;
};

// 统一的错误处理工具
const ErrorHandler = {
    createErrorResponse: (type, message) => {
        const options = {
            status: 408,
            headers: type === 'FONT' ? {
                'Content-Type': 'text/plain',
                'Cache-Control': 'no-store'
            } : {}
        };
        return new Response(message, options);
    },
    
    logError: (context, error) => {
        console.error(`[${context}] Error:`, error);
    }
};

// 获取事件处理
const handleFetchResponse = async (request, response, cacheDist) => {
    const NOW_TIME = time();
    await dbAccess.update(request.url);

    const getResourceType = (url) => {
        if (url.match(/\.(png|jpg|jpeg|gif|bmp|webp|svg|ico)$/i)) return 'IMAGE';
        if (url.match(/\.(eot|ttf|woff|woff2)$/i)) return 'FONT';
        return 'DEFAULT';
    };

    const resourceType = getResourceType(request.url);
    const timeoutDuration = CONFIG.cache.timeouts[resourceType];
    const maxTime = cacheDist.time * 1000;

    const fetchAndCache = async () => {
        const newResponse = await fetch(request);
        if (newResponse.ok && request.method === 'GET') {
            await Promise.all([
                dbTime.write(request.url, NOW_TIME.toString()),
                caches.open(CONFIG.core.cacheNames.main)
                    .then(cache => cache.put(request, newResponse.clone()))
            ]);
        }
        return newResponse;
    };

    if (response) {
        const cacheTime = await dbTime.read(request.url);
        if (cacheTime && (NOW_TIME - cacheTime < maxTime)) {
            return response;
        }
    }

    try {
        return await Promise.race([
            fetchAndCache(),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('请求超时')), timeoutDuration)
            )
        ]);
    } catch (error) {
        ErrorHandler.logError('handleFetchResponse', error);
        if (response) return response;
        
        return ErrorHandler.createErrorResponse(
            resourceType,
            resourceType === 'FONT' ? '字体加载失败' : '资源加载失败'
        );
    }
};

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('fetch', async event => {
    if (event.request.method !== 'GET') return;

    try {
        const replace = replaceRequest(event.request);
        const request = replace || event.request;
        const cacheDist = findCache(request.url);

        if (cacheDist) {
            event.respondWith(
                caches.match(request)
                    .then(response => handleFetchResponse(request, response, cacheDist))
                    .catch(error => {
                        console.error('Cache match failed:', error);
                        return fetch(request);
                    })
            );
        } else if (replace) {
            event.respondWith(fetch(request));
        }
    } catch (error) {
        console.error('获取事件处理错误:', error);
    }
});