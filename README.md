<div align="center">
<img src="./apps/mobile/assets/images/icon_large.png" alt="logo" width="50" />
<h1>BBPlayer for iOS 🍏</h1>

一款使用 React Native 构建的本地优先的 Bilibili 音频播放器。<br>
更轻量 & 舒服的听歌体验，远离臃肿卡顿的 Bilibili 客户端。

[![GitHub Release](https://img.shields.io/github/v/release/dusttrustrs/BBPlayer-iOS-?style=flat-square&color=blue)](https://github.com/dusttrustrs/BBPlayer-iOS-/releases)
![Xcode](https://img.shields.io/badge/Xcode-26.6-blue?style=flat-square&logo=xcode&logoColor=white)
![Tested on](https://img.shields.io/badge/Tested%20on-iPhone%2017%20%7C%20iOS%2027.0-brightgreen?style=flat-square&logo=apple)
![React Native](https://img.shields.io/badge/React%20Native-20232A?style=flat-square&logo=react&logoColor=sky)
[![Upstream](https://img.shields.io/badge/Upstream-bbplayer--app%2FBBPlayer-purple?style=flat-square)](https://github.com/bbplayer-app/BBPlayer)
[![Website](https://img.shields.io/badge/Website-bbplayer.roitium.com-blue?style=flat-square)](https://bbplayer.roitium.com)

</div>

---

> 📌 **项目说明**：本项目基于官方开源项目 [bbplayer-app/BBPlayer](https://github.com/bbplayer-app/BBPlayer) 进行维护与构建，专注于 **iOS 平台的兼容性修复、启动稳定性优化以及持续的 IPA 构建打包**。

**[前往上游项目原作者官网查看更多详情和上手指南 ➔](https://bbplayer.roitium.com)**

---

## 屏幕截图 (iOS 真机实测)

| 欢迎页面 | 登录与模式选择 | 搜索页 | 音乐库 | “我的”页面 |
| :---: | :---: | :---: | :---: | :---: |
| ![欢迎页面](https://github.com/user-attachments/assets/4ebabb0a-c1d0-4ea4-b407-5edf2d17f593) | ![登录选择](https://github.com/user-attachments/assets/783d2d58-945d-44d6-8f4d-774bde8f9c71) | ![搜索](https://github.com/user-attachments/assets/953f45ea-5a4a-4b9c-9394-b714918a1a7c) | ![音乐库](https://github.com/user-attachments/assets/87842253-7c73-433b-b54e-6cb44b1d3f4e) | ![我的](https://github.com/user-attachments/assets/ad91d0e6-f20b-4785-80b5-3f5daa8967c5) |

---

## 🍏 iOS 版本支持与设备兼容性说明

本项目基于 **Xcode 26.6** 进行编译打包，并且**仅在 iPhone 17 (iOS 27.0) 进行了实机测试，可正常流畅使用**。

> ⚠️ **兼容性提示（重要）**：
> - ❌ **已知不支持 iOS 16 系统设备安装**。
> - ❓ 其他 iOS、iPadOS 版本能否正常安装和运行，**请各位用户自行下载测试**！欢迎在 Issues 中反馈你的设备型号与系统版本兼容情况。

### 📲 下载与安装指南

请前往项目的 **[Releases 页面](https://github.com/dusttrustrs/BBPlayer-iOS-/releases)** 获取最新构建的 `BBPlayer.ipa`：

| 安装方式 | 适用场景 | 说明 |
| :--- | :--- | :--- |
| **Sideloadly / AltStore** | 未越狱真机 | 配合个人 Apple ID 签名安装（7 天需续签） |
| **企业/个人自签证书** | 任意支持的设备 | 配合全能签、牛蛙助手等自签工具直接安装 |
| **TrollStore（巨魔）** | 支持巨魔的特定系统版本 | 永久有效、免越狱免续签 |

> 💡 **iOS 开发者模式提示**：安装后若打开提示“不受信任的开发者”或无法启动，请前往 iPhone **「设置」->「隐私与安全性」**，滑到最底部开启 **「开发者模式」** 并重启设备。

---

## 🌟 核心特性 (Features)

BBPlayer iOS 改版致力于在同步上游最新功能的基础上，提供更契合 iOS/iPadOS 直觉的丝滑交互体验与排版规范。

### 🎵 播放与流媒体体验
- **Bilibili 账号互联**: 支持通过**扫码**、**手机号（短信验证码）**或手动设置 Cookie 登录，直接访问账号内收藏夹与订阅合集。
- **歌单与分P支持**: 支持从**网易云音乐**和 **QQ 音乐**导入外部歌单；彻底解决分P列表加载死锁问题，支持一键创建分P歌单。
- **全功能播放器**: 涵盖循环/随机、断点续播、响度均衡；新增**播放队列清空保护**与**圆形黑胶唱片平滑旋转动效**。

### 🎨 视觉与个性化 (MD3)
- **全局色彩浸润**: 引入 Material Design 3 自适应背景色，界面容器、弹窗与导航会随主题色智能调和，兼顾 OLED 省电与色彩沉浸感。
- **纯白高对比度模式**: 完美适配官方纯白主题，并保留自定义主题色的点缀，日间视觉更加通透干净。
- **主题装扮与像素级重构**:可以在软件内搜索并应用**任意** B 站主题装扮（导航栏、开屏动画、拖拽图标、点赞动画等）。

### 👆 交互与原生适配
- **Gmail 风格队列管理**:
  - **左滑删除**：平滑展开红色警示区，松手即刻移除，彻底告别误触与 UI 残留。
  - **右滑多选**：触发绿色圆圈勾选动效，直接进入批量编辑模式。

### 🔤 歌词与扩展工具
- **专业歌词系统**: 基于 [SPL 规范](https://bbplayer.roitium.com/SPL)，支持逐字进度、罗马音注音及翻译歌词展示；支持多平台歌词智能获取、手动调整与桌面悬浮歌词。
- **iOS端歌曲下载与导出**: 支持iOS端缓存歌曲离线播放，并可将已缓存的歌曲导出为带封面、元数据、内嵌歌词的 `.m4a` 文件至本地存储。

---

## 技术栈

- **框架**: React Native, Expo
- **状态管理**: Zustand
- **数据请求**: React Query
- **UI**: Material Design 3 (React Native Paper + ExpoUI)
- **播放库**: [@bbplayer/orpheus](./packages/orpheus)
- **ORM**: Drizzle ORM

## 项目结构 (Monorepo)

- **[apps/mobile](./apps/mobile)**: BBPlayer 移动端应用核心代码。
- **[apps/backend](./apps/backend)**: 后端服务，提供歌单共享与软件更新查询（Cloudflare Worker）。
- **[apps/docs](./apps/docs)**: 项目文档站点。
- **[apps/update-publisher](./apps/update-publisher)**: 用于发布更新的工具。
- **[packages/](./packages)**: 共享库与工具包。
  - **[@bbplayer/splash](./packages/splash)**: 歌词解析与转换核心库。
  - **[@bbplayer/eslint-plugin](./packages/eslint-plugin)**: BBPlayer 专用 lint 规则。
  - **[@bbplayer/orpheus](./packages/orpheus)**: 音频播放引擎。
  - **[@bbplayer/logs](./packages/logs)**: 日志库。
  - **[@bbplayer/image-theme-colors](./packages/image-theme-colors)**: 封面颜色提取工具。
  - **[@bbplayer/native](./packages/native)**: BBPlayer 原生能力集成模块。
  - **[@bbplayer/heatmap](./packages/heatmap)**: 基于 SVG 的日期热力图组件。
  - **[expo-wavy-slider](./packages/expo-wavy-slider)**: Jetpack Compose WavySlider 的 Expo 模块封装。

## 隐私与数据统计

为了持续改进 BBPlayer，应用内集成了一套轻量级的匿名数据收集系统（包含 Firebase Analytics 和 Sentry）。

### 我们收集什么？

1. **使用数据**：功能使用频率、播放会话时长等。
2. **崩溃报告**：应用崩溃时的堆栈信息，帮助我们修复 Bug。

### 隐私承诺

- **匿名**：所有数据均**不包含个人身份信息**。
- **透明**：我们不会收集任何与账号隐私相关的信息（如 Cookie 内容、浏览历史明细等）。所有统计代码均开源可见。
- **控制权**：你可以随时在「设置 -> 通用设置」中关闭「分享数据（崩溃报告 & 匿名统计）」开关，完全停止数据上传。

## 捐赠支持（原作者）

如果你觉得 BBPlayer 对你有所帮助，欢迎考虑捐赠支持原作者团队，所有捐赠都将用于让 Roitium 吃顿疯狂星期四或是买一部 GalGame！

<table>
<tr>
<td align="center">
<details>
<summary>微信支付</summary>
<br />
<img src="./apps/mobile/assets/images/wechat.png" alt="WeChat Donation" width="200" />
</details>
</td>
<td align="center">
<details>
<summary>支付宝</summary>
<br />
<img src="./apps/mobile/assets/images/alipay.jpg" alt="Alipay Donation" width="200" />
</details>
</td>
</tr>
</table>

## 感谢与致谢

- 感谢上游项目 [bbplayer-app/BBPlayer](https://github.com/bbplayer-app/BBPlayer) 及其创作者团队带来的优秀设计！
- 以及开发过程中提供灵感的前辈们：
  - [AzusaPlayer](https://github.com/lovegaoshi/azusa-player-mobile)
  - [BiliSound](https://github.com/bilisound/client-mobile)
  - [Salt Player](https://github.com/Moriafly/SaltPlayerSource)
  - [Spotify](https://spotify.com)
  - [Bilibili](https://www.bilibili.com/)

## 开源许可

本项目采用 MIT 许可。
