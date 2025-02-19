const workboxVersion = '7.3.0';
const CACHE_NAME = 'icemystCache';
const VERSION_CACHE_NAME = 'icemystCacheTime';
const MAX_ACCESS_CACHE_TIME = 60 * 60 * 24 * 10;

// 导入 workbox
importScripts(`https://storage.googleapis.com/workbox-cdn/releases/${workboxVersion}/workbox-sw.js`);

// 基础配置
workbox.core.setCacheNameDetails({ prefix: "冰梦" });
workbox.core.skipWaiting();
workbox.core.clientsClaim();

// 预缓存
workbox.precaching.precacheAndRoute(self.__WB_MANIFEST, {
    directoryIndex: null
});
workbox.precaching.cleanupOutdatedCaches();

// 通用缓存策略配置
const commonCacheConfig = {
    plugins: [
        new workbox.expiration.ExpirationPlugin({
            maxEntries: 1000,
            maxAgeSeconds: 60 * 60 * 24 * 30
        }),
        new workbox.cacheableResponse.CacheableResponsePlugin({
            statuses: [0, 200]
        })
    ]
};

// 资源缓存策略
const cacheStrategies = {
    images: {
        regex: /\.(?:png|jpg|jpeg|gif|bmp|webp|svg|ico)$/,
        strategy: 'CacheFirst'
    },
    fonts: {
        regex: /\.(?:eot|ttf|woff|woff2)$/,
        strategy: 'CacheFirst'
    },
    googleFontsCSS: {
        regex: /^https:\/\/fonts\.googleapis\.com/,
        strategy: 'StaleWhileRevalidate'
    },
    googleFontsFiles: {
        regex: /^https:\/\/fonts\.gstatic\.com/,
        strategy: 'CacheFirst'
    },
    staticLibs: {
        regex: /^https:\/\/cdn\.jsdelivr\.net/,
        strategy: 'CacheFirst'
    }
};

// 注册缓存路由
Object.entries(cacheStrategies).forEach(([key, {regex, strategy}]) => {
    workbox.routing.registerRoute(
        regex,
        new workbox.strategies[strategy]({
            cacheName: key,
            ...(strategy === 'CacheFirst' ? { plugins: commonCacheConfig.plugins } : {})
        })
    );
});

// 数据库操作助手
const dbHelper = {
    read: async (key) => {
        try {
            const res = await caches.match(key);
            return res ? await res.text() : null;
        } catch {
            return null;
        }
    },
    write: async (key, value) => {
        try {
            const cache = await caches.open(VERSION_CACHE_NAME);
            await cache.put(key, new Response(value));
        } catch (err) {
            console.error('Cache write failed:', err);
        }
    },
    delete: async (key) => {
        const response = await caches.match(key);
        if (response) {
            const cache = await caches.open(VERSION_CACHE_NAME);
            await cache.delete(key);
        }
    }
};

workbox.googleAnalytics.initialize();

function time() {
    return new Date().getTime()
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

self.addEventListener('install', () => self.skipWaiting())

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
    // 只缓存 GET 请求
    if (request.method !== 'GET') {
        try {
            return await fetch(request);
        } catch (error) {
            console.error('非 GET 请求失败:', error);
            return new Response('请求失败', { status: 503 });
        }
    }

    const NOW_TIME = time();
    try {
        await dbAccess.update(request.url);
    } catch (error) {
        console.warn('更新访问时间失败:', error);
    }

    // 检查缓存是否有效
    if (response) {
        try {
            const cachedTime = await dbTime.read(request.url);
            if (cachedTime && (NOW_TIME - cachedTime < cacheDist.time)) {
                return response;
            }
        } catch (error) {
            console.warn('读取缓存时间失败:', error);
        }
    }

    // 网络请求函数
    const fetchWithTimeout = async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5秒超时

        try {
            const fetchResponse = await fetch(request, {
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (fetchResponse.ok || fetchResponse.status === 0) {
                try {
                    const clone = fetchResponse.clone();
                    const cache = await caches.open(CACHE_NAME);
                    await cache.put(request, clone);
                    await dbTime.write(request.url, NOW_TIME);
                } catch (cacheError) {
                    console.warn('缓存写入失败:', cacheError);
                }
            }

            return fetchResponse;
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    };

    try {
        return await fetchWithTimeout();
    } catch (error) {
        console.error('网络请求失败:', error);
        // 如果有缓存响应，则返回缓存
        if (response) {
            console.log('返回缓存响应');
            return response;
        }
        // 返回错误响应
        return new Response('网络请求失败', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: {
                'Content-Type': 'text/plain;charset=UTF-8'
            }
        });
    }
}

self.addEventListener('fetch', event => {
    const replace = replaceRequest(event.request);
    const request = replace === null ? event.request : replace;
    
    // 跳过非 GET 请求的缓存处理
    if (request.method !== 'GET') {
        event.respondWith(
            fetch(request).catch(error => {
                console.error('非 GET 请求失败:', error);
                return new Response('请求失败', { status: 503 });
            })
        );
        return;
    }

    const cacheDist = findCache(request.url);
    
    if (blockRequest(request)) {
        event.respondWith(new Response(null, { status: 204 }));
        return;
    }

    if (cacheDist !== null) {
        event.respondWith(
            caches.match(request)
                .then(response => fetchEvent(request, response, cacheDist))
                .catch(error => {
                    console.error('缓存匹配失败:', error);
                    return fetch(request).catch(() => 
                        new Response('请求失败', { status: 503 })
                    );
                })
        );
        return;
    }

    if (replace !== null) {
        event.respondWith(
            fetch(request).catch(error => {
                console.error('替换请求失败:', error);
                return fetch(event.request).catch(() => 
                    new Response('请求失败', { status: 503 })
                );
            })
        );
    }
});