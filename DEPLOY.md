# 部署说明

这个网站是 Node.js 站点，入口文件是 `server.js`。

## 必须设置的环境变量

- `SITE_ADMIN_PASSWORD`: 站长登录密码。不要写在代码里，部署平台里设置。
- `SESSION_SECRET`: 登录 Cookie 签名密钥，建议使用一串长随机字符。
- `PORT`: 部署平台通常会自动提供，不需要手动设置。
- `SITE_DATA_DIR`: 可选。用于保存个人介绍和每日生活记录的目录。

## Render 部署建议

1. 把 `personal-site` 上传到 GitHub 仓库。
2. 在 Render 创建 Web Service。
3. Start Command 填：

   ```bash
   npm start
   ```

4. 添加环境变量：

   ```text
   SITE_ADMIN_PASSWORD=你自己的强密码
   SESSION_SECRET=一串长随机字符
   ```

5. 如果希望日记和介绍在重启/重新部署后继续保留，请给服务配置持久化磁盘，并把 `SITE_DATA_DIR` 指到磁盘目录。

## 本地运行

PowerShell:

```powershell
$env:SITE_ADMIN_PASSWORD="你的密码"
$env:SESSION_SECRET="local-secret-change-me"
npm start
```

打开：

```text
http://127.0.0.1:4173/
```
