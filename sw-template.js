const workboxVersion = '7.3.0';

importScripts(`https://storage.googleapis.com/workbox-cdn/releases/${workboxVersion}/workbox-sw.js`);

// Workbox 核心配置
workbox.core.setCacheNameDetails({
    prefix: "冰梦"
});
workbox.core.skipWaiting();
workbox.core.clientsClaim();

// 预缓存配置（资源列表在gulpfile.js中配置）
workbox.precaching.precacheAndRoute(self.__WB_MANIFEST, {
    directoryIndex: null
});
workbox.precaching.cleanupOutdatedCaches();

// Workbox 路由配置
// 通用缓存配置
const commonCacheConfig = {
    maxEntries: 1000,
    maxAgeSeconds: 60 * 60 * 24 * 30 // 30天
};

const cacheFirstWithExpiration = (cacheName) => {
    return new workbox.strategies.CacheFirst({
        cacheName: cacheName,
        plugins: [
            new workbox.expiration.ExpirationPlugin(commonCacheConfig),
            new workbox.cacheableResponse.CacheableResponsePlugin({
                statuses: [0, 200]
            })
        ]
    });
};

// 批量注册缓存路由
const cacheRoutes = [
    { pattern: /\.(?:png|jpg|jpeg|gif|bmp|webp|svg|ico)$/, cacheName: "images" },
    { pattern: /\.(?:eot|ttf|woff|woff2)$/, cacheName: "fonts" },
    { pattern: /^https:\/\/fonts\.gstatic\.com/, cacheName: "google-fonts-webfonts" },
    { pattern: /^https:\/\/cdn\.jsdelivr\.net/, cacheName: "static-libs" }
];

cacheRoutes.forEach(({ pattern, cacheName }) => {
    workbox.routing.registerRoute(pattern, cacheFirstWithExpiration(cacheName));
});

// 谷歌字体样式表使用不同策略
workbox.routing.registerRoute(
    /^https:\/\/fonts\.googleapis\.com/,
    new workbox.strategies.StaleWhileRevalidate({
        cacheName: "google-fonts-stylesheets"
    })
);

// 初始化Google Analytics离线支持
workbox.googleAnalytics.initialize();

// ===== 自定义缓存系统配置 =====
/** 缓存库（数据）名称 */
const CACHE_NAME = 'icemystCache'
/** 缓存库（时间戳）名称 */
const VERSION_CACHE_NAME = 'icemystCacheTime'
/** 缓存离线超时时间（10天） */
const MAX_ACCESS_CACHE_TIME = 60 * 60 * 24 * 10

// 获取当前时间戳
const time = () => new Date().getTime();

// 缓存数据库辅助函数
const dbHelper = {
    read: (key) => {
        return new Promise((resolve) => {
            caches.match(key).then(function (res) {
                if (!res) resolve(null);
                res.text().then(text => resolve(text));
            }).catch(() => {
                resolve(null);
            });
        });
    },
    write: (key, value) => {
        return new Promise((resolve, reject) => {
            caches.open(VERSION_CACHE_NAME).then(function (cache) {
                cache.put(key, new Response(value));
                resolve();
            }).catch(() => {
                reject();
            });
        });
    },
    delete: (key) => {
        caches.match(key).then(response => {
            if (response) caches.open(VERSION_CACHE_NAME).then(cache => cache.delete(key));
        });
    }
}

// 辅助函数：创建虚拟请求URL
const createVirtualRequest = (prefix, key) => new Request(`https://${prefix}/${encodeURIComponent(key)}`);

/** 存储缓存入库时间 */
const dbTime = {
    read: (key) => dbHelper.read(createVirtualRequest('LOCALCACHE', key)),
    write: (key, value) => dbHelper.write(createVirtualRequest('LOCALCACHE', key), value),
    delete: (key) => dbHelper.delete(createVirtualRequest('LOCALCACHE', key))
};

/** 存储缓存最后一次访问的时间 */
const dbAccess = {
    update: (key) => dbHelper.write(createVirtualRequest('ACCESS-CACHE', key), time()),
    check: async (key) => {
        const realKey = createVirtualRequest('ACCESS-CACHE', key);
        const value = await dbHelper.read(realKey);
        if (value) {
            dbHelper.delete(realKey);
            return time() - value < MAX_ACCESS_CACHE_TIME;
        } 
        return false;
    }
}

// Service Worker 安装事件（Workbox已处理，这里是自定义部分的补充）
self.addEventListener('install', () => self.skipWaiting());

/**
 * 自定义缓存配置列表
 * @typedef {Object} CacheConfig
 * @property {RegExp} url - 匹配规则（正则表达式）
 * @property {number} time - 缓存有效时间（秒）
 * @property {boolean} clean - 清理缓存时是否无视最终访问时间直接删除
 */
const DAY = 60 * 60 * 24;
const cacheList = {
    images: { url: /\.(?:png|jpg|jpeg|gif|bmp|webp|svg|ico)$/, time: DAY * 30, clean: false },
    assets: { url: /\.(?:css|js)$/, time: DAY * 7, clean: true },
    fonts: { url: /\.(?:woff|woff2|eot|ttf|otf)$/, time: DAY * 30, clean: false },
    data: { url: /\.json$/, time: DAY, clean: true },
    pages: { url: /\.(?:html|xml)$/, time: DAY / 2, clean: true }
};

