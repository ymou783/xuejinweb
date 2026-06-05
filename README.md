# 雪烬电竞门户

本项目现在是适合腾讯云服务器部署的 Node.js + SQLite 站点。

## 本地运行

```powershell
npm start
```

然后打开：

- 前台：`http://localhost:3000`
- 后台：`http://localhost:3000/admin.html`
- 日志页：`http://localhost:3000/logs.html`
- 摸红天平：`http://localhost:3000/games/mo-hong-tianping.html`
- BINGO 2.0 超级版：`http://localhost:3000/games/bingo2-super.html`

后台是可视化页面，登录后可以修改首页名称、头像路径、联系方式、轮播、多条公告、手游/端游价目表、陪陪音卡、趣味单游戏区、老板须知和关于内容。公告、套餐、音卡、趣味单游戏、老板须知都支持上传图片；音卡和老板须知也支持上传视频或内容文件。

后台上传的文件会保存到 `public/uploads`，前台会直接使用返回的文件地址。

后台包含“媒体管理”和“数据备份”：

- 媒体管理：查看和删除 `public/uploads` 中的上传图片、视频
- 数据备份：手动备份 `data/xuejin.sqlite` 和 `public/uploads` 到 `backups` 文件夹

房间功能在后台的“房间管理”里使用：选择一个已经填写页面链接的趣味单游戏，点击创建房间，会生成类似 `XJ-7KQ9M` 的房间号。前台每个页面右上角都有“进入房间”入口，输入房间号后会跳转到对应小游戏。进入同一房间的人会共享同一份游戏数据。操作日志单独在 `logs.html` 查看，已删除房间的日志也会保留。

默认后台密码是 `123456`。正式部署前请设置环境变量：

```bash
ADMIN_TOKEN=你的强密码 PORT=3000 npm start
```

SQLite 数据库会自动创建在 `data/xuejin.sqlite`。

## 腾讯云部署建议

服务器需要安装 Node.js 22.5 或以上版本。项目没有第三方依赖，上传代码后进入项目目录即可启动：

```bash
ADMIN_TOKEN=123456 PORT=3000 node server/index.js
```

建议使用 PM2 常驻运行：

```bash
npm install -g pm2
ADMIN_TOKEN=123456 PORT=3000 pm2 start server/index.js --name xuejin-web
pm2 save
```

如果域名是 `xuejinclub.com`，可以用 Nginx 转发到本项目：

```nginx
server {
    listen 80;
    server_name xuejinclub.com www.xuejinclub.com;

    client_max_body_size 120m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

需要长期保留的数据：

- `data/xuejin.sqlite`：后台内容、房间、房间日志
- `public/uploads`：后台上传的图片和视频
- `backups`：后台手动创建的备份

迁移服务器或更新代码时，不要覆盖这些数据位置。房间删除是软删除，后台列表会移除房间，但日志仍保存在数据库中。
