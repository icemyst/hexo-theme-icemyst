const gulp = require('gulp');
const cleanCSS = require('gulp-clean-css');
const htmlMin = require('gulp-html-minifier-terser');
const htmlclean = require('gulp-htmlclean');
const fontmin = require('gulp-fontmin');
const workbox = require("workbox-build");
const terser = require('gulp-terser');

// 统一配置
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
      "img/**/*.{png,jpg,jpeg,gif,svg,webp}",
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
      ecma: 2020,
      drop_console: true,
      passes: 3,
      pure_funcs: ['console.log', 'console.info', 'console.debug']
    },
    mangle: { toplevel: true }
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
  }
};

// Service Worker
gulp.task('generate-service-worker', () => workbox.injectManifest(config.sw));

// JS压缩
gulp.task('compress', () => 
  gulp.src(['./public/**/*.js', '!./public/**/*.min.js'])
    .pipe(terser(config.terser))
    .pipe(gulp.dest('./public'))
);

// CSS压缩
gulp.task('minify-css', () => 
  gulp.src(['./public/**/*.css'])
    .pipe(cleanCSS({ compatibility: 'ie11' }))
    .pipe(gulp.dest('./public'))
);

// HTML压缩
gulp.task('minify-html', () => 
  gulp.src('./public/**/*.html')
    .pipe(htmlclean())
    .pipe(htmlMin(config.html))
    .pipe(gulp.dest('./public'))
);

// 字体压缩
const minifyFont = (text, cb) => {
  gulp.src('./public/fonts/*.ttf')
    .pipe(fontmin({ text }))
    .pipe(gulp.dest('./public/fontsdest/'))
    .on('end', cb);
};

gulp.task('mini-font', (cb) => {
  const buffers = [];
  gulp.src(['./public/**/*.html'])
    .on('data', file => buffers.push(file.contents))
    .on('end', () => {
      const text = Buffer.concat(buffers).toString('utf-8');
      minifyFont(text, cb);
    });
});

// 默认任务
gulp.task('default', 
  gulp.series(
    'generate-service-worker',
    gulp.parallel('compress', 'minify-css', 'minify-html')
  )
);