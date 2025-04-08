const gulp = require('gulp');
const cleanCSS = require('gulp-clean-css');
const htmlMin = require('gulp-html-minifier-terser');
const htmlclean = require('gulp-htmlclean');
const workbox = require("workbox-build");
const terser = require('gulp-terser');
const chalk = require('chalk');

// 日志系统
const log = {
  info: msg => console.log(chalk.cyan('→ ') + msg),
  success: msg => console.log(chalk.green('✓ ') + msg),
  error: msg => console.error(chalk.red('✗ ') + msg),
  stats: (orig, comp) => console.log(
    chalk.blue('  ') + 
    `${formatSize(orig)} → ${formatSize(comp)} (${((1 - comp / orig) * 100).toFixed(1)}%)`
  )
};

// 格式化文件大小
const formatSize = bytes => {
  if (bytes < 1) return '0 B';
  const units = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
};

// 构建配置
const config = {
  sw: {
    swSrc: './sw-template.js',
    swDest: './public/sw.js',
    globDirectory: './public',
    globPatterns: [
      "index.html",
      "css/index.css",
      "js/main.js",
      "404.html"
    ],
    modifyURLPrefix: { "": "./" }
  },
  terser: {
    compress: {
      sequences: 50,
      unsafe: true,
      drop_console: true
    },
    mangle: true
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
  cleanCSS: { level: 2 }
};

// 通用压缩任务创建器
const createMinifyTask = (name, src, processor) => {
  gulp.task(name, () => {
    let size = { before: 0, after: 0 };
    const startTime = Date.now();

    log.info(`开始 ${name} 任务...`);
    return gulp.src(src, { base: './public' })
      .on('data', file => file.contents && (size.before += file.contents.length))
      .pipe(processor)
      .on('data', file => file.contents && (size.after += file.contents.length))
      .pipe(gulp.dest('./public'))
      .on('end', () => {
        const time = Date.now() - startTime;
        log.success(`${name} 完成 (${time}ms)`);
        log.stats(size.before, size.after);
      });
  });
};

// 生成Service Worker
gulp.task('service-worker', () => {
  log.info('正在生成 Service Worker...');
  return workbox.injectManifest(config.sw)
    .then(({count, size, warnings}) => {
      if (warnings.length) {
        warnings.forEach(warning => console.warn(warning));
      }
      log.success('Service Worker 生成成功');
      log.stats(0, size);
    })
    .catch(err => log.error(`Service Worker 生成失败: ${err}`));
});

// 注册压缩任务
createMinifyTask('minify-js', ['./public/**/*.js', '!./public/**/*.min.js'], terser(config.terser));
createMinifyTask('minify-css', ['./public/**/*.css'], cleanCSS(config.cleanCSS));
createMinifyTask('minify-html', ['./public/**/*.html'], htmlclean().pipe(htmlMin(config.html)));

// 默认任务
gulp.task('default', gulp.series(
  'service-worker', 
  gulp.parallel('minify-js', 'minify-css', 'minify-html')
));