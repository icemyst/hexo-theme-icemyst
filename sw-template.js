const workboxVersion = '7.4.0';

importScripts(`https://storage.googleapis.com/workbox-cdn/releases/${workboxVersion}/workbox-sw.js`);

workbox.core.setCacheNameDetails({
    prefix: "icemyst"
});

workbox.core.skipWaiting();

workbox.core.clientsClaim();

// 注册成功后要立即缓存的资源列表
// 具体缓存列表在gulpfile.js中配置
workbox.precaching.precacheAndRoute(self.__WB_MANIFEST, {
    directoryIndex: null
});

// 清空过期缓存
workbox.precaching.cleanupOutdatedCaches();

/**
 * CDN 链接替换配置
 * 移植自原有的 replaceList
 */
const replaceList = {
    jsdelivr: {
        source: ['//cdn.jsdelivr.net/gh'],
        dist: '//cdn.jsdmirror.cn/gh'
    },
    jsdelivr2: {
        source: ['//jsd.onmicrosoft.cn/gh'],
        dist: '//cdn.jsdmirror.cn/gh'
    },
    npm: {
        source: ['//cdn.jsdelivr.net/npm'],
        dist: '//cdn.jsdmirror.cn/npm'
    },
    cdnjs: {
        source: ['//cdnjs.cloudflare.com/ajax/libs'],
        dist: '//cdnjs.loli.net/ajax/libs'
    },
    SMMS: {
        source: ['//s2.loli.net'],
        dist: '//wsrv.nl/?url=s2.loli.net'
    }
};

/**
 * 执行 URL 替换逻辑
 * @param {string} url 原始 URL
 * @returns {string} 替换后的 URL
 */
function replaceUrl(url) {
    let newUrl = url;
    for (let key in replaceList) {
        const value = replaceList[key];
        for (let source of value.source) {
            if (newUrl.includes(source.replace(/^\/\//, ''))) {
                newUrl = newUrl.replace(source, value.dist);
            }
        }
    }
    return newUrl;
}

// 注册 CDN 替换路由
workbox.routing.registerRoute(
    ({ url }) => {
        const currentUrl = url.href;
        const newUrl = replaceUrl(currentUrl);
        return currentUrl !== newUrl;
    },
    async ({ request, event }) => {
        const newUrl = replaceUrl(request.url);
        const newRequest = new Request(newUrl, {
            headers: request.headers,
            mode: 'cors',
            credentials: 'omit',
            redirect: request.redirect
        });

        // 使用 CacheFirst 策略缓存替换后的资源
        const strategy = new workbox.strategies.CacheFirst({
            cacheName: "static-libs-mirror",
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

        return strategy.handle({ event, request: newRequest });
    }
);

// 图片资源（可选，不需要就注释掉）
workbox.routing.registerRoute(
    /\.(?:png|jpg|jpeg|gif|bmp|webp|svg|ico)$/,
    new workbox.strategies.CacheFirst({
        cacheName: "images",
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

// 字体文件（可选，不需要就注释掉）
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