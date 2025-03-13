const gulp = require('gulp');
const cleanCSS = require('gulp-clean-css');
const htmlMin = require('gulp-html-minifier-terser');
const htmlclean = require('gulp-htmlclean');
const fontmin = require('gulp-fontmin');
const workbox = require("workbox-build");
const terser = require('gulp-terser');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs');

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
      pure_funcs: ['console.log', 'console.info', 'console.debug'],
      module: true,
      toplevel: true
    },
    mangle: { 
      toplevel: true,
      properties: {
        regex: /^_/ // 只混淆以下划线开头的属性
      }
    },
    format: {
      comments: false,
      ascii_only: true
    }
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
  font: {
    fontsDir: './public/fonts',
    fontsDest: './public/fontsdest',
    fontOptions: {
      quiet: false,
      optimize: true,
      fontPath: '../fonts/',
      subset: ['latin', 'chinese-simplified']
    }
  }
};

/**
 * 创建通用的压缩任务函数
 * @param {string} taskName - 任务名称
 * @param {string|string[]} src - 源文件路径
 * @param {Object} processor - 处理器
 * @param {string} dest - 目标路径
 * @param {string} successMessage - 成功消息
 */
const createMinifyTask = (taskName, src, processor, dest, successMessage) => {
  gulp.task(taskName, () => 
    gulp.src(src)
      .on('error', (error) => log.error(`${taskName}错误: ${error.message}`))
      .pipe(processor)
      .pipe(gulp.dest(dest || './public'))
      .on('end', () => log.success(successMessage || `${taskName}完成`))
  );
};

// Service Worker 注入配置
gulp.task('generate-service-worker', () => 
  workbox.injectManifest(config.sw)
    .then(({count, size}) => {
      log.success(`生成 Service Worker 成功，预缓存 ${count} 个文件，总计 ${size} 字节`);
    })
    .catch(err => {
      log.error('生成 Service Worker 失败：' + err);
    })
);

// 使用通用函数创建压缩任务
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
  cleanCSS({ compatibility: 'ie11', level: 2 }), 
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

/**
 * 字体压缩函数
 * @param {string} text - 要包含的文本
 * @param {Function} cb - 回调函数
 */
const minifyFont = (text, cb) => {
  const { fontsDir, fontsDest, fontOptions } = config.font;
  
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
    
    /**
     * 处理字体文件的错误处理函数
     * @param {string} fontFile - 字体文件名
     * @param {string} errorMsg - 错误消息
     */
    const handleError = (fontFile, errorMsg) => {
      log.error(`字体文件 ${fontFile} ${errorMsg}`);
      hasErrors = true;
      checkCompletion();
    };
    
    /**
     * 处理每个字体文件的通用函数
     * @param {string} fontFile - 字体文件名
     */
    const processFontFile = (fontFile) => {
      const fontPath = path.join(fontsDir, fontFile);
      
      gulp.src(fontPath)
        .on('error', (error) => handleError(fontFile, `压缩错误: ${error.message}`))
        .pipe(fontmin({ 
          text,
          ...fontOptions
        }))
        .on('error', (error) => handleError(fontFile, `处理失败: ${error.message}`))
        .pipe(gulp.dest(fontsDest))
        .on('end', () => {
          log.success(`字体文件 ${fontFile} 压缩完成`);
          checkCompletion();
        });
    };
    
    /**
     * 检查是否所有字体都处理完成
     */
    const checkCompletion = () => {
      if (++completedFonts === ttfFiles.length) {
        log.success(hasErrors ? '字体压缩任务完成，但部分文件出现错误' : '所有字体压缩任务完成');
        cb();
      }
    };
    
    // 处理每个字体文件
    ttfFiles.forEach(processFontFile);

  } catch (error) {
    log.error(`字体压缩过程出错: ${error.message}`);
    cb(error);
  }
};

// 字体压缩任务
gulp.task('mini-font', (cb) => {
  const buffers = [];
  
  gulp.src(['./public/**/*.html'])
    .on('error', (error) => {
      log.error(`读取HTML文件错误: ${error.message}`);
      cb(error);
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
            cb(error);
          } else {
            cb();
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