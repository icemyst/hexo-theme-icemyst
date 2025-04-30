const gulp = require('gulp');
const cleanCSS = require('gulp-clean-css');
const htmlMin = require('gulp-html-minifier-terser');
const htmlclean = require('gulp-htmlclean');
const workbox = require("workbox-build");
const terser = require('gulp-terser');
const chalk = require('chalk');
// const fs = require('fs');
// const path = require('path');
// const imagemin = require('gulp-imagemin');

// 日志输出工具
const log = (() => {
  const prefix = {
    info: chalk.cyan('│ '),
    success: chalk.green('│ '),
    error: chalk.red('│ '),
    start: chalk.blue('┌ '),
    end: chalk.blue('└')
  };
  
  return {
    info: msg => console.log(prefix.info + chalk.cyan(msg)),
    success: msg => console.log(prefix.success + chalk.green(msg)),
    error: msg => console.error(prefix.error + chalk.red(msg)),
    taskStart: name => console.log(prefix.start + chalk.blue(name)),
    taskEnd: () => console.log(prefix.end),
    stats: (label, value) => console.log(prefix.info + chalk.gray(label + ':') + ' ' + chalk.white(value))
  };
})();

// 配置对象
const config = {
  sw: {
    swSrc: './sw-template.js',
    swDest: './public/sw.js',
    globDirectory: './public',
    modifyURLPrefix: { "": "./" }
  },
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
    minifyURLs: true
  },
  cleanCSS: {
    level: 2, 
    compatibility: 'ie11', 
    mergeIdents: false, 
    reduceIdents: false, 
    discardUnused: false
  }
};

// 工具函数
const utils = {
  // 文件大小格式化
  formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), sizes.length - 1);
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  },
  
  // 计算压缩比率信息
  getSizeChangeInfo(original, minified) {
    if (original === minified) return '未变化';
    const ratio = ((minified - original) / original * 100).toFixed(2);
    return minified > original ? `增大 ${Math.abs(ratio)}%` : `减小 ${Math.abs(ratio)}%`;
  }
};

// 通用压缩任务工厂
const createMinifyTask = (taskName, src, processor, dest = './public') => {
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
      .pipe(gulp.dest(dest))
      .on('data', file => {
        if (!file.isNull()) stats.minifiedSize += file.contents.length;
      })
      .on('end', () => {
        const sizeChange = utils.getSizeChangeInfo(stats.originalSize, stats.minifiedSize);
        
        log.success(`${taskName}完成`);
        log.stats('文件数', stats.fileCount);
        log.stats('大小', `${utils.formatSize(stats.originalSize)} → ${utils.formatSize(stats.minifiedSize)} (${sizeChange})`);
        log.taskEnd();
      });
  });
};

// Service Worker生成任务
gulp.task('generate-service-worker', () => {
  log.taskStart('生成Service Worker');
  
  // 优化预缓存的文件列表，只缓存核心资源
  const globPatterns = [
    "index.html", 
    "css/index.css", 
    "js/main.js",
    "404.html",
    "manifest.json",
    "img/siteicon/favicon.ico"
  ];
  
  return workbox.injectManifest({
    ...config.sw,
    globPatterns
  })
    .then(({count, size}) => {
      log.success('Service Worker生成成功');
      log.stats('预缓存', `${count}个文件, ${utils.formatSize(size)}`);
      log.taskEnd();
    })
    .catch(err => {
      log.error(`生成失败: ${err}`);
      log.taskEnd();
    });
});

// 创建资源压缩任务
[
  ['compress', ['./public/**/*.js', '!./public/**/*.min.js'], terser(config.terser)],
  ['minify-css', ['./public/**/*.css'], cleanCSS(config.cleanCSS)],
  ['minify-html', './public/**/*.html', htmlclean().pipe(htmlMin(config.html))]
].forEach(([name, src, processor]) => createMinifyTask(name, src, processor));

// 图片优化任务（当前禁用）
// 当需要图片优化时，请取消下面代码的注释并安装imagemin依赖
// gulp.task('optimize-images', () => {
//   log.taskStart('optimize-images');
//   return gulp.src('./public/img/**/*.{jpg,png,gif,svg}')
//     .pipe(imagemin([
//       imagemin.mozjpeg({ quality: 80, progressive: true }),
//       imagemin.optipng({ optimizationLevel: 5 }),
//       imagemin.gifsicle({ interlaced: true }),
//       imagemin.svgo()
//     ]))
//     .pipe(gulp.dest('./public/img'))
//     .on('end', () => {
//       log.success('图像优化完成');
//       log.taskEnd();
//     });
// });

// 默认任务
gulp.task('default', gulp.series(
  'generate-service-worker',
  gulp.parallel('compress', 'minify-css', 'minify-html')
));