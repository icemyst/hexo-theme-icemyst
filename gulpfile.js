const gulp = require('gulp');
const cleanCSS = require('gulp-clean-css');
const htmlMin = require('gulp-html-minifier-terser');
const workbox = require('workbox-build');
const terser = require('gulp-terser');
const chalk = require('chalk');

// 日志工具
const logger = {
  info: msg => console.log(chalk.cyan(msg)),
  success: msg => console.log(chalk.green('✓ ' + msg)),
  error: msg => console.error(chalk.red('✗ ' + msg))
};

// 配置常量
const CONFIG = {
  paths: {
    public: './public',
    swTemplate: './sw-template.js',
    swDest: './public/sw.js'
  },
  sw: {
    globPatterns: [
      'index.html', 'css/index.css', 'js/main.js', '404.html',
      'manifest.json', 'img/siteicon/favicon.ico'
    ]
  },
  optimization: {
    terser: {
      compress: {
        sequences: 50, unsafe: true, unsafe_math: true, pure_getters: true,
        ecma: true, drop_console: true, module: true, toplevel: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.warn']
      },
      mangle: { toplevel: true, properties: { regex: /^_/ } },
      format: { comments: false }
    },
    html: {
      removeComments: true, collapseWhitespace: true, collapseBooleanAttributes: true,
      removeAttributeQuotes: true, removeRedundantAttributes: true, removeEmptyAttributes: true,
      removeScriptTypeAttributes: true, removeStyleLinkTypeAttributes: true,
      minifyJS: true, minifyCSS: true, minifyURLs: true, processConditionalComments: true
    },
    css: {
      level: {
        1: { all: true },
        2: {
          restructureRules: true, mergeMedia: true, removeEmpty: true,
          mergeSemantically: true, overrideProperties: true
        }
      },
      compatibility: 'ie11'
    }
  }
};

// 工具函数
const formatSize = bytes => {
  if (!bytes) return '0 B';
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), sizes.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
};

const getSizeChangeInfo = (original, minified) => {
  if (original === minified) return '未变化';
  const ratio = Math.abs(((minified - original) / original * 100)).toFixed(2);
  return `${minified > original ? '增大' : '减小'} ${ratio}%`;
};

// 压缩任务工厂
const createMinifyTask = (taskName, src, processor) => {
  return gulp.task(taskName, () => {
    const stats = { originalSize: 0, minifiedSize: 0, fileCount: 0 };
    
    const trackStats = (isOriginal) => (file) => {
      if (!file.isNull()) {
        const size = file.contents.length;
        if (isOriginal) {
          stats.originalSize += size;
          stats.fileCount++;
        } else {
          stats.minifiedSize += size;
        }
      }
    };
    
    return gulp.src(src)
      .on('data', trackStats(true))
      .on('error', function(error) {
        logger.error(`${taskName}失败: ${error.message}`);
        this.emit('end');
      })
      .pipe(processor)
      .pipe(gulp.dest(CONFIG.paths.public))
      .on('data', trackStats(false))
      .on('end', () => {
        const sizeChange = getSizeChangeInfo(stats.originalSize, stats.minifiedSize);
        logger.success(`${taskName}完成: ${stats.fileCount}个文件, ${formatSize(stats.originalSize)} → ${formatSize(stats.minifiedSize)} (${sizeChange})`);
      });
  });
};

// Service Worker 生成任务
gulp.task('generate-service-worker', () => {
  return workbox.injectManifest({
    swSrc: CONFIG.paths.swTemplate,
    swDest: CONFIG.paths.swDest,
    globDirectory: CONFIG.paths.public,
    globPatterns: CONFIG.sw.globPatterns,
    modifyURLPrefix: { '': './' }
  })
    .then(({ count, size }) => 
      logger.success(`Service Worker生成完成: 缓存${count}个文件, ${formatSize(size)}`)
    )
    .catch(err => logger.error(`Service Worker生成失败: ${err}`));
});

// 压缩任务配置和创建
const MINIFY_TASKS = [
  ['compress-js', ['./public/**/*.js', '!./public/**/*.min.js'], terser(CONFIG.optimization.terser)],
  ['minify-css', ['./public/**/*.css'], cleanCSS(CONFIG.optimization.css)],
  ['minify-html', './public/**/*.html', htmlMin(CONFIG.optimization.html)]
];

// 创建所有压缩任务
MINIFY_TASKS.forEach(([name, src, processor]) => createMinifyTask(name, src, processor));

// 默认任务
gulp.task('default', gulp.series(
  'generate-service-worker',
  gulp.parallel('compress-js', 'minify-css', 'minify-html')
));