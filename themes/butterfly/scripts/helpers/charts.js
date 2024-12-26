const cheerio = require('cheerio');
const moment = require('moment');

// 公共颜色设置
const getChartColor = () => document.documentElement.getAttribute('data-theme') === 'light' ? '#4c4948' : 'rgba(255,255,255,0.7)';

// 添加常量配置
const CHART_CONFIG = {
  colors: {
    gradient: [{
      offset: 0,
      color: 'rgba(128, 255, 165)'
    }, {
      offset: 1,
      color: 'rgba(1, 191, 236)'
    }],
    hoverGradient: [{
      offset: 0,
      color: 'rgba(128, 255, 195)' 
    }, {
      offset: 1,
      color: 'rgba(1, 211, 255)'
    }]
  }
};

// 添加工具函数
function createGradient(echarts, colors) {
  return new echarts.graphic.LinearGradient(0, 0, 0, 1, colors);
}

// 优化图表初始化函数
function initChart(chartId, option) {
  const chartDom = document.getElementById(chartId);
  if (!chartDom || !window.echarts) return null;

  const existingChart = echarts.getInstanceByDom(chartDom);
  if (existingChart) {
    existingChart.dispose();
  }

  const chart = echarts.init(chartDom, 'light');
  chart.setOption(option);

  return chart;
}

