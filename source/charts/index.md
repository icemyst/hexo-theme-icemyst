---
aside: false
comments: false
type: "charts"
---
{% raw %}
<div class="charts-container">
  <div id="posts-chart" class="chart-item" data-loading="true"></div>
  <div id="tags-chart" data-length="10" class="chart-item" data-loading="true"></div>
  <div id="categories-chart" data-parent="true" class="chart-item" data-loading="true"></div>
</div>

<script>
const ECHARTS_CDN = 'https://cdn.jsdelivr.net/npm/echarts@5.5.1/dist/echarts.min.js';

// 优化全局 initChart 函数
window.initChart = function(chartId, option) {
    const chartDom = document.getElementById(chartId);
    if (!chartDom || !window.echarts) return null;

    const existingChart = echarts.getInstanceByDom(chartDom);
    if (existingChart) {
        existingChart.dispose();
    }

    const chart = echarts.init(chartDom, 'light');
    
    // 添加默认动画配置
    option.animation = {
        duration: 1000,
        easing: 'cubicOut'
    };
    
    chart.setOption(option);
    return chart;
};

class ChartsManager {
  static instances = new Map();
  static loadingPromise = null;
  
  static charts = [
    { type: 'Posts', selector: '#posts-chart' },
    { type: 'Tags', selector: '#tags-chart' },
    { type: 'Categories', selector: '#categories-chart' }
  ];

  static async init() {
    try {
      await this.loadEcharts();
      await this.initAllCharts();
      this.setupEventListeners();
    } catch (error) {
      console.error('Failed to initialize charts:', error);
      this.showError();
    }
  }

  static async loadEcharts() {
    if (window.echarts) return;
    
    if (!this.loadingPromise) {
      this.loadingPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = ECHARTS_CDN;
        script.onload = resolve;
        script.onerror = () => {
          this.loadingPromise = null;
          reject(new Error('Failed to load ECharts'));
        };
        document.head.appendChild(script);
      });
    }
    
    return this.loadingPromise;
  }

  static async initAllCharts() {
    const initPromises = this.charts.map(async ({ type, selector }) => {
      const element = document.querySelector(selector);
      if (!element) return;

      try {
        element.setAttribute('data-loading', 'true');
        const initFn = window[`init${type}Chart`];
        
        if (typeof initFn === 'function') {
          await initFn();
          element.setAttribute('data-loading', 'false');
        }
      } catch (error) {
        console.error(`Failed to initialize ${type} chart:`, error);
        element.setAttribute('data-error', 'true');
      }
    });

    await Promise.allSettled(initPromises);
  }

  static setupEventListeners() {
    // 主题切换监听
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'data-theme') {
          this.refreshAllCharts();
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });

    // PJAX 支持
    document.addEventListener('pjax:complete', () => {
      this.loadEcharts()
        .then(() => this.initAllCharts())
        .catch(console.error);
    });

    // 优化窗口大小改变处理
    const debouncedResize = this.debounce(() => {
      requestAnimationFrame(() => {
        this.refreshAllCharts();
      });
    }, 250);

    window.addEventListener('resize', debouncedResize);
  }

  static refreshAllCharts() {
    const charts = document.querySelectorAll('.chart-item');
    charts.forEach(chart => {
      const type = chart.id.split('-')[0];
      const initFn = window[`init${type.charAt(0).toUpperCase() + type.slice(1)}Chart`];
      if (typeof initFn === 'function') {
        initFn();
      }
    });
  }

  static debounce(func, wait) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  static showError() {
    const charts = document.querySelectorAll('.chart-item');
    charts.forEach(chart => {
      chart.setAttribute('data-error', 'true');
    });
  }
}

// 初始化
ChartsManager.init().catch(console.error);
</script>

<style>
.charts-container {
  width: 100%;
  margin: 0 auto;
  padding: 20px 0;
}

.chart-item {
  position: relative;
  width: 100%;
  height: 300px;
  margin-bottom: 30px;
  transition: all 0.3s ease;
}

.chart-item[data-loading="true"]::before {
  content: "加载中...";
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: var(--font-color);
  font-size: 14px;
}

.chart-item[data-error="true"]::before {
  content: "加载失败";
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #ff4d4f;
  font-size: 14px;
}

@media screen and (max-width: 768px) {
  .chart-item {
    height: 250px;
    margin-bottom: 20px;
  }
  
  .charts-container {
    padding: 10px 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .chart-item {
    transition: none;
  }
}
</style>
{% endraw %}