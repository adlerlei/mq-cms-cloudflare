# Electron Player 说明

## 📍 项目位置

**独立项目路径**：`~/Documents/mq-cms-electron-player`

这是一个独立的 Git 仓库，不包含在此项目中。

---

## 🎯 项目职责

Electron Player 是一个轻量级的 Electron 应用，专为树莓派设计，职责如下：

1. **生成并存储设备 UUID**
   - 存储在 `~/.config/mq-cms-player/config.json`
   - 首次启动时生成，之后永久使用

2. **启动全屏浏览器**
   - 加载 URL: `https://mq-cms.adler-lei.workers.dev/display.html?deviceId={uuid}`
   - 禁用开发者工具
   - 全屏 Kiosk 模式

3. **打包为 .deb 文件**
   - 使用 electron-builder
   - 部署到树莓派：`sudo dpkg -i mq-cms-player_x.x.x_armhf.deb`

---

## 🔗 与本项目的关系

Electron Player **不包含任何播放器逻辑**，所有播放功能都在本项目的 `public/display.html` 中实现。

```
[Electron Player] ─── HTTP 请求 ───> [Cloudflare Workers]
                                      └─ 返回 display.html
```

---

## 📦 核心文件（参考）

### main.js（简化版）
```javascript
const { app, BrowserWindow } = require('electron');
const Store = require('electron-store');
const { v4: uuidv4 } = require('uuid');

const store = new Store();

app.whenReady().then(() => {
  let deviceId = store.get('deviceId');
  if (!deviceId) {
    deviceId = uuidv4();
    store.set('deviceId', deviceId);
  }

  const mainWindow = new BrowserWindow({
    fullscreen: true,
    kiosk: true,
  });

  mainWindow.loadURL(`https://mq-cms.adler-lei.workers.dev/display.html?deviceId=${deviceId}`);
});
```

### package.json（简化版）
```json
{
  "name": "mq-cms-player",
  "version": "1.4.0",
  "main": "main.js",
  "dependencies": {
    "electron-store": "^8.1.0",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "electron": "^27.0.0",
    "electron-builder": "^24.6.4"
  },
  "build": {
    "linux": {
      "target": ["deb"],
      "arch": ["armv7l"]
    }
  }
}
```

---

## 🚀 开发流程

### 1. 修改播放器界面或逻辑
→ 编辑本项目的 `public/display.html` 和 `public/js/animation.js`  
→ 部署到 Cloudflare Workers: `npm run deploy`  
→ ✅ 树莓派自动获取最新版本（刷新页面即可）

### 2. 修改 Electron 启动逻辑
→ 编辑独立项目 `~/Documents/mq-cms-electron-player/main.js`  
→ 打包新的 .deb: `npm run build`  
→ 传输到树莓派并安装

---

## 🔧 常用命令（在 Electron 项目中）

```bash
cd ~/Documents/mq-cms-electron-player

# 开发测试
npm start

# 打包 .deb
npm run build

# 传输到树莓派
scp dist/mq-cms-player_x.x.x_armhf.deb pi@192.168.x.x:~

# SSH 到树莓派安装
ssh pi@192.168.x.x
sudo dpkg -i mq-cms-player_x.x.x_armhf.deb
```

---

## 📝 重要提醒

- **不要**将 Electron 项目代码复制到本项目中
- **不要**使用 Git Submodule 关联两个项目
- 保持两个项目**完全独立**，通过 HTTP 通信

如需查看 Electron 项目详细代码，请访问：`~/Documents/mq-cms-electron-player`
