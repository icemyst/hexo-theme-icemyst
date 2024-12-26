---
aside: false
comments: false
type: "charts"
---
{% raw %}
<!-- 图表容器 -->
<div id="posts-chart" style="width: 100%; height: 300px;"></div>
<div id="tags-chart" data-length="10" style="width: 100%; height: 300px;"></div>
<div id="categories-chart" data-parent="true" style="width: 100%; height: 300px;"></div>

<script>
function loadEcharts() {
    return new Promise((resolve, reject) => {
        if (window.echarts) {
            resolve();
        } else {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/echarts@5.5.1/dist/echarts.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        }
    });
}

function initAllCharts() {
    if (typeof initPostsChart === 'function') initPostsChart();
    if (typeof initTagsChart === 'function') initTagsChart();
    if (typeof initCategoriesChart === 'function') initCategoriesChart();
}

// 初始加载
loadEcharts().then(initAllCharts);

// PJAX 支持
document.addEventListener('pjax:complete', function() {
    loadEcharts().then(() => {
        setTimeout(initAllCharts, 100);
    });
});
</script>
{% endraw %}