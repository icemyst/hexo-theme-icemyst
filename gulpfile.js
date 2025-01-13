import gulp from "gulp";
import cleanCSS from "gulp-clean-css";
import htmlmin from "gulp-htmlmin";
import htmlclean from "gulp-htmlclean";
import workbox from "workbox-build";
import fontmin from "gulp-fontmin";
import fs from "fs";
import path from "path";



// 若使用babel压缩js，则取消下方注释，并注释terser的代码
// var uglify = require('gulp-uglify');
// var babel = require('gulp-babel');

// 若使用terser压缩js
import terser from "gulp-terser";

// 在文件开头添加性能优化配置
const PARALLEL_LIMIT = 4; // 并行任务限制

// 修改字体压缩任务的配置
const FONT_PROCESS_CONFIG = {
  retry: 3, // 失败重试次数
  timeout: 30000, // 超时时间
  batchSize: 2 // 批处理大小
};

// 在文件开头添加终端美化相关的工具函数和表情符号配置
const EMOJIS = {
  info: '💡',    // 信息
  success: '✅',  // 成功
  warning: '⚠️',  // 警告
  error: '❌',    // 错误
  start: '🚀',    // 开始
  end: '🎉',      // 结束
  process: '⚙️',  // 处理中
  skip: '⏭️',     // 跳过
  font: '🔤',     // 字体
  js: '📜',       // JavaScript
  css: '🎨',      // CSS
  html: '🌐',     // HTML
  stats: '📊'     // 统计
};

const formatTime = () => {
  const now = new Date();
  return `[${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}]`;
};

const logTypes = {
  info: '\x1b[36m%s\x1b[0m',    // 青色
  success: '\x1b[32m%s\x1b[0m', // 绿色
  warning: '\x1b[33m%s\x1b[0m', // 黄色
  error: '\x1b[31m%s\x1b[0m'    // 红色
};

const log = {
  info: (msg) => console.log(logTypes.info, `${formatTime()} ${EMOJIS.info} [信息] ${msg}`),
  success: (msg) => console.log(logTypes.success, `${formatTime()} ${EMOJIS.success} [成功] ${msg}`),
  warning: (msg) => console.log(logTypes.warning, `${formatTime()} ${EMOJIS.warning} [警告] ${msg}`),
  error: (msg) => console.log(logTypes.error, `${formatTime()} ${EMOJIS.error} [错误] ${msg}`)
};

// 修改进度条显示函数，添加表情符号
const showProgress = (current, total) => {
  const percentage = Math.floor((current / total) * 100);
  const filled = Math.floor(percentage / 2);
  const empty = 50 - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  process.stdout.write(`\r${formatTime()} ${EMOJIS.process} [进度] ${bar} ${percentage}% (${current}/${total})`);
  if (current === total) process.stdout.write('\n');
};

// 优化任务配置
const CONFIG = {
  paths: {
    js: ['./public/**/*.js', '!./public/**/*.min.js', '!./public/js/custom/galmenu.js', '!./public/js/custom/gitcalendar.js'],
    css: './public/**/*.css',
    html: './public/**/*.html',
    fonts: path.resolve('./public/fonts'),
    fontsSrc: './public/fonts/*.ttf',
    fontsDest: './public/fontsdest/'
  },
  pwa: {
    swSrc: './sw-template.js',
    swDest: './public/sw.js',
    globDirectory: './public',
    globPatterns: ['**/*.{js,css,html,png,jpg,jpeg,gif,svg,webp,woff,woff2,ttf,otf,eot}']
  },
  optimization: {
    parallel: 4,
    font: {
      retry: 3,
      timeout: 30000,
      batchSize: 2,
      concurrent: 2
    },
    css: {
      compatibility: 'ie11',
      level: 2,
      rebase: false, // 禁用 URL 重写
      mergeMedia: true // 合并媒体查询
    },
    html: {
      removeComments: true,
      collapseWhitespace: true,
      collapseBooleanAttributes: true,
      removeEmptyAttributes: true,
      removeScriptTypeAttributes: true,
      removeStyleLinkTypeAttributes: true,
      minifyJS: true,
      minifyCSS: true,
      minifyURLs: true,
      processConditionalComments: true,
      useShortDoctype: true,
      removeRedundantAttributes: true
    }
  }
};

// 添加错误处理工具
const errorHandler = (taskName) => (err) => {
  console.error(`[${taskName}] 错误:`, err.message);
  this.emit('end');
};

