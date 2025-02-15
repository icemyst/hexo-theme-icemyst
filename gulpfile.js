//用到的各个插件
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
      // 只缓存关键资源
      "404.html",
      "index.html",
      "js/main.js",
      "css/index.css",
      "manifest.json",
      "img/siteicon/*.{png,ico,svg}",
      // 添加其他关键资源
      "js/utils.js"
    ],
    modifyURLPrefix: {
      "": "./"
    }
  });
});

// 压缩js
gulp.task('compress', async() => {
  gulp.src(['./public/**/*.js', '!./public/**/*.min.js'])
    .pipe(terser({
      compress: {
        /** @see https://blog.csdn.net/weixin_39842528/article/details/81390588 */
        sequences: 50,
        unsafe: true,
        unsafe_math: true,
        pure_getters: true,
        ecma: true
      }
    }))
    .pipe(gulp.dest('./public'))
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
  //   ,'mini-font'
)));