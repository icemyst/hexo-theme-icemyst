import gulp from "gulp";
import cleanCSS from "gulp-clean-css";
import htmlmin from "gulp-htmlmin";
import htmlclean from "gulp-htmlclean";
import workbox from "workbox-build";
import fontmin from "gulp-fontmin";
import terser from "gulp-terser";
import babel from "gulp-babel";
import uglify from "gulp-uglify";
import plumber from "gulp-plumber";
import path from "path";
import fs from "fs";
import jsonminify from "gulp-jsonminify";
import glob from "glob";

// 配置选项
const CONFIG = {
  js: {
    useTermer: true, // true 使用 terser，false 使用 babel
    removeConsole: true, // 是否移除 console
    removeDebugger: true // 是否移除 debugger
  },
  html: {
    collapseWhitespace: true, // 是否压缩空白
    removeComments: true // 是否移除注释
  },
  css: {
    compatibility: 'ie11',
    level: 2
  },
  paths: {
    public: './public',
    html: './public/**/*.html',
    css: './public/**/*.css',
    js: {
      all: './public/**/*.js',
      exclude: [
        '!./public/**/*.min.js',
        '!./public/js/custom/galmenu.js',
        '!./public/js/custom/gitcalendar.js'
      ]
    },
    fonts: {
      src: './public/fonts/*.ttf',
      dest: './public/fontsdest/'
    },
    json: {
      source: 'source/_data/update.json',
      dest: 'public/_data',
      all: './public/**/*.json'
    },
    sw: {
      template: './sw-template.js',
      output: 'sw.js',
      patterns: [
        "404.html",
        "index.html",
        "js/main.js",
        "css/index.css"
      ]
    }
  }
};

// 日志工具
const logger = {
  icons: {
    info: 'ℹ️',
    success: '✅',
    warning: '⚠️',
    error: '❌'
  },
  log(type, message) {
    console.log(`${this.icons[type] || 'ℹ️'} ${message}`);
  },
  error(err) {
    console.error('❌ Error:', err.message);
    console.error('  文件:', err.fileName || 'unknown');
    console.error('  位置:', err.lineNumber ? `第 ${err.lineNumber} 行` : 'unknown');
    console.error('  堆栈:', err.stack || 'No stack trace');
  }
};

// 错误处理中间件
const errorHandler = {
  handle(err) {
    logger.error(err);
    this.emit('end');
  }
};

// 文件检查工具
const fileUtils = {
  exists(path) {
    return fs.existsSync(path);
  },
  findFiles(pattern) {
    return glob.sync(pattern);
  }
};

// Service Worker 任务
gulp.task("generate-service-worker", () => {
  logger.log('info', '正在生成 Service Worker...');
  return workbox.injectManifest({
    swSrc: CONFIG.paths.sw.template,
    swDest: path.join(CONFIG.paths.public, CONFIG.paths.sw.output),
    globDirectory: CONFIG.paths.public,
    globPatterns: CONFIG.paths.sw.patterns,
    modifyURLPrefix: { "": "./" }
  })
  .then(() => logger.log('success', 'Service Worker 生成成功'))
  .catch(err => errorHandler.handle.call(this, err));
});

// JS 压缩配置
const jsConfig = {
  terser: {
    compress: {
      drop_console: CONFIG.js.removeConsole,
      drop_debugger: CONFIG.js.removeDebugger,
      pure_funcs: CONFIG.js.removeConsole ? ['console.log'] : []
    },
    format: {
      comments: false
    }
  },
  babel: {
    presets: ['@babel/preset-env']
  }
};

// JS 压缩任务
gulp.task("compress", () => {
  const method = CONFIG.js.useTermer ? 'Terser' : 'Babel';
  logger.log('info', `使用 ${method} 压缩 JS...`);
  
  let stream = gulp.src([CONFIG.paths.js.all, ...CONFIG.paths.js.exclude])
    .pipe(plumber({ errorHandler: errorHandler.handle }));

  if (CONFIG.js.useTermer) {
    stream = stream.pipe(terser(jsConfig.terser));
  } else {
    stream = stream
      .pipe(babel(jsConfig.babel))
      .pipe(uglify({
        compress: {
          drop_console: CONFIG.js.removeConsole,
          drop_debugger: CONFIG.js.removeDebugger
        }
      }));
  }

  return stream
    .pipe(gulp.dest(CONFIG.paths.public))
    .on('end', () => logger.log('success', `${method} JS 压缩完成`));
});