// 优化 PWA 任务
gulp.task('generate-service-worker', () => {
  return workbox.injectManifest(CONFIG.pwa);
});

// 优化 JS 压缩任务
gulp.task('compress', () => {
  log.info(`${EMOJIS.js} 开始压缩 JS 文件...`);
  return gulp.src(CONFIG.paths.js)
    .pipe(terser())
    .on('error', function(err) {
      log.error(`${EMOJIS.js} JS 压缩失败: ${err.message}`);
      this.emit('end');
    })
    .pipe(gulp.dest('./public'))
    .on('end', () => log.success(`${EMOJIS.js} JS 压缩完成`));
});

// 优化 CSS 压缩任务
gulp.task('minify-css', () =>
  gulp.src(CONFIG.paths.css)
    .pipe(cleanCSS(CONFIG.optimization.css))
    .pipe(gulp.dest('./public'))
);

// 优化 HTML 压缩任务
gulp.task('minify-html', () =>
  gulp.src(CONFIG.paths.html)
    .pipe(htmlclean())
    .pipe(htmlmin(CONFIG.optimization.html))
    .pipe(gulp.dest('./public'))
);

// 增强字体验证函数
const validateFont = (fontPath) => {
  try {
    // 检查文件大小
    const stats = fs.statSync(fontPath);
    if (stats.size === 0) {
      return { valid: false, reason: '字体文件大小为0' };
    }
    
    if (stats.size < 1024) { // 小于1KB的文件可能损坏
      return { valid: false, reason: '字体文件过小，可能已损坏' };
    }
    
    // 读取整个文件进行更详细的验证
    const buffer = fs.readFileSync(fontPath);
    
    // 检查文件头部标识（TTF文件应该以0x00010000或0x74727565开头）
    const signature = buffer.slice(0, 4).toString('hex');
    if (signature !== '00010000' && signature !== '74727565') {
      return { valid: false, reason: '无效的TTF文件格式' };
    }
    
    // 检查文件完整性
    try {
      // 验证表偏移量
      const numTables = buffer.readUInt16BE(4);
      if (numTables <= 0 || numTables > 100) { // 正常TTF文件通常有10-30个表
        return { valid: false, reason: '无效的表数量' };
      }
      
      // 检查文件长度是否足够包含所有表
      const minLength = 12 + (numTables * 16); // 头部12字节 + 每个表目录16字节
      if (buffer.length < minLength) {
        return { valid: false, reason: '文件长度异常' };
      }
      
    } catch (err) {
      return { valid: false, reason: '字体文件结构损坏' };
    }
    
    return { valid: true };
  } catch (err) {
    return { valid: false, reason: err.message };
  }
};

// 添加工具函数
const utils = {
  chunk: (arr, size) => 
    Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => 
      arr.slice(i * size, i * size + size)
    ),
    
  retry: async (fn, times = 3, delay = 1000) => {
    for (let i = 0; i < times; i++) {
      try {
        return await fn();
      } catch (err) {
        if (i === times - 1) throw err;
        await new Promise(resolve => setTimeout(resolve, delay));
        log.warning(`重试第 ${i + 1} 次...`);
      }
    }
  },

  measureTime: async (fn, taskName) => {
    const start = performance.now();
    try {
      await fn();
    } finally {
      const duration = (performance.now() - start).toFixed(2);
      log.info(`${taskName} 耗时: ${duration}ms`);
    }
  }
};

// 添加任务状态追踪
const TaskTracker = {
  tasks: new Map(),
  
  start(taskName) {
    this.tasks.set(taskName, {
      startTime: Date.now(),
      status: 'running'
    });
    log.info(`${EMOJIS.start} 开始任务: ${taskName}`);
  },
  
  end(taskName, success = true) {
    const task = this.tasks.get(taskName);
    if (task) {
      const duration = ((Date.now() - task.startTime) / 1000).toFixed(2);
      task.status = success ? 'success' : 'failed';
      const emoji = success ? EMOJIS.success : EMOJIS.error;
      log.info(`${emoji} 任务 ${taskName} ${success ? '完成' : '失败'}, 耗时: ${duration}s`);
    }
  },
  
  summary() {
    const results = {
      total: this.tasks.size,
      success: 0,
      failed: 0
    };
    
    this.tasks.forEach(task => {
      if (task.status === 'success') results.success++;
      if (task.status === 'failed') results.failed++;
    });
    
    log.info(`\n${EMOJIS.stats} 任务执行统计:`);
    log.info(`总任务数: ${results.total}`);
    log.success(`成功: ${results.success}`);
    if (results.failed > 0) {
      log.error(`失败: ${results.failed}`);
    }
  }
};

