const CONFIG = {
  // 基础配置
  workbox: {
    cdnUrl: 'https://storage.googleapis.com/workbox-cdn/releases/7.3.0',
    // cdnUrl: 'https://cdn.jsdelivr.net/npm/workbox-sw@7.0.0/build',
    cacheName: {
      prefix: "冰梦",
      precache: "precache",
      runtime: "runtime"
    }
  },
  
  // 缓存策略配置
  cacheStrategies: {
    // 图片缓存配置
    images: {
      strategy: 'CacheFirst',
      cacheName: 'images',
      maxEntries: 1000,
      maxAgeSeconds: 30 * 24 * 60 * 60, // 30天
      patterns: [
        /\.(?:png|jpg|jpeg|gif|bmp|webp|svg|ico)$/
      ]
    },
    
    // 字体缓存配置
    fonts: {
      strategy: 'CacheFirst',
      cacheName: 'fonts',
      maxEntries: 100,
      maxAgeSeconds: 30 * 24 * 60 * 60, // 30天
      patterns: [
        /\.(?:eot|ttf|woff|woff2)$/
      ]
    },
    
    // 样式缓存配置
    styles: {
      strategy: 'StaleWhileRevalidate',
      cacheName: 'styles',
      maxEntries: 100,
      maxAgeSeconds: 7 * 24 * 60 * 60, // 7天
      patterns: [
        /\.(?:css)$/
      ]
    },
    
    // 脚本缓存配置
    scripts: {
      strategy: 'StaleWhileRevalidate',
      cacheName: 'scripts',
      maxEntries: 100,
      maxAgeSeconds: 7 * 24 * 60 * 60, // 7天
      patterns: [
        /\.(?:js)$/
      ]
    },
    
    // CDN资源缓存配置
    cdn: {
      strategy: 'CacheFirst',
      cacheName: 'cdn-resources',
      maxEntries: 500,
      maxAgeSeconds: 30 * 24 * 60 * 60, // 30天
      patterns: [
        /^https:\/\/cdn\.jsdelivr\.net/,
        /^https:\/\/fastly\.jsdelivr\.net/
      ]
    },
    
    // Google字体缓存配置
    googleFonts: {
      stylesheets: {
        strategy: 'StaleWhileRevalidate',
        cacheName: 'google-fonts-stylesheets',
        patterns: [
          /^https:\/\/fonts\.googleapis\.com/
        ]
      },
      webfonts: {
        strategy: 'CacheFirst',
        cacheName: 'google-fonts-webfonts',
        maxEntries: 100,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30天
        patterns: [
          /^https:\/\/fonts\.gstatic\.com/
        ]
      }
    }
  }
};

// 导入 workbox
importScripts(`${CONFIG.workbox.cdnUrl}/workbox-sw.js`);

// 错误处理
const handleError = error => {
  console.error('[Service Worker] 错误:', error);
};

try {
  // 记录当前使用的 workbox 版本
  console.log(`[Service Worker] Workbox 版本: ${workbox.VERSION}`);
  
  // 基础配置
  workbox.core.setCacheNameDetails(CONFIG.workbox.cacheName);
  workbox.core.skipWaiting();
  workbox.core.clientsClaim();

  // 预缓存配置
  workbox.precaching.precacheAndRoute(self.__WB_MANIFEST, {
    directoryIndex: null
  });
  workbox.precaching.cleanupOutdatedCaches();

  // 注册缓存策略
  Object.entries(CONFIG.cacheStrategies).forEach(([key, config]) => {
    if (key === 'googleFonts') {
      // 特殊处理 Google 字体
      Object.entries(config).forEach(([type, fontConfig]) => {
        fontConfig.patterns.forEach(pattern => {
          workbox.routing.registerRoute(
            pattern,
            new workbox.strategies[fontConfig.strategy]({
              cacheName: fontConfig.cacheName,
              plugins: [
                new workbox.expiration.ExpirationPlugin({
                  maxEntries: fontConfig.maxEntries,
                  maxAgeSeconds: fontConfig.maxAgeSeconds
                }),
                new workbox.cacheableResponse.CacheableResponsePlugin({
                  statuses: [0, 200]
                })
              ].filter(Boolean)
            })
          );
        });
      });
    } else {
      // 处理其他资源
      config.patterns.forEach(pattern => {
        workbox.routing.registerRoute(
          pattern,
          new workbox.strategies[config.strategy]({
            cacheName: config.cacheName,
            plugins: [
              config.maxEntries && new workbox.expiration.ExpirationPlugin({
                maxEntries: config.maxEntries,
                maxAgeSeconds: config.maxAgeSeconds
              }),
              new workbox.cacheableResponse.CacheableResponsePlugin({
                statuses: [0, 200]
              })
            ].filter(Boolean)
          })
        );
      });
    }
  });

  // 添加离线页面支持
  workbox.routing.registerRoute(
    ({ request }) => request.mode === 'navigate',
    new workbox.strategies.NetworkFirst({
      cacheName: 'pages',
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 50,
          maxAgeSeconds: 7 * 24 * 60 * 60 // 7天
        })
      ]
    })
  );

  // 添加API请求缓存
  workbox.routing.registerRoute(
    /\/api\//,
    new workbox.strategies.NetworkFirst({
      cacheName: 'api-cache',
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 50,
          maxAgeSeconds: 5 * 60 // 5分钟
        }),
        new workbox.cacheableResponse.CacheableResponsePlugin({
          statuses: [0, 200]
        })
      ]
    })
  );

  // 初始化 Google Analytics
  workbox.googleAnalytics.initialize({
    parameterOverrides: {
      cd1: 'offline'
    }
  });

} catch (error) {
  handleError(error);
}

// 添加离线功能支持
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CONFIG.workbox.cacheName.runtime).then(cache => {
      return cache.addAll([
        '/offline.html',
        '/404.html'
      ]).catch(handleError);
    })
  );
});

// 处理离线页面
self.addEventListener('fetch', event => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/offline.html');
      })
    );
  }
});