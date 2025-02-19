const workboxVersion = '7.3.0';
const CACHE_NAME = 'icemyst-cache-v1';

importScripts(`https://storage.googleapis.com/workbox-cdn/releases/${workboxVersion}/workbox-sw.js`);

workbox.core.setCacheNameDetails({
    prefix: "冰梦",
    suffix: CACHE_NAME
});

workbox.core.skipWaiting();
workbox.core.clientsClaim();

// 清理过期缓存
workbox.precaching.cleanupOutdatedCaches();

// 预缓存核心资源
workbox.precaching.precacheAndRoute(self.__WB_MANIFEST, {
    directoryIndex: null
});

// 图片资源缓存策略
workbox.routing.registerRoute(
    /\.(?:png|jpg|jpeg|gif|bmp|webp|svg|ico)$/,
    new workbox.strategies.CacheFirst({
        cacheName: "images",
        plugins: [
            new workbox.expiration.ExpirationPlugin({
                maxEntries: 1000,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30天
            }),
            new workbox.cacheableResponse.CacheableResponsePlugin({
                statuses: [0, 200]
            })
        ]
    })
);

// 字体文件缓存策略
workbox.routing.registerRoute(
    /\.(?:eot|ttf|woff|woff2)$/,
    new workbox.strategies.CacheFirst({
        cacheName: "fonts",
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

// CDN资源缓存策略
const cdnStrategy = new workbox.strategies.CacheFirst({
    cacheName: "cdn-resources",
    plugins: [
        new workbox.expiration.ExpirationPlugin({
            maxEntries: 1000,
            maxAgeSeconds: 60 * 60 * 24 * 30
        }),
        new workbox.cacheableResponse.CacheableResponsePlugin({
            statuses: [0, 200]
        })
    ]
});

// 处理CDN资源
const cdnHandler = async ({url, request, event}) => {
    // CDN替换规则
    const cdnRules = [
        {
            source: '//cdn.jsdelivr.net/gh',
            target: '//cdn1.tianli0.top/gh'
        }
    ];

    let finalRequest = request;
    for (const rule of cdnRules) {
        if (url.href.includes(rule.source)) {
            const newUrl = url.href.replace(rule.source, rule.target);
            finalRequest = new Request(newUrl, request);
            break;
        }
    }

    return cdnStrategy.handle({request: finalRequest, event});
};

// 注册CDN路由
workbox.routing.registerRoute(
    ({url}) => url.href.includes('cdn.jsdelivr.net') || url.href.includes('cdn1.tianli0.top'),
    cdnHandler
);

// 谷歌字体缓存策略
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

// 初始化Google Analytics
workbox.googleAnalytics.initialize();

// 处理Service Worker消息
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});