// 修改字体处理函数，添加跳过机制
const processFont = async (fontFile, text, results, updateProgress) => {
  const fontPath = path.join(CONFIG.paths.fonts, fontFile);
  
  try {
    if (!fs.existsSync(fontPath)) {
      throw new Error('文件不存在');
    }

    // 检查是否是已知的问题字体
    const problemFonts = [
      'REEJI-TaikoMagicGB-Flash-Bold.ttf',
      'UnidreamLED.ttf'
      // 可以添加更多有问题的字体
    ];

    if (problemFonts.includes(fontFile)) {
      log.warning(`${EMOJIS.skip} 跳过已知问题字体: ${fontFile}`);
      results.skipped = results.skipped || [];
      results.skipped.push({
        file: fontFile,
        reason: '已知问题字体'
      });
      updateProgress();
      return;
    }

    const validation = await utils.retry(() => validateFont(fontPath));
    if (!validation.valid) {
      throw new Error(validation.reason);
    }

    log.info(`${EMOJIS.font} 正在处理: ${fontFile}`);

    await new Promise((resolve, reject) => {
      let hasError = false;

      const handleError = (err) => {
        if (!hasError) {
          hasError = true;
          const errorMsg = err.message || '未知错误';
          log.error(`${EMOJIS.error} 处理失败 (${fontFile}): ${errorMsg}`);
          if (err.stack) {
            log.error(`堆栈信息: ${err.stack}`);
          }
          reject(err);
        }
      };

      const stream = gulp.src(fontPath, { allowEmpty: true })
        .on('error', handleError)
        .pipe(fontmin({
          text: text,
          quiet: true,
          verbose: false,
          // 简化配置
          plugins: ['glyph'],
          // 添加基本选项
          subset: true, // 启用子集化
          ignore: [], // 不忽略任何字符
          basicText: false, // 不包含基本字符
          extensionText: false // 不包含扩展字符
        }))
        .on('error', handleError)
        .pipe(gulp.dest(CONFIG.paths.fontsDest))
        .on('error', handleError)
        .on('end', () => {
          if (!hasError) {
            const outputPath = path.join(CONFIG.paths.fontsDest, fontFile);
            if (fs.existsSync(outputPath)) {
              const stats = fs.statSync(outputPath);
              if (stats.size > 0) {
                results.success.push(fontFile);
                log.success(`${EMOJIS.font} ${fontFile} 压缩完成 (${stats.size} 字节)`);
                updateProgress();
                resolve();
              } else {
                handleError(new Error('输出文件大小为0'));
              }
            } else {
              handleError(new Error('输出文件不存在'));
            }
          }
        });

      // 添加错误处理
      stream.on('error', handleError);
    });

  } catch (err) {
    // 特殊错误处理
    let errorMessage = err.message;
    let shouldSkip = false;
    
    if (err.code === 10204) {
      errorMessage = '字体文件格式不兼容或已损坏';
      shouldSkip = true;
    } else if (err.code === 'ENOENT') {
      errorMessage = '文件不存在';
      shouldSkip = true;
    } else if (err.code === 'EPERM') {
      errorMessage = '没有访问权限';
      shouldSkip = true;
    }
    
    if (shouldSkip) {
      log.warning(`${EMOJIS.skip} 跳过处理: ${fontFile} (${errorMessage})`);
      results.skipped = results.skipped || [];
      results.skipped.push({
        file: fontFile,
        reason: errorMessage,
        code: err.code || 'UNKNOWN'
      });
    } else {
      log.error(`${EMOJIS.error} ${fontFile}: ${errorMessage}`);
      results.failed.push({ 
        file: fontFile, 
        reason: errorMessage,
        code: err.code || 'UNKNOWN'
      });
    }
    updateProgress();
  }
};

// 修改批处理逻辑，添加单独的错误处理
const processBatch = async (batch, text, results, updateProgress) => {
  const promises = batch.map(fontFile => 
    new Promise(async (resolve) => {
      try {
        await utils.retry(
          async () => {
            await processFont(fontFile, text, results, updateProgress);
          },
          FONT_PROCESS_CONFIG.retry,
          1000
        );
      } catch (err) {
        log.error(`${EMOJIS.error} ${fontFile} 处理失败（所有重试均失败）`);
        results.failed.push({
          file: fontFile,
          reason: err.message,
          code: err.code || 'RETRY_FAILED'
        });
        updateProgress();
      } finally {
        resolve(); // 确保总是解析promise
      }
    })
  );
  
  await Promise.all(promises);
};

