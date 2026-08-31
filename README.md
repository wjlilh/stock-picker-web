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

> **国内访问说明：** `*.vercel.app` 在中国大陆经常无法打开（电脑、手机都会报 `ERR_TUNNEL_CONNECTION_FAILED` 或「无法访问此网站」）。**部署成功 ≠ 国内能访问。** 若 Vercel 打不开，请改用下方 **Cloudflare Pages**，或继续用本地 `npm run dev`。

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

## 手机局域网访问（Cloudflare / Vercel 都打不开时）

在公司网络下，海外托管（Vercel、Cloudflare）经常无法访问。可让 **手机和电脑连同一 WiFi**，在电脑上运行：

```bash
npm run dev:lan
```

终端会显示类似 `http://192.168.x.x:5199`，**用手机浏览器打开这个地址**即可使用（需关闭 Fiddler 或绕过 localhost）。

> Windows 查 IP：命令行运行 `ipconfig`，看「无线局域网适配器」下的 **IPv4 地址**。

## 部署到 Cloudflare Pages（国内更容易访问）

Vercel 在国内打不开的，建议用这个：

1. 打开 [https://dash.cloudflare.com](https://dash.cloudflare.com) 注册（免费）
2. 左侧 **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
3. 授权 GitHub，选择 **stock-picker-web** 仓库
4. **构建设置（必须手动填）**：
   - Framework preset：**Vite**（或 None）
   - Build command：`npm run build`
   - Build output directory：`dist`
   - Root directory：留空
5. 点 **Save and Deploy**，等 2～3 分钟
6. 得到地址：`https://stock-picker-web.pages.dev`（或类似）

> **部署失败排查：** 进入项目 → **Deployments** → 点红色失败记录 → 看 **Build log** 最后几行。若 Settings → Builds 里 Build command 为空，填 `npm run build`、Output 填 `dist` 后 **Retry deployment**。

手机浏览器打开该地址 → **添加到主屏幕**。

> 若 Cloudflare 仍不稳定，只能：① 在家用 `npm run dev` 局域网访问；② 以后换腾讯云/阿里云静态托管（需备案域名）。

## 项目结构

```
stock-picker-web/
├── api/                 # Vercel 云函数（代理东方财富，解决浏览器跨域）
│   ├── quotes.js
│   ├── index-change.js
│   └── analyze.js
├── functions/
│   ├── api/[[path]].js   # Cloudflare Pages API 路由
│   └── lib/handlers.js   # 行情抓取 + 筛选逻辑
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
