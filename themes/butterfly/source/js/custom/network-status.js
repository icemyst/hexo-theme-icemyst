// 网络状态管理优化
class NetworkStatusManager {
  constructor(config) {
    this.config = config;
    this.offlineTimer = null;
    this.debounceTimeout = null;
    this.activeNotification = null; // 添加跟踪当前活动通知
  }

  // 添加防抖处理
  debounce(func, wait) {
    clearTimeout(this.debounceTimeout);
    this.debounceTimeout = setTimeout(func, wait);
  }

  showNotification(status) {
    this.debounce(() => {
      const config = this.config[status];
      if (!config) return;

      // 清除可能存在的旧通知
      if (this.activeNotification) {
        Snackbar.close();
        this.activeNotification = null;
      }

      const message = config.messages[Math.floor(Math.random() * config.messages.length)];
      
      if (this.offlineTimer) {
        clearTimeout(this.offlineTimer);
        this.offlineTimer = null;
      }

      this.activeNotification = Snackbar.show({
        text: message,
        pos: 'top-center',
        duration: status === 'offline' ? null : config.duration,
        backgroundColor: config.backgroundColor,
        showAction: false,
        customClass: `network-status-${status}`,
        onClose: () => {
          this.activeNotification = null;
          if (status === 'offline' && !navigator.onLine) {
            this.offlineTimer = setTimeout(() => this.showNotification('offline'), 2000);
          }
        }
      });
    }, 300);
  }

  // 添加初始化方法
  init() {
    // 监听网络状态变化
    window.addEventListener('online', () => this.showNotification('online'));
    window.addEventListener('offline', () => this.showNotification('offline'));
    
    // 初始化检查网络状态
    if (!navigator.onLine) {
      this.showNotification('offline');
    }
  }
}

// 直接定义网络配置
const networkConfig = {
  online: {
    messages: [
      '<i class="fas fa-signal"></i> 连接成功！可以继续浏览啦 (๑•̀ㅂ•́)و✧',
      '<i class="fas fa-wifi"></i> 终于恢复连接了呢 ٩(๑>◡<๑)۶',
      '<i class="fas fa-cloud-arrow-up"></i> 网络已连接，冲浪继续！(ノ≧∀≦)ノ',
      '<i class="fas fa-rocket"></i> 网络连接成功！开始新的冒险吧 ヾ(≧▽≦*)o',
      '<i class="fas fa-bolt"></i> 信号满格，准备出发！(๑•̀ㅂ•́)و',
      '<i class="fas fa-satellite"></i> 网络连接成功，能量充能完毕！(ﾉ◕ヮ◕)ﾉ*:･ﾟ✧',
      '<i class="fas fa-paper-plane"></i> 网络恢复，继续探索二次元世界吧 ٩(◕‿◕｡)۶'
    ],
    duration: 3000,
    backgroundColor: 'linear-gradient(120deg, #a1c4fd 0%, #c2e9fb 100%)'
  },
  offline: {
    messages: [
      '<i class="fas fa-snowflake"></i> 哎呀，网络离线了 (；´д｀)ゞ',
      '<i class="fas fa-plug-circle-xmark"></i> 网络不见了，待机中... (´。＿。｀)',
      '<i class="fas fa-triangle-exclamation"></i> 连接丢失，等待恢复中 (｡•́︿•̀｡)',
      '<i class="fas fa-cloud-bolt"></i> 网络信号消失，进入待机模式 (´-﹏-`；)',
      '<i class="fas fa-cloud-showers-heavy"></i> 网络连接中断，正在尝试重新连接 (╥﹏╥)',
      '<i class="fas fa-power-off"></i> 信号丢失，进入节能模式 (´-ω-`)',
      '<i class="fas fa-satellite-dish"></i> 网络断开，等待重新连接中 (´；ω；｀)'
    ],
    duration: -1,  // 永久显示直到恢复
    backgroundColor: 'linear-gradient(120deg, #f093fb 0%, #f5576c 100%)'
  }
};

// 导出网络管理器实例
const networkManager = new NetworkStatusManager(networkConfig);

// 使用初始化方法替代直接添加事件监听
networkManager.init();

// 导出 networkManager 供其他模块使用
window.networkManager = networkManager; 