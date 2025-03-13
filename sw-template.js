const workboxVersion = '7.3.0';

importScripts(`https://storage.googleapis.com/workbox-cdn/releases/${workboxVersion}/workbox-sw.js`);

workbox.core.setCacheNameDetails({
    prefix: "冰梦",
    suffix: workboxVersion
});

workbox.core.skipWaiting();

workbox.core.clientsClaim();

// 注册成功后要立即缓存的资源列表
// 具体缓存列表在gulpfile.js中配置，见下文
workbox.precaching.precacheAndRoute(self.__WB_MANIFEST, {
    directoryIndex: null
});

// 清空过期缓存
workbox.precaching.cleanupOutdatedCaches();

// 图片资源（可选，不需要就注释掉）
const cacheFirstConfig = (cacheName, maxEntries = 1000, maxAgeSeconds = 60 * 60 * 24 * 30) => ({
    cacheName,
    plugins: [
        new workbox.expiration.ExpirationPlugin({
            maxEntries,
            maxAgeSeconds
        }),
        new workbox.cacheableResponse.CacheableResponsePlugin({
            statuses: [0, 200]
        })
    ]
});

workbox.routing.registerRoute(
    /\.(?:png|jpg|jpeg|gif|bmp|webp|svg|ico)$/,
    new workbox.strategies.CacheFirst(cacheFirstConfig("images"))
);

// 字体文件（可选，不需要就注释掉）
workbox.routing.registerRoute(
    /\.(?:eot|ttf|woff|woff2)$/,
    new workbox.strategies.CacheFirst(cacheFirstConfig("fonts"))
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
    new workbox.strategies.CacheFirst(cacheFirstConfig('google-fonts-webfonts'))
);

// jsdelivr的CDN资源（可选，不需要就注释掉）
workbox.routing.registerRoute(
    /^https:\/\/cdn\.jsdelivr\.net/,
    new workbox.strategies.CacheFirst(cacheFirstConfig("static-libs"))
);

workbox.googleAnalytics.initialize();

/** 缓存库（数据）名称 */
const CACHE_NAME = 'icemystCache'
/** 缓存库（时间戳）名称 */
const VERSION_CACHE_NAME = 'icemystCacheTime'
/** 缓存离线超时时间（秒） */
const MAX_ACCESS_CACHE_TIME = 60 * 60 * 24 * 10
/** 超时等待时间（毫秒） */
const TIMEOUT_DURATION = 400

/**
 * 获取当前时间戳
 * @returns {number} 当前时间戳
 */
const time = () => new Date().getTime()

/**
 * 缓存数据库辅助函数
 */
const dbHelper = {
    /**
     * 读取缓存数据
     * @param {Request|string} key - 缓存键
     * @returns {Promise<string|null>} 缓存数据
     */
    read: (key) => 
        caches.match(key)
            .then(res => res ? res.text() : null)
            .catch(() => null),
    
    /**
     * 写入缓存数据
     * @param {Request|string} key - 缓存键
     * @param {string} value - 缓存值
     * @returns {Promise<void>}
     */
    write: (key, value) => 
        caches.open(VERSION_CACHE_NAME)
            .then(cache => cache.put(key, new Response(value))),
    
    /**
     * 删除缓存数据
     * @param {Request|string} key - 缓存键
     */
    delete: (key) => 
        caches.match(key)
            .then(response => {
                if (response) {
                    return caches.open(VERSION_CACHE_NAME)
                        .then(cache => cache.delete(key));
                }
            })
}

/**
 * 创建缓存键
 * @param {string} prefix - 前缀
 * @param {string} key - 键名
 * @returns {Request} 请求对象
 */
const createCacheKey = (prefix, key) => new Request(`https://${prefix}/${encodeURIComponent(key)}`)

/** 存储缓存入库时间 */
const dbTime = {
    read: (key) => dbHelper.read(createCacheKey('LOCALCACHE', key)),
    write: (key, value) => dbHelper.write(createCacheKey('LOCALCACHE', key), value),
    delete: (key) => dbHelper.delete(createCacheKey('LOCALCACHE', key))
}