/**
 * 链接替换配置列表（用于CDN回源等场景）
 * @typedef {Object} ReplaceConfig
 * @property {string[]} source - 源链接匹配模式数组
 * @property {string} dist - 目标链接替换模式
 */
const replaceList = {
    sample: { source: ['//s2.loli.net'], dist: '//images.weserv.nl/?url=s2.loli.net' },
    googleFonts: { source: ['//fonts.googleapis.com', '//fonts.gstatic.com'], dist: '//fonts.loli.net' },
    gravatar: { source: ['//www.gravatar.com/avatar', '//secure.gravatar.com/avatar'], dist: '//gravatar.loli.net/avatar' },
    github: { source: ['//raw.githubusercontent.com'], dist: '//cdn.jsdelivr.net/gh' },
    npm: { source: ['//unpkg.com'], dist: '//cdn.jsdelivr.net/npm' },
    jsdelivr: { source: ['//cdn.jsdelivr.net/gh'], dist: '//cdn.jsdmirror.cn/gh'}
}

/**
 * 判断指定url匹配哪一种缓存配置，都没有匹配则返回null
 * @param {string} url - 请求URL
 * @returns {CacheConfig|null} 匹配的缓存配置或null
 */
const findCache = (url) => {
    for (const key in cacheList) {
        const value = cacheList[key];
        if (url.match(value.url)) return value;
    }
    return null;
};

/**
 * 检查连接是否需要重定向至另外的链接
 * @param {Request} request - 原始请求
 * @returns {Request|null} 新的请求对象或null（不需要替换）
 * 
 * 该函数会顺序匹配replaceList中的所有项目，支持链式替换
 * 例如：http://abc.com/ → https://abc.com/ → https://abc.net/
 * @see {ReplaceConfig}
 */
const replaceRequest = (request) => {
    let url = request.url;
    let flag = false;
    
    for (const key in replaceList) {
        const value = replaceList[key];
        for (const source of value.source) {
            if (url.match(source)) {
                url = url.replace(source, value.dist);
                flag = true;
            }
        }
    }
    
    return flag ? new Request(url) : null;
};

/**
 * 判断是否拦截指定的request
 * @param {Request} request - 请求对象
 * @returns {boolean} 是否拦截
 */
const blockRequest = (request) => {
    // 可在此添加拦截规则
    return false;
}

/**
 * 处理自定义缓存的请求
 * @param {Request} request - 请求对象
 * @param {Response} response - 缓存的响应（如果有）
 * @param {CacheConfig} cacheDist - 缓存配置
 * @returns {Promise<Response>} 响应对象
 * @see {CacheConfig}
 */
async function fetchEvent(request, response, cacheDist) {
    const NOW_TIME = time();
    // 更新访问时间
    dbAccess.update(request.url);
    const maxTime = cacheDist.time;
    let remove = false;
    
    // 检查缓存是否有效
    if (response) {
        const cachedTime = await dbTime.read(request.url);
        if (cachedTime) {
            const difTime = NOW_TIME - cachedTime;
            // 如果缓存未过期，直接返回
            if (difTime < maxTime) return response;
        }
        remove = true;
    }
    
    // 网络请求函数
    const fetchFunction = () => fetch(request).then(response => {
        // 记录缓存时间
        dbTime.write(request.url, NOW_TIME);
        
        // 如果响应正常则缓存
        // status为0的情况可能出现在某些跨域请求或特殊响应中
        if (response.ok || response.status === 0) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
    });
    
    // 如果不需要移除旧缓存，直接获取新数据
    if (!remove) return fetchFunction();
    
    // 如果需要移除旧缓存，设置超时竞速，优先使用缓存数据
    const timeOut = () => new Promise(resolve => setTimeout(() => resolve(response), 400));
    
    return Promise.race([
        timeOut(),
        fetchFunction()
    ]).catch(err => console.error(`不可达的链接：${request.url}\n错误信息：${err}`));
}

/**
 * Service Worker 的 fetch 事件处理
 * 处理所有网络请求，根据配置决定是否使用缓存或替换请求
 */
self.addEventListener('fetch', async event => {
    // 检查是否需要替换请求URL（例如CDN回源）
    const replace = replaceRequest(event.request);
    const request = replace === null ? event.request : replace;
    
    // 检查是否匹配自定义缓存规则
    const cacheDist = findCache(request.url);
    
    // 处理请求的三种情况
    if (blockRequest(request)) {
        // 1. 拦截请求（返回空响应）
        event.respondWith(new Response(null, {status: 204}));
    } else if (cacheDist !== null) {
        // 2. 使用自定义缓存策略处理请求
        event.respondWith(caches.match(request)
            .then(async (response) => fetchEvent(request, response, cacheDist))
        );
    } else if (replace !== null) {
        // 3. 使用替换后的URL发起请求
        event.respondWith(fetch(request));
    }
    // 其他情况由浏览器默认处理
})