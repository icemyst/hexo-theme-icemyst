const gulp = require('gulp');
const cleanCSS = require('gulp-clean-css');
const htmlMin = require('gulp-html-minifier-terser');
const htmlclean = require('gulp-htmlclean');
const fontmin = require('gulp-fontmin');
const workbox = require("workbox-build");
const terser = require('gulp-terser');
const chalk = require('chalk');

// 统一的日志输出函数
const log = {
  info: (msg) => console.log(chalk.cyan('ℹ'), chalk.cyan(msg)),
  success: (msg) => console.log(chalk.green('✔'), chalk.green(msg)),
  error: (msg) => console.error(chalk.red('✘'), chalk.red(msg)),
  warning: (msg) => console.warn(chalk.yellow('⚠'), chalk.yellow(msg))
};

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
      // "img/**/*.{png,jpg,jpeg,gif,svg,webp}",
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
    .on('error', (error) => log.error(`JS压缩错误: ${error.message}`))
    .pipe(terser(config.terser))
    .pipe(gulp.dest('./public'))
    .on('end', () => log.success('JS压缩完成'))
);

// CSS压缩
gulp.task('minify-css', () => 
  gulp.src(['./public/**/*.css'])
    .on('error', (error) => log.error(`CSS压缩错误: ${error.message}`))
    .pipe(cleanCSS({ compatibility: 'ie11', level: 2 }))
    .pipe(gulp.dest('./public'))
    .on('end', () => log.success('CSS压缩完成'))
);

// HTML压缩
gulp.task('minify-html', () => 
  gulp.src('./public/**/*.html')
    .on('error', (error) => log.error(`HTML压缩错误: ${error.message}`))
    .pipe(htmlclean())
    .pipe(htmlMin(config.html))
    .pipe(gulp.dest('./public'))
    .on('end', () => log.success('HTML压缩完成'))
);

// 字体压缩
const minifyFont = (text, cb) => {
  const fs = require('fs');
  const path = require('path');
  const fontsDir = './public/fonts';
  const fontsDest = './public/fontsdest';
  
  try {
    // 检查字体目录是否存在
    if (!fs.existsSync(fontsDir)) {
      log.warning('字体目录不存在，跳过字体压缩');
      return cb();
    }
    
    // 检查目标目录是否存在，不存在则创建
    if (!fs.existsSync(fontsDest)) {
      fs.mkdirSync(fontsDest, { recursive: true });
    }
    
    // 获取所有TTF文件
    const ttfFiles = fs.readdirSync(fontsDir)
      .filter(file => path.extname(file).toLowerCase() === '.ttf');
    
    if (ttfFiles.length === 0) {
      log.warning('没有找到.ttf字体文件，跳过字体压缩');
      return cb();
    }
    
    let completedFonts = 0;
    let hasErrors = false;
    
    // 处理每个字体文件
    ttfFiles.forEach(fontFile => {
      const fontPath = path.join(fontsDir, fontFile);
      
      gulp.src(fontPath)
        .on('error', (error) => {
          log.error(`字体文件 ${fontFile} 压缩错误: ${error.message}`);
          hasErrors = true;
          if (++completedFonts === ttfFiles.length) {
            cb(); // 所有字体都处理完成后调用回调
          }
        })
        .pipe(fontmin({ 
          text,
          quiet: false
        }))
        .on('error', (error) => {
          log.error(`字体文件 ${fontFile} 处理失败: ${error.message}`);
          hasErrors = true;
          if (++completedFonts === ttfFiles.length) {
            cb(); // 所有字体都处理完成后调用回调
          }
        })
        .pipe(gulp.dest(fontsDest))
        .on('end', () => {
          log.success(`字体文件 ${fontFile} 压缩完成`);
          if (++completedFonts === ttfFiles.length) {
            if (!hasErrors) {
              log.success('所有字体压缩任务完成');
            } else {
              log.warning('字体压缩任务完成，但部分文件出现错误');
            }
            cb();
          }
        });
    });

  } catch (error) {
    log.error(`字体压缩过程出错: ${error.message}`);
    cb(error); // 传递错误给回调函数
  }
};

gulp.task('mini-font', (cb) => {
  const buffers = [];
  
  gulp.src(['./public/**/*.html'])
    .on('error', (error) => {
      log.error(`读取HTML文件错误: ${error.message}`);
      cb(error); // 传递错误给回调函数
    })
    .on('data', file => {
      try {
        buffers.push(file.contents);
      } catch (error) {
        log.error(`处理HTML文件内容错误: ${error.message}`);
        cb(error);
      }
    })
    .on('end', () => {
      try {
        const text = Buffer.concat(buffers).toString('utf-8');
        minifyFont(text, (error) => {
          if (error) {
            log.error(`字体压缩任务失败: ${error.message}`);
            cb(error); // 传递错误给回调函数
          } else {
            cb(); // 成功完成
          }
        });
      } catch (error) {
        log.error(`合并HTML内容错误: ${error.message}`);
        cb(error);
      }
    });
});

// 默认任务
gulp.task('default', 
  gulp.series(
    'generate-service-worker',
    gulp.parallel('compress', 'minify-css', 'minify-html', 'mini-font')
  )
);