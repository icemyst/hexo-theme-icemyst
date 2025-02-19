var gulp = require('gulp');
var cleanCSS = require('gulp-clean-css');
var htmlMin = require('gulp-html-minifier-terser');
var htmlclean = require('gulp-htmlclean');
var fontmin = require('gulp-fontmin');
var workbox = require("workbox-build");

// gulp-tester
var terser = require('gulp-terser');

gulp.task('generate-service-worker', () => {
  return workbox.injectManifest({
    swSrc: './sw-template.js',
    swDest: './public/sw.js',
    globDirectory: './public',
    globPatterns: [
      // 缓存关键资源
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
  });
});

// 优化压缩任务
gulp.task('compress', async() => {
  gulp.src(['./public/**/*.js', '!./public/**/*.min.js'])
    .pipe(terser({
      compress: {
        sequences: 50,
        unsafe: true,
        unsafe_math: true,
        pure_getters: true,
        ecma: 2020,
        drop_console: true,
        passes: 3,  // 增加优化次数
        pure_funcs: ['console.log', 'console.info', 'console.debug']  // 移除特定console方法
      },
      mangle: {
        toplevel: true
      }
    }))
    .pipe(gulp.dest('./public'));
});
//压缩css
gulp.task('minify-css', () => {
  return gulp.src(['./public/**/*.css'])
    .pipe(cleanCSS({
      compatibility: 'ie11'
    }))
    .pipe(gulp.dest('./public'));
});
// 压缩html
// 参数 doc：https://github.com/terser/html-minifier-terser#readme
gulp.task('minify-html', () =>
    gulp.src('./public/**/*.html')
        .pipe(htmlclean())
        .pipe(htmlMin({
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
        }))
        .pipe(gulp.dest('./public'))
)
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
// 运行gulp命令时依次执行以下任务
gulp.task('default', gulp.series("generate-service-worker", gulp.parallel(
  'compress',
  'minify-css',
  'minify-html'
)));