/** 存储缓存最后一次访问的时间 */
const dbAccess = {
    update: (key) => dbHelper.write(createCacheKey('ACCESS-CACHE', key), time()),
    check: async (key) => {
        const realKey = createCacheKey('ACCESS-CACHE', key)
        const value = await dbHelper.read(realKey)
        if (value) {
            dbHelper.delete(realKey)
            return time() - value < MAX_ACCESS_CACHE_TIME * 1000
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
        // 缓存有效时间（秒）
        time: 60 * 60 * 24 * 7, // 7天
        /**
         * 接收一个URL对象，判断是否符合缓存规则
         * @param {URL} url - URL对象
         * @returns {boolean} 是否匹配
         */
        match: url => {
            const pathname = url.pathname;
            return pathname.match(/\.(woff2|woff|ttf|cur)$/) ||
                pathname.match(/\/(pjax\.min|fancybox\.umd\.min|twikoo\.all\.min)\.js$/) ||
                pathname.match(/\/(all\.min|fancybox\.min)\.css/);
        }
    }
}

/**
 * 链接替换列表
 * @param source 源链接
 * @param dist 目标链接
 */
const replaceList = {
    // jsdelivr替换
    jsdelivr: {
        source: ['//cdn.jsdelivr.net/gh', '//cdn.jsdelivr.net/npm'],
        dist: '//cdn1.tianli0.top/gh'
    },
    // 谷歌字体替换为国内镜像
    googlefonts: {
        source: ['//fonts.googleapis.com'],
        dist: '//fonts.loli.net'
    },
    // 谷歌静态资源替换为国内镜像
    googlestatic: {
        source: ['//fonts.gstatic.com'],
        dist: '//gstatic.loli.net'
    },
    // gravatar头像替换为国内镜像
    gravatar: {
        source: ['//www.gravatar.com/avatar'],
        dist: '//gravatar.loli.net/avatar'
    },
    // 知乎图片优化
    zhihu: {
        source: ['//pic1.zhimg.com', '//pic2.zhimg.com', '//pic3.zhimg.com', '//pic4.zhimg.com'],
        dist: '//images.weserv.nl/?url=pic1.zhimg.com'
    }
}

/** 
 * 判断指定url击中了哪一种缓存，都没有击中则返回null 
 * @param {string} url - 请求URL
 * @returns {Object|null} 缓存配置或null
 */
const findCache = (url) => {
    try {
        const urlObj = new URL(url);
        for (const key in cacheList) {
            const value = cacheList[key];
            if (value.match && value.match(urlObj)) return value;
        }
    } catch (e) {
        console.error('URL解析错误:', e);
    }
    return null;
}

/**
 * 检查连接是否需要重定向至另外的链接，如果需要则返回新的Request，否则返回null
 * @param {Request} request - 请求对象
 * @returns {Request|null} 新的请求对象或null
 */
const replaceRequest = (request) => {
    let url = request.url;
    let flag = false;
    
    for (const key in replaceList) {
        const value = replaceList[key];
        for (const source of value.source) {
            if (url.includes(source)) {
                url = url.replace(source, value.dist);
                flag = true;
            }
        }
    }
    
    return flag ? new Request(url, {
        method: request.method,
        headers: request.headers,
        mode: request.mode,
        credentials: request.credentials,
        redirect: request.redirect
    }) : null;
}

/** 
 * 判断是否拦截指定的request 
 * @param {Request} request - 请求对象
 * @returns {boolean} 是否拦截
 */
const blockRequest = () => false;

/**
 * 处理fetch事件
 * @param {Request} request - 请求对象
 * @param {Response} response - 响应对象
 * @param {Object} cacheDist - 缓存配置
 * @returns {Promise<Response>} 响应Promise
 */
const fetchEvent = async (request, response, cacheDist) => {
    const NOW_TIME = time();
    // 更新访问时间
    dbAccess.update(request.url);
    
    const maxTime = cacheDist.time * 1000; // 转换为毫秒
    let useTimeoutRace = false;
    
    // 检查缓存是否有效
    if (response) {
        const cacheTime = await dbTime.read(request.url);
        if (cacheTime && (NOW_TIME - cacheTime < maxTime)) {
            return response;
        }
        useTimeoutRace = true;
    }
    
    // 获取新的响应
    const fetchFunction = () => fetch(request).then(response => {
        // 记录缓存时间
        dbTime.write(request.url, NOW_TIME.toString());
        
        // 只缓存成功的GET请求
        if ((response.ok || response.status === 0) && request.method === 'GET') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        
        return response;
    });
    
    // 如果没有旧响应，直接获取新响应
    if (!useTimeoutRace) return fetchFunction();
    
    // 使用Promise.race确保响应速度
    return Promise.race([
        new Promise(resolve => setTimeout(() => resolve(response), TIMEOUT_DURATION)),
        fetchFunction()
    ]).catch(err => {
        console.error(`请求失败: ${request.url}\n错误: ${err}`);
        return response || new Response('网络请求失败', { status: 408 });
    });
}

/**
 * 处理fetch事件
 */
self.addEventListener('fetch', async event => {
    // 只处理GET请求
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
                    .then(response => fetchEvent(request, response, cacheDist))
                    .catch(err => {
                        console.error(`缓存匹配失败: ${request.url}\n错误: ${err}`);
                        return fetch(request);
                    })
            );
        } else if (replace) {
            event.respondWith(fetch(request));
        }
    } catch (err) {
        console.error(`处理fetch事件失败: ${err}`);
    }
});