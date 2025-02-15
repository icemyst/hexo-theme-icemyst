const workboxVersion = '7.3.0';

importScripts(`https://storage.googleapis.com/workbox-cdn/releases/${workboxVersion}/workbox-sw.js`);

workbox.core.setCacheNameDetails({
    prefix: "冰梦"
});

workbox.core.skipWaiting();

workbox.core.clientsClaim();

// 预缓存
workbox.precaching.precacheAndRoute(self.__WB_MANIFEST,{
    directoryIndex: null
});

workbox.precaching.cleanupOutdatedCaches();

// 运行时缓存策略
const staticAssets = new workbox.strategies.CacheFirst({
    cacheName: "static-assets",
    plugins: [
        new workbox.expiration.ExpirationPlugin({
            maxEntries: 1000,
            maxAgeSeconds: 60 * 60 * 24 * 30 // 30天
        }),
        new workbox.cacheableResponse.CacheableResponsePlugin({
            statuses: [0, 200]
        })
    ]
});

// 静态资源缓存
workbox.routing.registerRoute(
    /\.(?:png|jpg|jpeg|gif|bmp|webp|svg|ico|eot|ttf|woff|woff2)$/,
    staticAssets
);

// CDN资源缓存
workbox.routing.registerRoute(
    /^https:\/\/(cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com)/,
    staticAssets
);

// 页面导航采用 NetworkFirst 策略
workbox.routing.registerRoute(
    ({request}) => request.mode === 'navigate',
    new workbox.strategies.NetworkFirst({
        cacheName: 'pages',
        plugins: [
            new workbox.expiration.ExpirationPlugin({
                maxEntries: 50
            })
        ]
    })
);

// 消息处理
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

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

const dbHelper = {
    read: (key) => {
        return new Promise((resolve) => {
            caches.match(key).then(function (res) {
                if (!res) resolve(null)
                res.text().then(text => resolve(text))
            }).catch(() => {
                resolve(null)
            })
        })
    },
    write: (key, value) => {
        return new Promise((resolve, reject) => {
            caches.open(VERSION_CACHE_NAME).then(function (cache) {
                // noinspection JSIgnoredPromiseFromCall
                cache.put(key, new Response(value));
                resolve()
            }).catch(() => {
                reject()
            })
        })
    },
    delete: (key) => {
        caches.match(key).then(response => {
            if (response) caches.open(VERSION_CACHE_NAME).then(cache => cache.delete(key))
        })
    }
}

/** 存储缓存入库时间 */
const dbTime = {
    read: (key) => dbHelper.read(new Request(`https://LOCALCACHE/${encodeURIComponent(key)}`)),
    write: (key, value) => dbHelper.write(new Request(`https://LOCALCACHE/${encodeURIComponent(key)}`), value),
    delete: (key) => dbHelper.delete(new Request(`https://LOCALCACHE/${encodeURIComponent(key)}`))
}

/** 存储缓存最后一次访问的时间 */
const dbAccess = {
    update: (key) => dbHelper.write(new Request(`https://ACCESS-CACHE/${encodeURIComponent(key)}`), time()),
    check: async (key) => {
        const realKey = new Request(`https://ACCESS-CACHE/${encodeURIComponent(key)}`)
        const value = await dbHelper.read(realKey)
        if (value) {
            dbHelper.delete(realKey)
            return time() - value < MAX_ACCESS_CACHE_TIME
        } else return false
    }
}

/**
 * 缓存列表
 * @param url 匹配规则
 * @param time 缓存有效时间
 * @param clean 清理缓存时是否无视最终访问时间直接删除
 */
const cacheList = {
    /* 样例 */
    static: {
        // 标记在删除所有缓存时是否移除该缓存
        clean: false,
        /**
         * 接收一个URL对象，判断是否符合缓存规则
         * @param url {URL}
         */
        match: url => run(url.pathname, it => it.match(/\.(woff2|woff|ttf|cur)$/) ||
            it.match(/\/(pjax\.min|fancybox\.umd\.min|twikoo\.all\.min)\.js$/) ||
            it.match(/\/(all\.min|fancybox\.min)\.css/)
        )
    }
}