// 修改错误处理
process.on('uncaughtException', (err) => {
  log.error(`未捕获的异常: ${err.message}`);
  if (err.stack) {
    log.error(`堆栈信息: ${err.stack}`);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  log.error(`未处理的Promise拒绝: ${reason}`);
});

// 主函数保持不变，但传递正确的参数
const minifyFont = async (text, cb) => {
  try {
    const fontFiles = fs.readdirSync(CONFIG.paths.fonts)
      .filter(file => file.endsWith('.ttf'));

    if (fontFiles.length === 0) {
      log.warning(`${EMOJIS.skip} 没有找到TTF字体文件，跳过字体压缩任务`);
      return cb();
    }

    let processedCount = 0;
    const totalFiles = fontFiles.length;
    const results = {
      success: [],
      failed: [],
      skipped: []
    };
    
    const updateProgress = () => {
      processedCount++;
      showProgress(processedCount, totalFiles);
    };

    // 使用 utils.chunk 而不是 chunk
    const batches = utils.chunk(fontFiles, FONT_PROCESS_CONFIG.batchSize);
    
    for (let i = 0; i < batches.length; i++) {
      await processBatch(batches[i], text, results, updateProgress);
    }

    // 修改最终结果输出
    log.info(`\n${EMOJIS.stats} 字体压缩任务统计:`);
    log.info(`${EMOJIS.stats} 总计处理: ${fontFiles.length} 个文件`);
    log.success(`${EMOJIS.success} 成功压缩: ${results.success.length} 个文件`);
    
    if (results.skipped && results.skipped.length > 0) {
      log.warning(`${EMOJIS.skip} 跳过处理: ${results.skipped.length} 个文件`);
      log.warning(`${EMOJIS.skip} 跳过文件列表:`);
      results.skipped.forEach(skip => {
        log.warning(`  ${EMOJIS.skip} ${skip.file}: ${skip.reason}`);
      });
    }
    
    if (results.failed.length > 0) {
      log.error(`${EMOJIS.error} 压缩失败: ${results.failed.length} 个文件`);
      log.error(`${EMOJIS.error} 失败文件列表:`);
      results.failed.forEach(failure => {
        log.error(`  ${EMOJIS.error} ${failure.file}: ${failure.reason}`);
      });
    }

    cb();
  } catch (err) {
    log.error(`${EMOJIS.error} 字体处理失败: ${err}`);
    cb();
  }
};

// 修改字体压缩任务，添加文本预处理
gulp.task('mini-font', cb => {
  try {
    if (!fs.existsSync(CONFIG.paths.fonts)) {
      log.warning('字体目录不存在，跳过字体压缩任务');
      return cb();
    }

    const buffers = [];
    const stream = gulp.src([CONFIG.paths.html], { allowEmpty: true });
    
    stream.on('error', err => {
      log.error('读取 HTML 文件失败:', err);
      cb();
    });

    stream
      .on('data', file => buffers.push(file.contents))
      .on('end', () => {
        if (buffers.length === 0) {
          log.warning('没有找到 HTML 文件，跳过字体压缩');
          return cb();
        }
        
        try {
          const text = Buffer.concat(buffers).toString('utf-8')
            // 移除HTML标签
            .replace(/<[^>]+>/g, '')
            // 移除特殊字符
            .replace(/[\r\n\t]/g, '')
            // 去重
            .split('')
            .filter((char, index, self) => self.indexOf(char) === index)
            .join('');
            
          log.info(`提取到 ${text.length} 个唯一字符`);
          minifyFont(text, cb);
        } catch (err) {
          log.error('文本处理失败:', err);
          cb();
        }
      });
  } catch (err) {
    log.error('字体压缩任务失败:', err);
    cb();
  }
});

// 优化默认任务的并行处理
gulp.task('default', 
  gulp.series(
    async () => {
      TaskTracker.start('构建');
      log.info(`${EMOJIS.start} 开始构建任务...`);
    },
    'generate-service-worker',
    gulp.parallel(
      'compress',
      'minify-html',
      'minify-css',
      'mini-font'
    ),
    async () => {
      TaskTracker.end('构建');
      TaskTracker.summary();
      log.success(`${EMOJIS.end} 所有任务执行完成！`);
    }
  )
);