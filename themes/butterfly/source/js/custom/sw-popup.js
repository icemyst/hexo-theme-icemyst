// Service Worker 管理器
(() => {
  if (!('serviceWorker' in navigator)) return;
  
  // 配置常量
  const CONFIG = {
    SW_PATH: '/sw.js',
    POPUP_ID: 'sw-update-popup',
    ANIMATION_DURATION: 500,
    AUTO_HIDE_DELAY: 30000,
    ANIMATION_STYLE: 'sw-notification-out 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards'
  };
  
  const popup = document.getElementById(CONFIG.POPUP_ID);
  if (!popup) return;
  
  // 弹窗控制
  const setPopupStyle = (styles) => Object.assign(popup.style, styles);
  
  const togglePopup = (show) => {
    if (show) {
      setPopupStyle({ visibility: 'visible', pointerEvents: 'auto' });
      popup.classList.add('show');
      setTimeout(() => togglePopup(false), CONFIG.AUTO_HIDE_DELAY);
    } else {
      popup.style.animation = CONFIG.ANIMATION_STYLE;
      popup.classList.remove('show');
      setTimeout(() => {
        if (!popup.classList.contains('show')) {
          setPopupStyle({ pointerEvents: 'none', visibility: 'hidden', animation: '' });
        }
      }, CONFIG.ANIMATION_DURATION);
    }
  };
  
  // 初始化弹窗
  const initPopup = () => {
    if (!popup.classList.contains('show')) {
      setPopupStyle({ pointerEvents: 'none', visibility: 'hidden' });
    }
    popup.querySelector('.close-btn')?.addEventListener('click', () => togglePopup(false));
  };
  
  // Service Worker 注册和更新处理
  const registerSW = async () => {
    try {
      const registration = await navigator.serviceWorker.register(CONFIG.SW_PATH, {
        scope: '/',
        updateViaCache: 'none'
      });
      
      const handleUpdate = () => {
        if (registration.waiting && navigator.serviceWorker.controller) {
          togglePopup(true);
        }
      };
      
      // 监听更新事件
      registration.addEventListener('updatefound', () => {
        registration.installing?.addEventListener('statechange', function() {
          if (this.state === 'installed' && navigator.serviceWorker.controller) {
            handleUpdate();
          }
        });
      });
      
      handleUpdate();
      
    } catch (error) {
      console.debug('Service Worker 注册失败:', error);
    }
  };
  
  // 初始化
  document.addEventListener('DOMContentLoaded', initPopup);
  registerSW();
})();