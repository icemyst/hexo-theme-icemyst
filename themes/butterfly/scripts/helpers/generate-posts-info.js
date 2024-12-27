'use strict';

const fs = require('fs');
const path = require('path');

// 添加防抖函数
function debounce(func, wait) {
  let timeout;
  return function() {
    const context = this;
    const args = arguments;
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      func.apply(context, args);
    }, wait);
  };
}

// 生成postsInfo的函数
function generatePostsInfo() {
  try {
    const posts = hexo.locals.get('posts').data;
    const categories = hexo.locals.get('categories').data;
    const tags = hexo.locals.get('tags').data;
    
    const postsInfo = {
      total: posts.length,
      posts: posts.map(post => ({
        title: post.title,
        path: post.path,
        cover: post.cover || (post.photos && post.photos[0]) || '',
        description: post.description || post.excerpt || '',
        categories: post.categories.data.map(cat => cat.name),
        tags: post.tags.data.map(tag => tag.name),
        date: post.date.format('YYYY-MM-DD'),
        updated: post.updated.format('YYYY-MM-DD')
      })),
      categories: categories.map(category => ({
        name: category.name,
        count: category.length
      })),
      tags: tags.map(tag => ({
        name: tag.name,
        count: tag.length
      }))
    };

    const dataDir = path.join(hexo.source_dir, '_data');
    const filePath = path.join(dataDir, 'postsInfo.json');
    
    // 如果_data目录不存在，检查是否有其他JSON文件需要保留
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir);
    }
    
    // 检查文件是否存在且内容相同
    if (fs.existsSync(filePath)) {
      try {
        const existingContent = fs.readFileSync(filePath, 'utf8');
        const newContent = JSON.stringify(postsInfo, null, 2);
        if (existingContent === newContent) {
          return; // 如果内容相同，不需要重写
        }
      } catch (err) {
        // 如果读取失败，继续写入新文件
        hexo.log.warn('无法读取现有的 postsInfo.json，将创建新文件');
      }
    }

    // 写入新内容
    fs.writeFileSync(filePath, JSON.stringify(postsInfo, null, 2));
    hexo.log.info('已更新 postsInfo.json');

  } catch (err) {
    hexo.log.error('生成 postsInfo.json 时出错：', err);
  }
}

// 使用防抖包装生成函数
const debouncedGenerate = debounce(generatePostsInfo, 1000);

// 注册事件监听
hexo.extend.filter.register('before_generate', () => {
  // 只在生产环境或首次生成时执行
  if (process.env.NODE_ENV === 'production' || !global.isDevServer) {
    generatePostsInfo();
  } else {
    debouncedGenerate();
  }
});

// 标记开发服务器状态
hexo.on('server', () => {
  global.isDevServer = true;
});