/**
 * 链接替换列表
 * @param source 源链接
 * @param dist 目标链接
 */
const replaceList = {
    simple: {
        source: ['//cdn.jsdelivr.net/gh'],
        dist: '//cdn1.tianli0.top/gh'
    }
}

/** 判断指定url击中了哪一种缓存，都没有击中则返回null */
function findCache(url) {
    for (let key in cacheList) {
        const value = cacheList[key]
        if (url.match(value.url)) return value
    }
    return null
}

/**
 * 检查连接是否需要重定向至另外的链接，如果需要则返回新的Request，否则返回null<br/>
 * 该函数会顺序匹配{@link replaceList}中的所有项目，即使已经有可用的替换项<br/>
 * 故该函数允许重复替换，例如：<br/>
 * 如果第一个匹配项把链接由"http://abc.com/"改为了"https://abc.com/"<br/>
 * 此时第二个匹配项可以以此为基础继续进行修改，替换为"https://abc.net/"<br/>
 */
function replaceRequest(request) {
    let url = request.url;
    let flag = false
    for (let key in replaceList) {
        const value = replaceList[key]
        for (let source of value.source) {
            if (url.match(source)) {
                url = url.replace(source, value.dist)
                flag = true
            }
        }
    }
    return flag ? new Request(url) : null
}

/** 判断是否拦截指定的request */
function blockRequest(request) {
    return false
}

async function fetchEvent(request, response, cacheDist) {
    try {
        // 只缓存 GET 请求
        if (request.method !== 'GET') {
            return fetch(request);
        }

        const NOW_TIME = time()
        await dbAccess.update(request.url)

        // 如果有缓存响应，先检查是否过期
        if (response) {
            const cachedTime = await dbTime.read(request.url)
            if (cachedTime && (NOW_TIME - cachedTime < cacheDist.time)) {
                return response
            }
        }

        // 尝试从网络获取
        try {
            const networkResponse = await fetch(request)
            if (networkResponse.ok || networkResponse.status === 0) {
                // 只缓存 GET 请求的响应
                if (request.method === 'GET') {
                    const clone = networkResponse.clone()
                    caches.open(CACHE_NAME).then(cache => cache.put(request, clone))
                    await dbTime.write(request.url, NOW_TIME)
                }
                return networkResponse
            }
        } catch (networkError) {
            console.log('网络请求失败，使用缓存:', request.url)
        }

        // 如果网络请求失败且有缓存，返回缓存
        if (response) {
            return response
        }

        // 如果既没有网络也没有缓存，返回错误响应
        return new Response('Network error happened', {
            status: 408,
            headers: new Headers({
                'Content-Type': 'text/plain'
            })
        })
    } catch (error) {
        console.error('Fetch event error:', error)
        return new Response('Service Worker Error', {
            status: 500,
            headers: new Headers({
                'Content-Type': 'text/plain'
            })
        })
    }
}

self.addEventListener('fetch', event => {
    const replace = replaceRequest(event.request)
    const request = replace === null ? event.request : replace
    
    // 对于非 GET 请求，直接发送到网络
    if (request.method !== 'GET') {
        event.respondWith(fetch(request))
        return
    }

    const cacheDist = findCache(request.url)

    if (blockRequest(request)) {
        event.respondWith(new Response(null, {status: 204}))
    } else if (cacheDist !== null) {
        event.respondWith(
            caches.match(request)
                .then(response => fetchEvent(request, response, cacheDist))
                .catch(error => {
                    console.error('Fetch handler error:', error)
                    return new Response('Service Worker Error', {
                        status: 500,
                        headers: new Headers({
                            'Content-Type': 'text/plain'
                        })
                    })
                })
        )
    } else if (replace !== null) {
        event.respondWith(
            fetch(request).catch(error => {
                console.error('Replace request error:', error)
                return new Response('Network error', {
                    status: 408,
                    headers: new Headers({
                        'Content-Type': 'text/plain'
                    })
                })
            })
        )
    }
})
