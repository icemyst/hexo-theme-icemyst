const gulp = require('gulp');
const cleanCSS = require('gulp-clean-css');
const htmlMin = require('gulp-html-minifier-terser');
const htmlclean = require('gulp-htmlclean');
const workbox = require("workbox-build");
const terser = require('gulp-terser');
const chalk = require('chalk');

// 简化日志输出函数
const log = {
  info: msg => console.log(chalk.cyan('│'), chalk.cyan(msg)),
  success: msg => console.log(chalk.green('│'), chalk.green(msg)),
  error: msg => console.error(chalk.red('│'), chalk.red(msg)),
  taskStart: name => console.log(chalk.blue('┌'), chalk.blue(name)),
  taskEnd: () => console.log(chalk.blue('└')),
  stats: (label, value) => console.log(chalk.cyan('│'), chalk.gray(label + ':'), chalk.white(value))
};

// 精简配置对象，只保留必要的压缩选项
const config = {
  sw: {
    swSrc: './sw-template.js',
    swDest: './public/sw.js',
    globDirectory: './public',
    globPatterns: [
      "404.html",
      "index.html",
      "css/index.css",
      "js/main.js",
      "manifest.json"
    ],
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
      pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.warn'],
      module: true,
      toplevel: true
    },
    mangle: { 
      toplevel: true,
      properties: {
        regex: /^_/
      }
    },
    format: {
      comments: false
    }
  },
  html: {
    removeComments: true,                   // 清除html注释
    collapseWhitespace: true,               // 合并空格
    collapseBooleanAttributes: true,        // 压缩布尔类型的 attributes
    noNewlinesBeforeTagClose: false,        // 去掉换行符
    removeAttributeQuotes: true,            // 在可能时删除属性值的引号
    removeRedundantAttributes: true,        // 属性值与默认值一样时删除属性
    removeEmptyAttributes: true,            // 删除值为空的属性
    removeScriptTypeAttributes: true,       // 删除 `type="text/javascript"`
    removeStyleLinkTypeAttributes: true,    // 删除 `type="text/css"`
    minifyJS: true,                         //压缩页面 JS
    minifyCSS: true,                        //压缩页面 CSS
    minifyURLs: true                        //压缩页面URL
  },
  cleanCSS: {
    level: 2,
    mergeIdents: false,
    reduceIdents: false,
    discardUnused: false
  }
};

// 简化文件大小格式化函数
const formatFileSize = bytes => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
};

// 简化压缩任务函数
const createMinifyTask = (taskName, src, processor, dest, successMessage) => {
    gulp.task(taskName, () => {
        const stats = { 
            originalSize: 0, 
            minifiedSize: 0,
            fileCount: 0
        };
        
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
                
                log.success(successMessage || `${taskName}完成`);
                log.stats('文件数', stats.fileCount);
                log.stats('大小', `${formatFileSize(stats.originalSize)} → ${formatFileSize(stats.minifiedSize)} (${sizeChangeMsg})`);
                log.taskEnd();
            });
    });
};

// 简化Service Worker任务
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

// 创建压缩任务
createMinifyTask(
  'compress', 
  ['./public/**/*.js', '!./public/**/*.min.js'], 
  terser(config.terser), 
  './public', 
  'JS压缩完成'
);

createMinifyTask(
  'minify-css', 
  ['./public/**/*.css'], 
  cleanCSS(config.cleanCSS), 
  './public', 
  'CSS压缩完成'
);

createMinifyTask(
  'minify-html', 
  './public/**/*.html', 
  htmlclean().pipe(htmlMin(config.html)), 
  './public', 
  'HTML压缩完成'
);

// 默认任务
gulp.task('default',
  gulp.series(
    'generate-service-worker',
    gulp.parallel('compress', 'minify-css', 'minify-html')
  )
);