# 尾盘选股 · 手机网页版

按「7 步尾盘选股法」从东方财富拉取 A 股行情并筛选，适配手机浏览器，可 **添加到主屏幕** 像 App 一样使用。

部署平台：**Vercel（免费）**

## 功能

- 涨幅 3% ~ 5%
- 量比 > 1
- 换手率 5% ~ 10%
- 流通市值 50 ~ 200 亿
- 成交量台阶式放量
- 均线多头排列
- 分时在均价线上方 & 跑赢上证指数

筛选条件保存在手机浏览器本地（localStorage）。

## 本地开发（Windows）

```bash
cd stock-picker-web
npm install
npm run dev
```

浏览器打开：**http://127.0.0.1:5199** 或 **http://localhost:5199**

> 若页面显示 `[Fiddler] ConnectionRefused`：请关闭 Fiddler 抓包，或在 Fiddler → Tools → Options → Connections 勾选 **Bypass Fiddler for localhost**，然后刷新页面。

> 本地会通过 `server/dev-api.cjs` 代理东方财富接口；部署到 Vercel 后自动使用 `api/` 云函数。

## 部署到 Vercel（推荐）

### 1. 准备 GitHub 仓库

```bash
cd stock-picker-web
git init
git add .
git commit -m "init stock picker web"
```

在 GitHub 新建仓库，推送代码。

### 2. 注册并部署 Vercel

1. 打开 [https://vercel.com](https://vercel.com) 注册（可用 GitHub 登录）
2. 点击 **Add New → Project**
3. 选择刚推送的仓库 **stock-picker-web**
4. Framework 选 **Vite**（一般会自动识别）
5. 点击 **Deploy**，等待 1～2 分钟
6. 得到地址：`https://你的项目名.vercel.app`

### 3. 手机使用

1. 手机浏览器打开上面的 `https://` 地址
2. **iPhone Safari**：分享 → **添加到主屏幕**
3. **Android Chrome**：菜单 → **添加到主屏幕** / **安装应用**

之后从桌面图标打开即可。

## 项目结构

```
stock-picker-web/
├── api/                 # Vercel 云函数（代理东方财富，解决浏览器跨域）
│   ├── quotes.js
│   ├── index-change.js
│   └── analyze.js
├── lib/handlers.js      # 行情抓取 + 筛选逻辑
├── src/                 # 手机网页前端
├── public/              # PWA manifest、图标、Service Worker
├── server/dev-api.cjs   # 本地开发 API
└── vercel.json
```

## 费用说明

| 项目 | 费用 |
|------|------|
| Vercel 托管网页 | 个人免费额度通常够用 |
| 云函数调用 | 每次筛选会多次调用，个人使用一般免费 |
| 自己的服务器 | **不需要** |

## 免责声明

仅供学习研究，数据来自公开接口，不保证实时性与准确性，**不构成投资建议**。股市有风险，投资需谨慎。