hexo.extend.filter.register('after_render:html', function (locals) {
    const $ = cheerio.load(locals);

    const elements = {
        post: $('#posts-chart'),
        tag: $('#tags-chart'),
        category: $('#categories-chart')
    };

    let htmlEncode = false;

    Object.keys(elements).forEach(key => {
        const el = elements[key];
        if (el.length > 0 && $(`#${key}Chart`).length === 0) {
            if (el.attr('data-encode') === 'true') htmlEncode = true;

            switch (key) {
                case 'post':
                    el.after(postsChart(el));  // Passing the element to the function for better flexibility
                    break;
                case 'tag':
                    el.after(tagsChart(el.attr('data-length')));
                    break;
                case 'category':
                    el.after(categoriesChart(el.attr('data-parent')));
                    break;
            }
        }
    });

    if (htmlEncode) {
        return $.root().html().replace(/&amp;#/g, '&#');
    } else {
        return $.root().html();
    }
}, 15);

function postsChart(el) {
    // 获取文章数据和日期范围
    const posts = hexo.locals.get('posts');
    const { monthMap, startMonth } = getPostsDateRange(posts);

    // 生成图表数据
    const monthArr = JSON.stringify([...monthMap.keys()]);
    const monthValueArr = JSON.stringify([...monthMap.values()]);

    el.attr('data-start', startMonth);

    return `
    <script id="postsChart">
        // 图表配置
        const chartConfig = {
            colors: {
                text: () => document.documentElement.getAttribute('data-theme') === 'light' ? '#4c4948' : 'rgba(255,255,255,0.7)',
                gradient: {
                    normal: [
                        { offset: 0, color: 'rgba(128, 255, 165)' },
                        { offset: 1, color: 'rgba(1, 191, 236)' }
                    ]
                }
            }
        };

        // 工具函数
        const createGradient = (colors) => new window.echarts.graphic.LinearGradient(0, 0, 0, 1, colors);
        const getTextColor = () => chartConfig.colors.text();

        function initPostsChart() {
            const chart = initChart('posts-chart', {
                title: {
                    text: '文章发布统计图',
                    x: 'center',
                    textStyle: { color: getTextColor() }
                },
                tooltip: { trigger: 'axis' },
                xAxis: {
                    name: '日期',
                    type: 'category',
                    boundaryGap: false,
                    nameTextStyle: { color: getTextColor() },
                    axisTick: { show: false },
                    axisLabel: { 
                        show: true,
                        color: getTextColor()
                    },
                    axisLine: {
                        show: true,
                        lineStyle: { color: getTextColor() }
                    },
                    data: ${monthArr}
                },
                yAxis: {
                    name: '文章篇数',
                    type: 'value',
                    nameTextStyle: { color: getTextColor() },
                    splitLine: { show: false },
                    axisTick: { show: false },
                    axisLabel: {
                        show: true,
                        color: getTextColor()
                    },
                    axisLine: {
                        show: true,
                        lineStyle: { color: getTextColor() }
                    }
                },
                series: [{
                    name: '文章篇数',
                    type: 'line',
                    smooth: true,
                    lineStyle: { width: 0 },
                    showSymbol: false,
                    itemStyle: {
                        opacity: 1,
                        color: createGradient(chartConfig.colors.gradient.normal)
                    },
                    areaStyle: {
                        opacity: 1,
                        color: createGradient(chartConfig.colors.gradient.normal)
                    },
                    data: ${monthValueArr}
                }]
            });

            if (chart) {
                // 事件处理
                window.addEventListener('resize', () => chart.resize());
                chart.on('click', 'series', (event) => {
                    if (event.componentType === 'series') {
                        window.location.href = '/archives/' + event.name.replace('-', '/');
                    }
                });
            }
        }
    </script>`;
}

// 辅助函数：获取文章日期范围和统计数据
function getPostsDateRange(posts) {
    const startDate = posts.reduce((earliest, post) => {
        return post.date.isBefore(earliest) ? post.date : earliest;
    }, moment());
    
    const startMonth = startDate.format('YYYY-MM');
    const endDate = moment();

    // 初始化月份映射
    const monthMap = new Map();
    const dayTime = 3600 * 24 * 1000;
    for (let time = startDate; time <= endDate; time += dayTime) {
        const month = moment(time).format('YYYY-MM');
        if (!monthMap.has(month)) {
            monthMap.set(month, 0);
        }
    }

    // 统计每月文章数
    posts.forEach(post => {
        const month = post.date.format('YYYY-MM');
        if (monthMap.has(month)) {
            monthMap.set(month, monthMap.get(month) + 1);
        }
    });

    return { monthMap, startMonth };
}

function tagsChart(len) {
    const tagArr = [];
    hexo.locals.get('tags').map(function (tag) {
        tagArr.push({ name: tag.name, value: tag.length, path: tag.path });
    });
    tagArr.sort((a, b) => { return b.value - a.value });

    const dataLength = Math.min(tagArr.length, len) || tagArr.length;
    const tagNameArr = [];
    for (let i = 0; i < dataLength; i++) {
        tagNameArr.push(tagArr[i].name);
    }
    const tagNameArrJson = JSON.stringify(tagNameArr);
    const tagArrJson = JSON.stringify(tagArr);

    return `
    <script id="tagsChart">
        function initTagsChart() {
            const tagsChart = document.getElementById('tags-chart');
            if (!tagsChart || !window.echarts) return;
            
            // 如果已经初始化过，先销毁
            const existingChart = echarts.getInstanceByDom(tagsChart);
            if (existingChart) {
                existingChart.dispose();
            }
            
            var color = document.documentElement.getAttribute('data-theme') === 'light' ? '#4c4948' : 'rgba(255,255,255,0.7)';
            var chart = echarts.init(tagsChart, 'light');
            var tagsOption = {
                title: {
                    text: 'Top ${dataLength} 标签统计图',
                    x: 'center',
                    textStyle: {
                        color: color
                    }
                },
                tooltip: {},
                xAxis: {
                    name: '标签',
                    type: 'category',
                    nameTextStyle: {
                        color: color
                    },
                    axisTick: {
                        show: false
                    },
                    axisLabel: {
                        show: true,
                        color: color,
                        interval: 0
                    },
                    axisLine: {
                        show: true,
                        lineStyle: {
                            color: color
                        }
                    },
                    data: ${tagNameArrJson}
                },
                yAxis: {
                    name: '文章篇数',
                    type: 'value',
                    splitLine: {
                        show: false
                    },
                    nameTextStyle: {
                        color: color
                    },
                    axisTick: {
                        show: false
                    },
                    axisLabel: {
                        show: true,
                        color: color
                    },
                    axisLine: {
                        show: true,
                        lineStyle: {
                            color: color
                        }
                    }
                },
                series: [{
                    name: '文章篇数',
                    type: 'bar',
                    data: ${tagArrJson},
                    itemStyle: {
                        borderRadius: [5, 5, 0, 0],
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{
                            offset: 0,
                            color: 'rgba(128, 255, 165)'
                        },
                        {
                            offset: 1,
                            color: 'rgba(1, 191, 236)'
                        }])
                    },
                    emphasis: {
                        itemStyle: {
                            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{
                                offset: 0,
                                color: 'rgba(128, 255, 195)'
                            },
                            {
                                offset: 1,
                                color: 'rgba(1, 211, 255)'
                            }])
                        }
                    },
                    markLine: {
                        data: [{
                            name: '平均值',
                            type: 'average',
                            label: {
                                color: color
                            }
                        }]
                    }
                }]
            };
            chart.setOption(tagsOption);
            
            function resizeChart() {
                if (chart && !chart.isDisposed()) {
                    chart.resize();
                }
            }
            
            window.addEventListener('resize', resizeChart);
            
            chart.on('click', 'series', (event) => {
                if(event.data.path) window.location.href = '/' + event.data.path;
            });
        }
    </script>`;
}

function categoriesChart(dataParent) {
    const categoryArr = [];
    let categoryParentFlag = false;
    hexo.locals.get('categories').map(function (category) {
        if (category.parent) categoryParentFlag = true;
        categoryArr.push({
            name: category.name,
            value: category.length,
            path: category.path,
            id: category._id,
            parentId: category.parent || '0'
        });
    });
    categoryParentFlag = categoryParentFlag && dataParent === 'true';
    categoryArr.sort((a, b) => { return b.value - a.value });

    function translateListToTree(data, parent) {
        let tree = [];
        let temp;
        data.forEach((item, index) => {
            if (data[index].parentId == parent) {
                let obj = data[index];
                temp = translateListToTree(data, data[index].id);
                if (temp.length > 0) {
                    obj.children = temp;
                }
                tree.push(obj);
            }
        });
        return tree;
    }
    const categoryNameJson = JSON.stringify(categoryArr.map(function (category) { return category.name; }));
    const categoryArrJson = JSON.stringify(categoryArr);
    const categoryArrParentJson = JSON.stringify(translateListToTree(categoryArr, '0'));

    return `
    <script id="categoriesChart">
        function initCategoriesChart() {
            const categoriesChart = document.getElementById('categories-chart');
            if (!categoriesChart || !window.echarts) return;
            
            // 如果已经初始化过，先销毁
            const existingChart = echarts.getInstanceByDom(categoriesChart);
            if (existingChart) {
                existingChart.dispose();
            }
            
            var color = document.documentElement.getAttribute('data-theme') === 'light' ? '#4c4948' : 'rgba(255,255,255,0.7)';
            var chart = echarts.init(categoriesChart, 'light');
            var categoryParentFlag = ${categoryParentFlag};
            var categoriesOption = {
                title: {
                    text: '文章分类统计图',
                    x: 'center',
                    textStyle: {
                        color: color
                    }
                },
                legend: {
                    top: 'bottom',
                    data: ${categoryNameJson},
                    textStyle: {
                        color: color
                    }
                },
                tooltip: {
                    trigger: 'item'
                },
                series: []
            };
            categoriesOption.series.push(
                categoryParentFlag ?
                {
                    nodeClick: false,
                    name: '文章篇数',
                    type: 'sunburst',
                    radius: ['15%', '90%'],
                    center: ['50%', '55%'],
                    sort: 'desc',
                    data: ${categoryArrParentJson},
                    itemStyle: {
                        borderColor: '#fff',
                        borderWidth: 2,
                        emphasis: {
                            focus: 'ancestor',
                            shadowBlur: 10,
                            shadowOffsetX: 0,
                            shadowColor: 'rgba(255, 255, 255, 0.5)'
                        }
                    }
                }
                :
                {
                    name: '文章篇数',
                    type: 'pie',
                    radius: [30, 80],
                    roseType: 'area',
                    label: {
                        color: color,
                        formatter: '{b} : {c} ({d}%)'
                    },
                    data: ${categoryArrJson},
                    itemStyle: {
                        emphasis: {
                            shadowBlur: 10,
                            shadowOffsetX: 0,
                            shadowColor: 'rgba(255, 255, 255, 0.5)'
                        }
                    }
                }
            );
            chart.setOption(categoriesOption);
            
            function resizeChart() {
                if (chart && !chart.isDisposed()) {
                    chart.resize();
                }
            }
            
            window.addEventListener('resize', resizeChart);
            
            chart.on('click', 'series', (event) => {
                if(event.data.path) window.location.href = '/' + event.data.path;
            });
        }
    </script>`;
}