---
title: about个人头像美化
tags: hexo
categories: 魔改教程
description: 给人头像显示单调，这里在左右两边添加文本显示
background: 'https://picx.zhimg.com/80/v2-4b215eb3580425ed8cfba9b23b1eb601_1440w.webp'
cover: 'https://pic1.zhimg.com/v2-240be4fdf7297933816ca08964c82588_r.jpg'
abbrlink: 2c61
date: 2023-08-11 23:20:44
---

> 这里分享我的[关于](/about)页面个人头像美化，只有一个头像显示太单调了，这里在左右两边添加了文本显示，由于没人开源和分享，这里就肝出来了，发出来进行分享，这里适配我自己的页面，可根据自己的情况进行修改。

{% folding cyan open, 展示 %}

![about个人头像美化](https://image.baidu.com/search/down?url=https://s2.loli.net/2024/09/27/Dwv1zNmOVixpBL9.jpg)

{% endfolding %}

## pug文件

这里有用anzhiyu的删除现在用的源码，改为以下源码文件（注意缩进！！！）。

```diff
-    #about-page
-      .author-box
-        .author-img
-          img.no-lightbox(src=url_for(avatarImg) onerror=`this.onerror=null;this.src='` + url_for(theme.error_img.-flink) + `'` alt="avatar")
-        .image-dot

+    #about-page
+      .author-box
+        .author-tag-left
+          - let {tag_left,tag_right} = item.author_box
+          each i in tag_left
+            span.author-tag= `${i}`
+        .author-img
+          .image-dot
+          img.no-lightbox(src='/img/about.webp')
+        .author-tag-right
+          each i in tag_right
+            span.author-tag= `${i}`
+      - let {title_h2} = item.author_name
+      h1.aboutName= subtitle
+      h2.title_h2= title_h2
+      #author_text.author_text
+        - let { message } = item.author_text
+        each i in message
+          p.author_p(style='text-align:center;')= `${i}`
```

## css修改

这里的颜色值根据自己的情况进行修改，按**F12**进入控制台看我设置的，根据自己的进行修改。

```css
#about-page .author-tag-left {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

#about-page .author-tag-left .author-tag:first-child,
#about-page .author-tag-left .author-tag:last-child {
  margin-right: -16px;
}

#about-page .author-tag {
  transform: translate(0, -4px);
  padding: 1px 8px;
  background: var(--icemyst-card-bg);
  border: var(--style-border-always);
  border-radius: 40px;
  margin-top: 6px;
  font-size: 14px;
  font-weight: bold;
  box-shadow: var(--icemyst-shadow-lightblack);
  animation: 6s ease-in-out 0s infinite normal none running floating;
}

#about-page .author-tag:nth-child(1) {
  animation-delay: 0s;
}

#about-page .author-tag:nth-child(2) {
  animation-delay: 0.6s;
}

#about-page .author-tag:nth-child(3) {
  animation-delay: 1.2s;
}

#about-page .author-tag:nth-child(4) {
  animation-delay: 1.8s;
}

#about-page .author-tag-right .author-tag:first-child,
#about-page .author-tag-right .author-tag:last-child {
  margin-left: -16px;
}

#about-page .author-tag-right {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}
#about-page .aboutName {
  font-size: 2.7rem;
  margin-top: 10px;
  font-weight: 700;
  letter-spacing: 10px;
  -webkit-background-clip: text;
  background-image: linear-gradient(90deg, #2ca2b4, #5598de 24%, #7f87ff 45%, #f65aad 85%, #df80b4);
  display: inline-block;
  color: transparent;
  -webkit-text-stroke: 1px #bccbe4;
}


#about-page .title_h2 {
  font-size: 30px;
  margin-top: 10px;
  margin-bottom: 15px;
  -webkit-text-stroke: 1px #0072ff;
}

#author_text {
  width: 100%;
  overflow: hidden;
  position: relative;
  -webkit-text-stroke: 1px #0072ff;
}

.author_text .author_p {
  font-size: 20px;
  font-weight: lighter;
  line-height: 38px;
  -webkit-transition: all ease 0.3s;
  -moz-transition: all ease 0.3s;
  -ms-transition: all ease 0.3s;
  transition: all ease 0.3s;
  /* filter: alpha(opacity=0); */
  /* -moz-opacity: 0; */
  /* -khtml-opacity: 0; */
  /* opacity: 0; */
  cursor: pointer;
}

.author_text .author_p:hover {
  font-size: 22px;
}

.author-img {
  display: inline-block;
  width: 200px;
  height: 200px;
  border-radius: 50%;
  border: 3px solid #0072ff;
  margin: 7px;
  -webkit-animation: headneon 1.5s ease-in-out infinite alternate;
  -moz-animation: headneon 1.5s ease-in-out infinite alternate;
  animation: headneon 1.5s ease-in-out infinite alternate;
}
@keyframes floating {
  0% {
    transform: translate(0, -4px);
  }

  50% {
    transform: translate(0, 4px);
  }

  100% {
    transform: translate(0, -4px);
  }
}
@-webkit-keyframes headneon {
  from {
    box-shadow: 0 0 1px #fff,
      0 0 2px #fff,
      0 0 3px #fff,
      0 0 4px #fff;
  }

  to {
    box-shadow: 0 0 5px #fff,
      0 0 10px #fff,
      0 0 15px #fff,
      0 0 20px #fff;
  }
}

@-moz-keyframes headneon {
  from {
    box-shadow: 0 0 1px #fff,
      0 0 2px #fff,
      0 0 3px #fff,
      0 0 4px #fff;
  }

  to {
    box-shadow: 0 0 5px #fff,
      0 0 10px #fff,
      0 0 15px #fff,
      0 0 20px #fff;
  }
}
@media screen and (max-width: 700px) {
  .author_text .author_p {
    font-size: 15px;
    line-height: 20px;
  }

  #about-page .title_h2 {
    font-size: 20px;
  }

  .author-tag-left .author-tag,
  .author-tag-right .author-tag {
    display: none;
  }
}
```

## 修改yml文件

把现在你用的`about.yml`个人头像删除后引入现在用的这个。

```yml
- class_name:
# 添加以下内容
  author_box:
    tag_left:
      - 🤖️ 数码科技爱好者
      - 🔍 分享与热心帮助
      - 🏠 智能家居小能手
      - 🔨 设计开发一条龙
    tag_right:
      - 专修各种小问题 🤝
      - 脚踏实地行动派 🏃
      - 个人业余发动机 🧱
      - 人不狠话也不多 💢
  author_name:
    title_h2: 与自己促膝长谈，与孤独握手言欢。
  author_text:
    message:
      - 不久前还只是一个失业农民工.
      - 现在还只是一只喜欢动漫和文学的上班族.
      - 不久以后将是又一个人生迷茫的旅行者.
```

改好后有可能出现错乱问题，这里根据你自己的博客进行微调。