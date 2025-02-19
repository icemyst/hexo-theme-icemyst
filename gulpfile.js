const gulp = require('gulp');
const cleanCSS = require('gulp-clean-css');
const htmlMin = require('gulp-html-minifier-terser');
const htmlclean = require('gulp-htmlclean');
const fontmin = require('gulp-fontmin');
const workbox = require("workbox-build");
const terser = require('gulp-terser');

// Service Worker 配置
const swConfig = {
  swSrc: './sw-template.js',
  swDest: './public/sw.js',
  globDirectory: './public',
  globPatterns: [
    "404.html",
    "index.html",
    "css/index.css",
    "js/main.js",
    "img/**/*.{png,jpg,jpeg,gif,svg,webp}",
    "manifest.json"
  ],
  modifyURLPrefix: {
    "": "./"
  }
};

// Terser 配置
const terserConfig = {
  compress: {
    sequences: 50,
    unsafe: true,
    unsafe_math: true,
    pure_getters: true,
    ecma: 2020,
    drop_console: true,
    passes: 3,
    pure_funcs: ['console.log', 'console.info', 'console.debug']
  },
  mangle: {
    toplevel: true
  }
};

// HTML 压缩配置
const htmlMinConfig = {
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
};

// 任务定义
gulp.task('generate-service-worker', () => {
  return workbox.injectManifest(swConfig);
});

gulp.task('compress', () => {
  return gulp.src(['./public/**/*.js', '!./public/**/*.min.js'])
    .pipe(terser(terserConfig))
    .pipe(gulp.dest('./public'));
});

gulp.task('minify-css', () => {
  return gulp.src(['./public/**/*.css'])
    .pipe(cleanCSS({ compatibility: 'ie11' }))
    .pipe(gulp.dest('./public'));
});

gulp.task('minify-html', () => {
  return gulp.src('./public/**/*.html')
    .pipe(htmlclean())
    .pipe(htmlMin(htmlMinConfig))
    .pipe(gulp.dest('./public'));
});


//压缩字体
function minifyFont(text, cb) {
  gulp
    .src('./public/fonts/*.ttf') //原字体所在目录
    .pipe(fontmin({
      text: text
    }))
    .pipe(gulp.dest('./public/fontsdest/')) //压缩后的输出目录
    .on('end', cb);
}

gulp.task('mini-font', (cb) => {
  var buffers = [];
  gulp
    .src(['./public/**/*.html']) //HTML文件所在目录请根据自身情况修改
    .on('data', function(file) {
      buffers.push(file.contents);
    })
    .on('end', function() {
      var text = Buffer.concat(buffers).toString('utf-8');
      minifyFont(text, cb);
    });
});

// 默认任务
gulp.task('default',
  gulp.series(
    'generate-service-worker',
    gulp.parallel(
      'compress',
      'minify-css',
      'minify-html'
    )
  )
);