// CSS 压缩任务
gulp.task("minify-css", () => {
  logger.log('info', '压缩 CSS...');
  return gulp.src(CONFIG.paths.css)
    .pipe(plumber({ errorHandler: errorHandler.handle }))
    .pipe(cleanCSS({
      compatibility: CONFIG.css.compatibility,
      level: CONFIG.css.level
    }))
    .pipe(gulp.dest(CONFIG.paths.public))
    .on('end', () => logger.log('success', 'CSS 压缩完成'));
});

// HTML 压缩任务
gulp.task("minify-html", () => {
  logger.log('info', '压缩 HTML...');
  return gulp.src(CONFIG.paths.html)
    .pipe(plumber({ errorHandler: errorHandler.handle }))
    .pipe(htmlclean())
    .pipe(htmlmin({
      collapseWhitespace: CONFIG.html.collapseWhitespace,
      removeComments: CONFIG.html.removeComments,
      collapseBooleanAttributes: true,
      removeEmptyAttributes: true,
      removeScriptTypeAttributes: true,
      removeStyleLinkTypeAttributes: true,
      minifyJS: true,
      minifyCSS: true,
      minifyURLs: true,
      processConditionalComments: true,
      removeRedundantAttributes: true,
      useShortDoctype: true
    }))
    .pipe(gulp.dest(CONFIG.paths.public))
    .on('end', () => logger.log('success', 'HTML 压缩完成'));
});

// 字体压缩任务
gulp.task("mini-font", cb => {
  logger.log('info', '检查字体文件...');
  
  if (!fileUtils.exists(CONFIG.paths.fonts.src)) {
    logger.log('warning', '字体目录不存在，跳过字体压缩');
    return Promise.resolve();
  }

  const htmlFiles = fileUtils.findFiles(CONFIG.paths.html);
  if (htmlFiles.length === 0) {
    logger.log('warning', '未找到 HTML 文件，跳过字体压缩');
    return Promise.resolve();
  }

  const text = htmlFiles
    .map(file => fs.readFileSync(file, 'utf-8'))
    .join('');

  return gulp.src(CONFIG.paths.fonts.src)
    .pipe(plumber({ errorHandler: errorHandler.handle }))
    .pipe(fontmin({ text, quiet: true }))
    .pipe(gulp.dest(CONFIG.paths.fonts.dest))
    .on('end', () => logger.log('success', '字体压缩完成'));
});

// JSON 处理任务
gulp.task('process-json', () => {
  logger.log('info', '处理 JSON 文件...');
  
  const tasks = [];

  // 复制并压缩源 JSON
  if (fileUtils.exists(CONFIG.paths.json.source)) {
    tasks.push(
      gulp.src(CONFIG.paths.json.source)
        .pipe(plumber({ errorHandler: errorHandler.handle }))
        .pipe(jsonminify())
        .pipe(gulp.dest(CONFIG.paths.json.dest))
    );
  } else {
    logger.log('warning', '源 JSON 文件不存在');
  }

  // 压缩所有 JSON 文件
  const jsonFiles = fileUtils.findFiles(CONFIG.paths.json.all);
  if (jsonFiles.length > 0) {
    tasks.push(
      gulp.src(CONFIG.paths.json.all)
        .pipe(plumber({ errorHandler: errorHandler.handle }))
        .pipe(jsonminify())
        .pipe(gulp.dest(CONFIG.paths.public))
    );
    logger.log('info', `找到 ${jsonFiles.length} 个 JSON 文件待处理`);
  }

  return tasks.length > 0
    ? Promise.all(tasks).then(() => logger.log('success', 'JSON 处理完成'))
    : Promise.resolve();
});

// 默认任务
gulp.task(
  "default",
  gulp.series(
    "generate-service-worker",
    gulp.parallel(
      "compress",
      "minify-html", 
      "minify-css",
      "mini-font",
      "process-json"
    )
  )
);