---
title: pixel机时间无法同步解决
tags:
  - Android
  - Windows
categories: 学习笔记
description: 实用中发现pixel机时间同步功能无法正常实用，这里分享一下解决办法。
cover: >-
  https://npm.elemecdn.com/ushio-api-img-moe@5.0.40/img_403_3507x2037_72_null_normal.jpg
abbrlink: 69cf
date: 2024-10-27 21:36:47
---

> 前段部分文章：[解决Google-pixel机“网络连接受限”问题](/posts/87c.html)

## 介绍

默认 NTP（Network Time Protocol）服务器为中心为 Google 的服务器，在国内是无法正常使用的，需要科学才能正常访问谷歌服务器，导致系统认为你的网络不好，从而导致网络不稳定。

## 解决办法

1. 在终端中，通过输入adb命令：`adb shell "settings put global ntp_server pool.ntp.org"`。
2. 重启即可。

## 扩展

如果`pool.ntp.org`服务器无法正常使用，可以切换其他的服务器尝试。

```
time.apple.com.cn (中国区苹果时间服务器)
ntp.org.cn (中国国家授时中心时间服务器)
ntp1.aliyun.com (阿里云NTP时间服务器)
ntp.tencent.com (腾讯云NTP时间服务器)
ntp2.tencent.com (腾讯云NTP时间服务器)
ntp1.bce.baidu.com (百度云NTP时间服务器)
ntp4.bce.baidu.com (百度云NTP时间服务器)
ntp1.google.com (Google NTP时间服务器)
ntp2.google.com (Google NTP时间服务器)
ntp3.google.com (Google NTP时间服务器)
ntp4.google.com (Google NTP时间服务器)
```
