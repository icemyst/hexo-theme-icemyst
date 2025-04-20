const gulp = require('gulp');
const cleanCSS = require('gulp-clean-css');
const htmlMin = require('gulp-html-minifier-terser');
const htmlclean = require('gulp-htmlclean');
const workbox = require("workbox-build");
const terser = require('gulp-terser');
const chalk = require('chalk');

// 日志输出函数
const log = {
  info: msg => console.log(chalk.cyan('│'), chalk.cyan(msg)),
  success: msg => console.log(chalk.green('│'), chalk.green(msg)),
  error: msg => console.error(chalk.red('│'), chalk.red(msg)),
  taskStart: name => console.log(chalk.blue('┌'), chalk.blue(name)),
  taskEnd: () => console.log(chalk.blue('└')),
  stats: (label, value) => console.log(chalk.cyan('│'), chalk.gray(label + ':'), chalk.white(value))
};

// 配置对象
const config = {
  sw: {
    swSrc: './sw-template.js',
    swDest: './public/sw.js',
    globDirectory: './public',
    globPatterns: ["404.html", "index.html", "css/index.css", "js/main.js", "manifest.json"],
    modifyURLPrefix: { "": "./" }
  },
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
    noNewlinesBeforeTagClose: false, removeAttributeQuotes: true, removeRedundantAttributes: true, 
    removeEmptyAttributes: true,removeScriptTypeAttributes: true, removeStyleLinkTypeAttributes: true,
    minifyJS: true, minifyCSS: true, minifyURLs: true
  },
  cleanCSS: {
    level: 2, mergeIdents: false, reduceIdents: false, discardUnused: false
  }
};

// 文件大小格式化
const formatFileSize = bytes => {
  if (bytes === 0) return '0 B';
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
};

// 通用压缩任务工厂
const createMinifyTask = (taskName, src, processor, dest) => {
  gulp.task(taskName, () => {
    const stats = { originalSize: 0, minifiedSize: 0, fileCount: 0 };
    log.taskStart(taskName);
    
    return gulp.src(src)
      .on('data', file => {
        if (!file.isNull()) {
          stats.originalSize += file.contents.length;
          stats.fileCount++;
        }
      })
      .on('error', error => {
        log.error(`错误: ${error.message}`);
        this.emit('end');
      })
      .pipe(processor)
      .pipe(gulp.dest(dest || './public'))
      .on('data', file => {
        if (!file.isNull()) {
          stats.minifiedSize += file.contents.length;
        }
      })
      .on('end', () => {
        const ratio = ((stats.minifiedSize - stats.originalSize) / stats.originalSize * 100).toFixed(2);
        const sizeChangeMsg = stats.minifiedSize === stats.originalSize ? '未变化' :
          stats.minifiedSize > stats.originalSize ? `增大 ${Math.abs(ratio)}%` :
          `减小 ${Math.abs(ratio)}%`;
        
        log.success(`${taskName}完成`);
        log.stats('文件数', stats.fileCount);
        log.stats('大小', `${formatFileSize(stats.originalSize)} → ${formatFileSize(stats.minifiedSize)} (${sizeChangeMsg})`);
        log.taskEnd();
      });
  });
};

// Service Worker生成任务
gulp.task('generate-service-worker', () => {
  log.taskStart('generate-service-worker');
  return workbox.injectManifest(config.sw)
    .then(({count, size}) => {
      log.success('Service Worker生成成功');
      log.stats('预缓存', `${count}个文件, ${formatFileSize(size)}`);
      log.taskEnd();
    })
    .catch(err => {
      log.error(`生成失败: ${err}`);
      log.taskEnd();
    });
});

// 创建各类资源压缩任务
createMinifyTask(
  'compress', 
  ['./public/**/*.js', '!./public/**/*.min.js'], 
  terser(config.terser), 
  './public'
);

createMinifyTask(
  'minify-css', 
  ['./public/**/*.css'], 
  cleanCSS(config.cleanCSS), 
  './public'
);

createMinifyTask(
  'minify-html', 
  './public/**/*.html', 
  htmlclean().pipe(htmlMin(config.html)), 
  './public'
);

// 默认任务
gulp.task('default', gulp.series(
  'generate-service-worker',
  gulp.parallel('compress', 'minify-css', 'minify-html')
));