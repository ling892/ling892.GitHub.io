const http = require("node:http");
const https = require("node:https");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "0.0.0.0";
const adminPassword = process.env.SITE_ADMIN_PASSWORD || "";
const sessionSecret = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");
const secureCookie = process.env.NODE_ENV === "production" ? "; Secure" : "";
const dataDir = process.env.SITE_DATA_DIR || path.join(root, "data");
const dataPath = path.join(dataDir, "site-data.json");
const defaultSiteData = {
  profile: {
    name: "你好，我是你的名字",
    role: "这里可以写职业、兴趣、城市，或者一句你喜欢的自我介绍。",
    bio: "这是一个可以长期使用的个人主页。你可以编辑这段介绍，加入自己的生活照片，并从本地图片文件夹中挑选背景，让页面随着心情变化。",
  },
  diaryEntries: [],
};
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

function sendJson(res, status, data, headers = {}) {
  send(res, status, JSON.stringify(data), {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...headers,
  });
}

function readJson(req, maxBytes = 8 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      chunks.push(chunk);
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        const text = Buffer.concat(chunks).toString("utf8");
        resolve(text ? JSON.parse(text) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function parseCookies(req) {
  return Object.fromEntries(
    (req.headers.cookie || "")
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const index = item.indexOf("=");
        return [decodeURIComponent(item.slice(0, index)), decodeURIComponent(item.slice(index + 1))];
      }),
  );
}

function signSession() {
  const payload = Buffer.from(JSON.stringify({ role: "owner" })).toString("base64url");
  const signature = crypto.createHmac("sha256", sessionSecret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function isOwner(req) {
  const token = parseCookies(req).owner_session;
  if (!token || !token.includes(".")) return false;
  const [payload, signature] = token.split(".");
  const expected = crypto.createHmac("sha256", sessionSecret).update(payload).digest("base64url");
  if (Buffer.byteLength(signature) !== Buffer.byteLength(expected)) return false;
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

function ensureDataFile() {
  fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(dataPath)) {
    fs.writeFileSync(dataPath, JSON.stringify(defaultSiteData, null, 2), "utf8");
  }
}

function readSiteData() {
  ensureDataFile();
  try {
    const parsed = JSON.parse(fs.readFileSync(dataPath, "utf8"));
    return {
      profile: { ...defaultSiteData.profile, ...(parsed.profile || {}) },
      diaryEntries: Array.isArray(parsed.diaryEntries) ? parsed.diaryEntries : [],
    };
  } catch (error) {
    return defaultSiteData;
  }
}

function writeSiteData(data) {
  ensureDataFile();
  const clean = {
    profile: { ...defaultSiteData.profile, ...(data.profile || {}) },
    diaryEntries: Array.isArray(data.diaryEntries) ? data.diaryEntries : [],
  };
  fs.writeFileSync(dataPath, JSON.stringify(clean, null, 2), "utf8");
  return clean;
}

async function handleSiteData(req, res, requestUrl) {
  if (requestUrl.pathname === "/api/site-data" && req.method === "GET") {
    sendJson(res, 200, readSiteData());
    return true;
  }

  if (requestUrl.pathname === "/api/site-data" && req.method === "PUT") {
    if (!isOwner(req)) {
      sendJson(res, 401, { ok: false, message: "需要站长登录。" });
      return true;
    }

    try {
      sendJson(res, 200, writeSiteData(await readJson(req)));
    } catch (error) {
      sendJson(res, 400, { ok: false, message: "保存失败，数据格式不正确或内容过大。" });
    }
    return true;
  }

  return false;
}

async function handleAuth(req, res, requestUrl) {
  if (requestUrl.pathname === "/api/auth/status") {
    sendJson(res, 200, {
      authenticated: isOwner(req),
      configured: Boolean(adminPassword),
    });
    return true;
  }

  if (requestUrl.pathname === "/api/auth/login" && req.method === "POST") {
    if (!adminPassword) {
      sendJson(res, 503, { ok: false, message: "SITE_ADMIN_PASSWORD is not configured." });
      return true;
    }

    try {
      const body = await readJson(req);
      if (body.password !== adminPassword) {
        sendJson(res, 401, { ok: false, message: "密码不正确。" });
        return true;
      }

      sendJson(res, 200, { ok: true }, {
        "set-cookie": `owner_session=${encodeURIComponent(signSession())}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${secureCookie}`,
      });
    } catch (error) {
      sendJson(res, 400, { ok: false, message: "登录请求格式不正确。" });
    }
    return true;
  }

  if (requestUrl.pathname === "/api/auth/logout" && req.method === "POST") {
    sendJson(res, 200, { ok: true }, {
      "set-cookie": `owner_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secureCookie}`,
    });
    return true;
  }

  return false;
}

function proxyYuc(req, res, requestUrl) {
  const rawUrl = requestUrl.searchParams.get("url") || "https://yuc.wiki/";
  const target = new URL(rawUrl);

  if (target.hostname !== "yuc.wiki") {
    send(res, 400, "Only yuc.wiki is allowed.", { "content-type": "text/plain; charset=utf-8" });
    return;
  }

  const upstream = https.request(
    target,
    {
      headers: {
        "user-agent": "personal-site-local-proxy/1.0",
        accept: "text/html,application/xml;q=0.9,*/*;q=0.8",
      },
    },
    (upstreamRes) => {
      const chunks = [];
      upstreamRes.on("data", (chunk) => chunks.push(chunk));
      upstreamRes.on("end", () => {
        send(res, upstreamRes.statusCode || 200, Buffer.concat(chunks), {
          "access-control-allow-origin": "*",
          "cache-control": "no-store",
          "content-type": upstreamRes.headers["content-type"] || "text/plain; charset=utf-8",
        });
      });
    },
  );

  upstream.on("error", (error) => {
    send(res, 502, error.message, { "content-type": "text/plain; charset=utf-8" });
  });
  upstream.end();
}

function serveStatic(res, pathname) {
  if (pathname === "/") {
    pathname = "/index.html";
  }

  const safePath = path.normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(root, safePath);

  if (!filePath.startsWith(root)) {
    send(res, 403, "Forbidden", { "content-type": "text/plain; charset=utf-8" });
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      send(res, 404, "Not found", { "content-type": "text/plain; charset=utf-8" });
      return;
    }

    send(res, 200, data, {
      "cache-control": "no-store",
      "content-type": mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream",
    });
  });
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, `http://localhost:${port}`);

  if (await handleAuth(req, res, requestUrl)) {
    return;
  }

  if (await handleSiteData(req, res, requestUrl)) {
    return;
  }

  if (requestUrl.pathname === "/api/yuc") {
    proxyYuc(req, res, requestUrl);
    return;
  }

  if (requestUrl.pathname === "/favicon.ico") {
    send(res, 204, "");
    return;
  }

  serveStatic(res, requestUrl.pathname);
});

server.listen(port, host, () => {
  console.log(`Personal site running at http://${host === "0.0.0.0" ? "127.0.0.1" : host}:${port}/`);
});
