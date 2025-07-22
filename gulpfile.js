const gulp = require('gulp');
const cleanCSS = require('gulp-clean-css');
const htmlMin = require('gulp-html-minifier-terser');
const htmlclean = require('gulp-htmlclean');
const workbox = require("workbox-build");
const terser = require('gulp-terser');
const chalk = require('chalk');

// 日志输出工具
const logger = {
  styles: {
    info: { prefix: '│ ', color: chalk.cyan },
    success: { prefix: '│ ', color: chalk.green },
    error: { prefix: '│ ', color: chalk.red },
    start: { prefix: '┌ ', color: chalk.blue },
    end: { prefix: '└', color: chalk.blue }
  },
  
  log(type, msg) {
    const { prefix, color } = this.styles[type];
    const output = type === 'error' ? console.error : console.log;
    output(color(prefix) + color(msg));
  },
  
  info(msg) { this.log('info', msg) },
  success(msg) { this.log('success', msg) },
  error(msg) { this.log('error', msg) },
  taskStart(name) { this.log('start', name) },
  taskEnd() { this.log('end', '') },
  stats(label, value) { console.log(chalk.cyan('│ ') + chalk.gray(label + ':') + ' ' + chalk.white(value)) }
};

// 配置对象
const CONFIG = {
  paths: {
    public: './public',
    swTemplate: './sw-template.js',
    swDest: './public/sw.js'
  },
  sw: {
    globPatterns: [
      "index.html", 
      "css/index.css", 
      "js/main.js",
      "404.html",
      "manifest.json",
      "img/siteicon/favicon.ico"
    ]
  },
  optimization: {
    terser: {
      compress: {
        sequences: 50, 
        unsafe: true, 
        unsafe_math: true, 
        pure_getters: true,
        ecma: true, 
        drop_console: true, 
        module: true, 
        toplevel: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.warn']
      },
      mangle: { toplevel: true, properties: { regex: /^_/ } },
      format: { comments: false }
    },
    html: {
      removeComments: true, 
      collapseWhitespace: true, 
      collapseBooleanAttributes: true,
      removeAttributeQuotes: true, 
      removeRedundantAttributes: true, 
      removeEmptyAttributes: true,
      removeScriptTypeAttributes: true, 
      removeStyleLinkTypeAttributes: true,
      minifyJS: true, 
      minifyCSS: true, 
      minifyURLs: true, 
      processConditionalComments: true
    },
    css: {
      level: {
        1: { all: true },
        2: { 
          restructureRules: true, 
          mergeMedia: true, 
          removeEmpty: true, 
          mergeSemantically: true, 
          overrideProperties: true 
        }
      }, 
      compatibility: 'ie11'
    }
  }
};

// 工具函数
const utils = {
  formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), sizes.length - 1);
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  },
  
  getSizeChangeInfo(original, minified) {
    if (original === minified) return '未变化';
    const ratio = ((minified - original) / original * 100).toFixed(2);
    return minified > original ? `增大 ${Math.abs(ratio)}%` : `减小 ${Math.abs(ratio)}%`;
  }
};

// 通用压缩任务工厂
function createMinifyTask(taskName, src, processor) {
  gulp.task(taskName, () => {
    const stats = { originalSize: 0, minifiedSize: 0, fileCount: 0 };
    logger.taskStart(taskName);
    
    return gulp.src(src)
      .on('data', file => {
        if (!file.isNull()) {
          stats.originalSize += file.contents.length;
          stats.fileCount++;
        }
      })
      .on('error', error => {
        logger.error(`错误: ${error.message}`);
        this.emit('end');
      })
      .pipe(processor)
      .pipe(gulp.dest(CONFIG.paths.public))
      .on('data', file => {
        if (!file.isNull()) stats.minifiedSize += file.contents.length;
      })
      .on('end', () => {
        const sizeChange = utils.getSizeChangeInfo(stats.originalSize, stats.minifiedSize);
        
        logger.success(`${taskName}完成`);
        logger.stats('文件数', stats.fileCount);
        logger.stats('大小', `${utils.formatSize(stats.originalSize)} → ${utils.formatSize(stats.minifiedSize)} (${sizeChange})`);
        logger.taskEnd();
      });
  });
}

// Service Worker生成任务
gulp.task('generate-service-worker', () => {
  logger.taskStart('生成Service Worker');
  
  return workbox.injectManifest({
    swSrc: CONFIG.paths.swTemplate,
    swDest: CONFIG.paths.swDest,
    globDirectory: CONFIG.paths.public,
    globPatterns: CONFIG.sw.globPatterns,
    modifyURLPrefix: { "": "./" }
  })
    .then(({count, size}) => {
      logger.success('Service Worker生成成功');
      logger.stats('预缓存', `${count}个文件, ${utils.formatSize(size)}`);
      logger.taskEnd();
    })
    .catch(err => {
      logger.error(`生成失败: ${err}`);
      logger.taskEnd();
    });
});

// 创建资源压缩任务
[
  {
    name: 'compress-js',
    src: ['./public/**/*.js', '!./public/**/*.min.js'],
    processor: terser(CONFIG.optimization.terser)
  },
  {
    name: 'minify-css',
    src: ['./public/**/*.css'],
    processor: cleanCSS(CONFIG.optimization.css)
  },
  {
    name: 'minify-html',
    src: './public/**/*.html',
    processor: htmlMin(CONFIG.optimization.html)
  }
].forEach(({ name, src, processor }) => createMinifyTask(name, src, processor));

// 默认任务
gulp.task('default', gulp.series(
  'generate-service-worker',
  gulp.parallel('compress-js', 'minify-css', 'minify-html')
));