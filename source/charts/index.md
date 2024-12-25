---
aside: false
comments: false
---

<!-- 引入 ECharts 和 Moment.js -->
<script data-pjax src="https://unpkg.com/echarts@5.5.1/dist/echarts.min.js"></script>
<!-- <script src="https://cdn.jsdelivr.net/npm/moment/min/moment.min.js"></script> -->
<!-- <script src="https://npm.elemecdn.com/echarts@4.9.0/dist/echarts.min.js"></script> -->

<!-- <div id="posts-calendar" class="js-pjax"></div> -->

<!-- 图表容器 -->
<div id="posts-chart" data-start="2022-01" style="width: 100%; height: 300px;"></div>
<div id="tags-chart" data-length="10" style="width: 100%; height: 300px;"></div>
<div id="categories-chart" data-parent="true" style="width: 100%; height: 300px;"></div>