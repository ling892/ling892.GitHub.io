const defaults = {
  name: "你好，我是你的名字",
  role: "这里可以写职业、兴趣、城市，或者一句你喜欢的自我介绍。",
  bio: "这是一个可以长期使用的个人主页。你可以编辑这段介绍，加入自己的生活照片，并从本地图片文件夹中挑选背景，让页面随着心情变化。",
};

const imageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/bmp", "image/avif"]);

const elements = {
  navName: document.querySelector("#navName"),
  profileName: document.querySelector("#profileName"),
  profileRole: document.querySelector("#profileRole"),
  profileBio: document.querySelector("#profileBio"),
  ownerStatus: document.querySelector("#ownerStatus"),
  ownerLoginForm: document.querySelector("#ownerLoginForm"),
  ownerPassword: document.querySelector("#ownerPassword"),
  ownerLogout: document.querySelector("#ownerLogout"),
  saveProfile: document.querySelector("#saveProfile"),
  resetProfile: document.querySelector("#resetProfile"),
  backgroundLayer: document.querySelector(".background-layer"),
  backgroundPreview: document.querySelector("#backgroundPreview"),
  backgroundFolderInput: document.querySelector("#backgroundFolderInput"),
  chooseBackgroundFolder: document.querySelector("#chooseBackgroundFolder"),
  prevBackground: document.querySelector("#prevBackground"),
  nextBackground: document.querySelector("#nextBackground"),
  randomBackground: document.querySelector("#randomBackground"),
  backgroundCount: document.querySelector("#backgroundCount"),
  backgroundStatus: document.querySelector("#backgroundStatus"),
  galleryInput: document.querySelector("#galleryInput"),
  chooseGalleryImages: document.querySelector("#chooseGalleryImages"),
  clearGallery: document.querySelector("#clearGallery"),
  galleryGrid: document.querySelector("#galleryGrid"),
  diaryForm: document.querySelector("#diaryForm"),
  diaryDate: document.querySelector("#diaryDate"),
  diaryMood: document.querySelector("#diaryMood"),
  diaryTitle: document.querySelector("#diaryTitle"),
  diaryContent: document.querySelector("#diaryContent"),
  diaryImageInput: document.querySelector("#diaryImageInput"),
  chooseDiaryImages: document.querySelector("#chooseDiaryImages"),
  clearDiaryImages: document.querySelector("#clearDiaryImages"),
  diaryPhotoPreview: document.querySelector("#diaryPhotoPreview"),
  clearDiaryForm: document.querySelector("#clearDiaryForm"),
  diaryList: document.querySelector("#diaryList"),
  diaryCount: document.querySelector("#diaryCount"),
  refreshAnime: document.querySelector("#refreshAnime"),
  animeFeed: document.querySelector("#animeFeed"),
  animeUpdated: document.querySelector("#animeUpdated"),
  scheduleSeason: document.querySelector("#scheduleSeason"),
  scheduleTodayTitle: document.querySelector("#scheduleTodayTitle"),
  scheduleSource: document.querySelector("#scheduleSource"),
  scheduleSourceLink: document.querySelector("#scheduleSourceLink"),
  weekdayTabs: document.querySelector("#weekdayTabs"),
  todaySchedule: document.querySelector("#todaySchedule"),
  toast: document.querySelector("#toast"),
};

let backgroundImages = [];
let currentBackgroundIndex = 0;
let galleryUrls = [];
let toastTimer;
let diaryEntries = [];
let pendingDiaryImages = [];
let scheduleDays = [];
let selectedScheduleDay = null;
let ownerAuthenticated = false;
let siteData = {
  profile: { ...defaults },
  diaryEntries: [],
};

const weekDays = [
  { key: "周日", label: "周日", jp: "日", dateDay: 0 },
  { key: "周一", label: "周一", jp: "月", dateDay: 1 },
  { key: "周二", label: "周二", jp: "火", dateDay: 2 },
  { key: "周三", label: "周三", jp: "水", dateDay: 3 },
  { key: "周四", label: "周四", jp: "木", dateDay: 4 },
  { key: "周五", label: "周五", jp: "金", dateDay: 5 },
  { key: "周六", label: "周六", jp: "土", dateDay: 6 },
];

function isImageFile(file) {
  return imageTypes.has(file.type) || /\.(png|jpe?g|webp|gif|bmp|avif)$/i.test(file.name);
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("show"), 2200);
}

function setEditableText(node, value) {
  node.textContent = value;
}

async function apiJson(url, options = {}) {
  const response = await fetch(url, {
    cache: "no-store",
    headers: { "content-type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || `HTTP ${response.status}`);
  }
  return data;
}

function setOwnerMode(isOwner, configured = true) {
  ownerAuthenticated = isOwner;
  document.body.classList.toggle("owner-mode", isOwner);
  elements.profileName.contentEditable = String(isOwner);
  elements.profileRole.contentEditable = String(isOwner);
  elements.profileBio.contentEditable = String(isOwner);
  elements.ownerStatus.textContent = isOwner ? "站长模式" : configured ? "访客模式" : "未配置密码";
  elements.ownerLoginForm.hidden = isOwner || !configured;
  elements.ownerLogout.hidden = !isOwner;
  renderDiaryEntries();
}

async function loadAuthStatus() {
  try {
    const status = await apiJson("/api/auth/status");
    setOwnerMode(status.authenticated, status.configured);
  } catch (error) {
    setOwnerMode(false, false);
  }
}

async function loginOwner(event) {
  event.preventDefault();
  try {
    await apiJson("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ password: elements.ownerPassword.value }),
    });
    elements.ownerPassword.value = "";
    await loadAuthStatus();
    await loadSiteData();
    showToast("已进入站长模式。");
  } catch (error) {
    showToast(error.message || "登录失败。");
  }
}

async function logoutOwner() {
  await apiJson("/api/auth/logout", { method: "POST", body: "{}" }).catch(() => {});
  await loadAuthStatus();
  showToast("已退出站长模式。");
}

async function loadSiteData() {
  try {
    siteData = await apiJson("/api/site-data");
  } catch (error) {
    siteData = {
      profile: JSON.parse(localStorage.getItem("personalSiteProfile") || "null") || { ...defaults },
      diaryEntries: JSON.parse(localStorage.getItem("personalSiteDiary") || "[]"),
    };
  }
  readProfile();
  loadDiaryEntries();
}

async function saveSiteData() {
  siteData.profile = {
    name: elements.profileName.textContent.trim() || defaults.name,
    role: elements.profileRole.textContent.trim() || defaults.role,
    bio: elements.profileBio.textContent.trim() || defaults.bio,
  };
  siteData.diaryEntries = diaryEntries;
  siteData = await apiJson("/api/site-data", {
    method: "PUT",
    body: JSON.stringify(siteData),
  });
}

function readProfile() {
  const profile = siteData.profile || defaults;
  setEditableText(elements.profileName, profile.name);
  setEditableText(elements.profileRole, profile.role);
  setEditableText(elements.profileBio, profile.bio);
  elements.navName.textContent = profile.name.replace(/^你好，我是/, "").trim() || "我的个人网站";
}

async function saveProfile() {
  try {
    await saveSiteData();
    readProfile();
    showToast("介绍已保存。");
  } catch (error) {
    showToast("需要站长登录后才能保存。");
  }
}

async function resetProfile() {
  setEditableText(elements.profileName, defaults.name);
  setEditableText(elements.profileRole, defaults.role);
  setEditableText(elements.profileBio, defaults.bio);
  await saveProfile();
  showToast("介绍已恢复默认。");
}

function revokeBackgroundUrls() {
  backgroundImages.forEach((item) => URL.revokeObjectURL(item.url));
  backgroundImages = [];
}

function setBackground(index) {
  if (!backgroundImages.length) {
    elements.backgroundLayer.style.backgroundImage = "";
    elements.backgroundPreview.style.backgroundImage = "";
    elements.backgroundCount.textContent = "默认背景";
    elements.backgroundStatus.textContent = "当前使用默认背景。";
    return;
  }

  currentBackgroundIndex = (index + backgroundImages.length) % backgroundImages.length;
  const current = backgroundImages[currentBackgroundIndex];
  const image = `url("${current.url}")`;
  elements.backgroundLayer.style.backgroundImage = image;
  elements.backgroundPreview.style.backgroundImage = image;
  elements.backgroundCount.textContent = `${currentBackgroundIndex + 1} / ${backgroundImages.length}`;
  elements.backgroundStatus.textContent = current.name;
}

function loadBackgroundFolder(files) {
  const images = Array.from(files)
    .filter(isImageFile)
    .sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));

  if (!images.length) {
    showToast("没有找到可用图片。");
    return;
  }

  revokeBackgroundUrls();
  backgroundImages = images.map((file) => ({
    name: file.webkitRelativePath || file.name,
    url: URL.createObjectURL(file),
  }));
  setBackground(0);
  showToast(`已读取 ${backgroundImages.length} 张背景图片。`);
}

function cycleBackground(step) {
  if (!backgroundImages.length) {
    showToast("先选择一个图片文件夹。");
    return;
  }
  setBackground(currentBackgroundIndex + step);
}

function randomBackground() {
  if (!backgroundImages.length) {
    showToast("先选择一个图片文件夹。");
    return;
  }
  if (backgroundImages.length === 1) {
    setBackground(0);
    return;
  }

  let next = currentBackgroundIndex;
  while (next === currentBackgroundIndex) {
    next = Math.floor(Math.random() * backgroundImages.length);
  }
  setBackground(next);
}

function clearGalleryView() {
  elements.galleryGrid.innerHTML = `
    <article class="empty-gallery">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
        <path d="m4 16 4-4 4 4 3-3 5 5" />
        <circle cx="15" cy="8" r="1.5" />
      </svg>
      <p>添加图片后会显示在这里。</p>
    </article>
  `;
}

function addGalleryImages(files) {
  const images = Array.from(files).filter(isImageFile);
  if (!images.length) {
    showToast("没有找到可用图片。");
    return;
  }

  if (elements.galleryGrid.querySelector(".empty-gallery")) {
    elements.galleryGrid.innerHTML = "";
  }

  images.forEach((file) => {
    const url = URL.createObjectURL(file);
    galleryUrls.push(url);

    const figure = document.createElement("figure");
    figure.className = "photo-card";

    const img = document.createElement("img");
    img.src = url;
    img.alt = file.name;
    img.loading = "lazy";

    const caption = document.createElement("figcaption");
    caption.textContent = file.name;

    figure.append(img, caption);
    elements.galleryGrid.append(figure);
  });

  showToast(`已添加 ${images.length} 张图片。`);
}

function clearGallery() {
  galleryUrls.forEach((url) => URL.revokeObjectURL(url));
  galleryUrls = [];
  clearGalleryView();
  elements.galleryInput.value = "";
  showToast("相册已清空。");
}

function todayValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function createEntryId() {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `entry-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatDate(value) {
  if (!value) return "未设置日期";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(`${value}T00:00:00`));
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", reject);
    image.src = src;
  });
}

async function compressImage(file, maxSize = 1200, quality = 0.82) {
  const dataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(dataUrl);
  const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return {
    name: file.name,
    src: canvas.toDataURL("image/jpeg", quality),
  };
}

function renderDiaryPhotoPreview() {
  elements.diaryPhotoPreview.innerHTML = "";
  if (!pendingDiaryImages.length) {
    elements.diaryPhotoPreview.innerHTML = `<p>还没有选择图片。</p>`;
    return;
  }

  pendingDiaryImages.forEach((photo) => {
    const img = document.createElement("img");
    img.src = photo.src;
    img.alt = photo.name || "生活记录图片";
    elements.diaryPhotoPreview.append(img);
  });
}

async function addDiaryImages(files) {
  const images = Array.from(files).filter(isImageFile);
  if (!images.length) {
    showToast("没有找到可用图片。");
    return;
  }

  const availableSlots = Math.max(0, 4 - pendingDiaryImages.length);
  const selected = images.slice(0, availableSlots);
  if (!selected.length) {
    showToast("每条记录最多保存 4 张图片。");
    return;
  }

  showToast("正在处理图片。");
  const compressed = await Promise.all(selected.map((file) => compressImage(file)));
  pendingDiaryImages = [...pendingDiaryImages, ...compressed];
  renderDiaryPhotoPreview();
  if (images.length > selected.length) {
    showToast("已添加前 4 张图片。");
  } else {
    showToast(`已添加 ${selected.length} 张图片。`);
  }
}

function clearDiaryImages() {
  pendingDiaryImages = [];
  elements.diaryImageInput.value = "";
  renderDiaryPhotoPreview();
}

function loadDiaryEntries() {
  diaryEntries = [...(siteData.diaryEntries || [])];
  diaryEntries.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  renderDiaryEntries();
}

async function saveDiaryEntries() {
  siteData.diaryEntries = diaryEntries;
  await saveSiteData();
}

function renderDiaryEntries() {
  elements.diaryCount.textContent = `${diaryEntries.length} 条`;
  if (!diaryEntries.length) {
    elements.diaryList.innerHTML = `<p class="diary-empty">还没有生活记录。写下第一条之后，它会保存在这里。</p>`;
    return;
  }

  elements.diaryList.innerHTML = "";
  diaryEntries.forEach((entry) => {
    const article = document.createElement("article");
    article.className = "diary-entry";

    const top = document.createElement("div");
    top.className = "entry-topline";

    const title = document.createElement("h4");
    title.textContent = entry.title;

    const meta = document.createElement("span");
    meta.className = "entry-meta";
    meta.textContent = `${formatDate(entry.date)} · ${entry.mood}`;

    const content = document.createElement("p");
    content.textContent = entry.content;

    const gallery = document.createElement("div");
    gallery.className = "diary-entry-gallery";
    (entry.images || []).forEach((photo) => {
      const img = document.createElement("img");
      img.src = photo.src;
      img.alt = photo.name || "生活记录图片";
      gallery.append(img);
    });

    const actions = document.createElement("div");
    actions.className = "entry-actions owner-only";

    top.append(title, meta);
    article.append(top, content);
    if (gallery.children.length) {
      article.append(gallery);
    }
    if (ownerAuthenticated) {
      const edit = document.createElement("button");
      edit.type = "button";
      edit.textContent = "编辑";
      edit.addEventListener("click", () => editDiaryEntry(entry.id));

      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "删除";
      remove.addEventListener("click", () => deleteDiaryEntry(entry.id));

      actions.append(edit, remove);
      article.append(actions);
    }
    elements.diaryList.append(article);
  });
}

function resetDiaryForm() {
  elements.diaryForm.reset();
  elements.diaryDate.value = todayValue();
  delete elements.diaryForm.dataset.editingId;
  clearDiaryImages();
}

async function upsertDiaryEntry(event) {
  event.preventDefault();
  const entry = {
    id: elements.diaryForm.dataset.editingId || createEntryId(),
    date: elements.diaryDate.value,
    mood: elements.diaryMood.value,
    title: elements.diaryTitle.value.trim(),
    content: elements.diaryContent.value.trim(),
    images: pendingDiaryImages.map((photo) => ({ ...photo })),
    createdAt: new Date().toISOString(),
  };

  if (!entry.title || !entry.content) {
    showToast("标题和内容都要填写。");
    return;
  }

  const existingIndex = diaryEntries.findIndex((item) => item.id === entry.id);
  if (existingIndex >= 0) {
    entry.createdAt = diaryEntries[existingIndex].createdAt;
    diaryEntries[existingIndex] = entry;
  } else {
    diaryEntries.unshift(entry);
  }

  await saveDiaryEntries();
  loadDiaryEntries();
  resetDiaryForm();
  showToast(existingIndex >= 0 ? "记录已更新。" : "今日生活已保存。");
}

function editDiaryEntry(id) {
  const entry = diaryEntries.find((item) => item.id === id);
  if (!entry) return;
  elements.diaryForm.dataset.editingId = id;
  elements.diaryDate.value = entry.date;
  elements.diaryMood.value = entry.mood;
  elements.diaryTitle.value = entry.title;
  elements.diaryContent.value = entry.content;
  pendingDiaryImages = (entry.images || []).map((photo) => ({ ...photo }));
  renderDiaryPhotoPreview();
  elements.diaryTitle.focus();
  showToast("正在编辑这条记录。");
}

async function deleteDiaryEntry(id) {
  diaryEntries = diaryEntries.filter((entry) => entry.id !== id);
  await saveDiaryEntries();
  if (elements.diaryForm.dataset.editingId === id) {
    resetDiaryForm();
  }
  renderDiaryEntries();
  showToast("记录已删除。");
}

function cleanAnimeText(value) {
  const helper = document.createElement("textarea");
  helper.innerHTML = value || "";
  const decoded = helper.value.replace(/<[^>]*>?/g, " ");
  return decoded.replace(/\{[^}]*\}/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeAnimeLink(link) {
  return (link || "https://yuc.wiki/").replace(/^http:\/\//, "https://");
}

async function fetchYucText(url) {
  const target = normalizeAnimeLink(url);
  const shouldUseLocalProxy = location.protocol !== "file:";
  const endpoint = shouldUseLocalProxy ? `/api/yuc?url=${encodeURIComponent(target)}` : target;
  const response = await fetch(endpoint, { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

function normalizeImageUrl(url) {
  if (!url) return "";
  if (url.startsWith("//")) return `https:${url}`;
  return url.replace(/^http:\/\//, "https://");
}

function getCurrentAnimeSeason(date = new Date()) {
  const month = date.getMonth() + 1;
  const seasonMonth = month >= 10 ? "10" : month >= 7 ? "07" : month >= 4 ? "04" : "01";
  return {
    slug: `2026${seasonMonth}`,
    label: `2026年${Number(seasonMonth)}月新番表`,
    url: `https://yuc.wiki/2026${seasonMonth}/`,
  };
}

function getTodayWeekKey(date = new Date()) {
  return weekDays.find((day) => day.dateDay === date.getDay())?.key || "周一";
}

function extractWeekdayBlock(html, dayKey) {
  const escaped = dayKey.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`<!--${escaped}-->([\\s\\S]*?)(?=<!--周[一二三四五六日]-->|</article>|$)`);
  return html.match(pattern)?.[1] || "";
}

function parseScheduleCard(node) {
  const time = cleanAnimeText(node.querySelector(".imgtext4")?.textContent || "时间待定");
  const start = cleanAnimeText(
    node.querySelector(".imgep2")?.textContent || node.querySelector(".imgep")?.textContent || "",
  );
  const title = cleanAnimeText(node.querySelector('[class^="date_title"]')?.textContent || "");
  const image = normalizeImageUrl(
    node.querySelector(".div_date img")?.getAttribute("data-src") || node.querySelector(".div_date img")?.getAttribute("src") || "",
  );
  const areas = Array.from(node.querySelectorAll(".area"))
    .map((area) => cleanAnimeText(area.textContent))
    .filter(Boolean);
  const firstLink = node.querySelector(".tr_area a")?.getAttribute("href") || "";

  if (!title) return null;
  return {
    time,
    start,
    title,
    image,
    areas,
    link: normalizeAnimeLink(firstLink),
  };
}

function parseYucSchedule(html) {
  return weekDays
    .map((day) => {
      const block = extractWeekdayBlock(html, day.key);
      const doc = new DOMParser().parseFromString(`<main>${block}</main>`, "text/html");
      const shows = Array.from(doc.querySelectorAll('div[style*="float:left"]')).map(parseScheduleCard).filter(Boolean);
      return { ...day, shows };
    })
    .filter((day) => day.shows.length);
}

async function fetchScheduleWithFallback() {
  const preferred = getCurrentAnimeSeason();
  const candidates = [
    preferred,
    { slug: "202604", label: "2026年4月新番表", url: "https://yuc.wiki/202604/" },
    { slug: "202601", label: "2026年1月新番表", url: "https://yuc.wiki/202601/" },
  ].filter((item, index, array) => array.findIndex((candidate) => candidate.slug === item.slug) === index);

  let lastError;
  for (const candidate of candidates) {
    try {
      return {
        ...candidate,
        html: await fetchYucText(candidate.url),
      };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("无法读取 2026 新番表");
}

async function loadAnimeSchedule() {
  elements.scheduleTodayTitle.textContent = "今天更新";
  elements.scheduleSource.textContent = "正在实时读取 yuc.wiki 的 2026 新番表。";
  elements.todaySchedule.innerHTML = `<p class="feed-empty">正在读取今天的新番日程。</p>`;
  elements.weekdayTabs.innerHTML = "";

  try {
    const source = await fetchScheduleWithFallback();
    scheduleDays = parseYucSchedule(source.html);
    selectedScheduleDay = getTodayWeekKey();
    renderSchedule(source);
  } catch (error) {
    elements.scheduleSeason.textContent = "读取失败";
    elements.scheduleSource.textContent = "暂时无法读取 yuc.wiki 的 2026 新番表，请稍后刷新。";
    elements.todaySchedule.innerHTML = `<p class="feed-empty">读取失败。你仍可以点击右侧快速入口打开 yuc.wiki 查看。</p>`;
  }
}

function renderSchedule(source) {
  const now = new Date();
  const todayKey = getTodayWeekKey(now);
  const currentDay = scheduleDays.find((day) => day.key === selectedScheduleDay) || scheduleDays[0];

  elements.scheduleSeason.textContent = source.label;
  elements.scheduleTodayTitle.textContent =
    currentDay.key === todayKey ? `今天 ${currentDay.label} 更新` : `${currentDay.label} 更新`;
  elements.scheduleSource.textContent = `实时来源：yuc.wiki · ${now.toLocaleDateString("zh-CN")} · 当前读取 ${source.slug}`;
  elements.scheduleSourceLink.href = source.url;
  elements.scheduleSourceLink.textContent = "查看原表";

  elements.weekdayTabs.innerHTML = "";
  scheduleDays.forEach((day) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = day.key === currentDay.key ? "active" : "";
    button.innerHTML = `<strong>${day.label}</strong><span>${day.shows.length} 部</span>`;
    button.addEventListener("click", () => {
      selectedScheduleDay = day.key;
      renderSchedule(source);
    });
    elements.weekdayTabs.append(button);
  });

  renderScheduleCards(currentDay?.shows || []);
}

function renderScheduleCards(shows) {
  if (!shows.length) {
    elements.todaySchedule.innerHTML = `<p class="feed-empty">这一天暂时没有读取到新番更新。</p>`;
    return;
  }

  elements.todaySchedule.innerHTML = "";
  shows.forEach((show) => {
    const article = document.createElement("article");
    article.className = "schedule-card";

    const image = document.createElement("img");
    image.alt = show.title;
    image.loading = "lazy";
    image.referrerPolicy = "no-referrer";
    image.src = show.image || "./assets/default-background.png";

    const body = document.createElement("div");
    body.className = "schedule-card-body";

    const time = document.createElement("div");
    time.className = "schedule-time";
    const timeValue = document.createElement("span");
    timeValue.textContent = show.time;
    time.append(timeValue);
    if (show.start) {
      const startValue = document.createElement("span");
      startValue.textContent = show.start;
      time.append(startValue);
    }

    const title = document.createElement("h4");
    title.textContent = show.title;

    const area = document.createElement("p");
    area.className = "schedule-area";
    area.textContent = show.areas.length ? `平台/地区：${show.areas.join("、")}` : "平台/地区：待确认";

    body.append(time, title, area);

    if (show.link) {
      const link = document.createElement("a");
      link.href = show.link;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "播放/详情";
      body.append(link);
    }

    article.append(image, body);
    elements.todaySchedule.append(article);
  });
}

async function loadAnimeUpdates() {
  elements.animeFeed.innerHTML = `<p class="feed-empty">正在读取 yuc.wiki 更新。</p>`;
  elements.animeUpdated.textContent = "读取中";

  try {
    const xmlText = await fetchYucText("https://yuc.wiki/atom.xml");
    const doc = new DOMParser().parseFromString(xmlText, "application/xml");
    const entries = Array.from(doc.querySelectorAll("entry")).slice(0, 8).map((entry) => {
      const link = entry.querySelector("link")?.getAttribute("href") || entry.querySelector("id")?.textContent;
      return {
        title: cleanAnimeText(entry.querySelector("title")?.textContent || "未命名更新"),
        updated: entry.querySelector("updated")?.textContent || "",
        summary: cleanAnimeText(entry.querySelector("summary")?.textContent || "").slice(0, 120),
        link: normalizeAnimeLink(link),
      };
    });

    renderAnimeUpdates(entries);
  } catch (error) {
    elements.animeUpdated.textContent = "读取失败";
    elements.animeFeed.innerHTML = `
      <p class="feed-empty">
        暂时无法自动读取更新。可以点击“打开 yuc.wiki”直接查看每日动漫内容。
      </p>
    `;
    showToast("动漫更新读取失败，可直接打开 yuc.wiki。");
  }
}

function renderAnimeUpdates(entries) {
  if (!entries.length) {
    elements.animeUpdated.textContent = "暂无条目";
    elements.animeFeed.innerHTML = `<p class="feed-empty">没有读取到更新条目。</p>`;
    return;
  }

  const latestDate = entries[0].updated ? new Date(entries[0].updated) : new Date();
  elements.animeUpdated.textContent = `更新于 ${latestDate.toLocaleDateString("zh-CN")}`;
  elements.animeFeed.innerHTML = "";

  entries.forEach((entry) => {
    const article = document.createElement("article");
    article.className = "anime-entry";

    const top = document.createElement("div");
    top.className = "entry-topline";

    const title = document.createElement("h4");
    title.textContent = entry.title;

    const meta = document.createElement("span");
    meta.className = "entry-meta";
    meta.textContent = entry.updated ? new Date(entry.updated).toLocaleDateString("zh-CN") : "更新";

    const summary = document.createElement("p");
    summary.textContent = entry.summary || "点击查看完整新番信息。";

    const actions = document.createElement("div");
    actions.className = "entry-actions";

    const link = document.createElement("a");
    link.href = entry.link;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "查看详情";

    top.append(title, meta);
    actions.append(link);
    article.append(top, summary, actions);
    elements.animeFeed.append(article);
  });
}

elements.ownerLoginForm.addEventListener("submit", loginOwner);
elements.ownerLogout.addEventListener("click", logoutOwner);
elements.saveProfile.addEventListener("click", saveProfile);
elements.resetProfile.addEventListener("click", resetProfile);

elements.chooseBackgroundFolder.addEventListener("click", () => elements.backgroundFolderInput.click());
elements.backgroundFolderInput.addEventListener("change", (event) => {
  loadBackgroundFolder(event.target.files);
});
elements.prevBackground.addEventListener("click", () => cycleBackground(-1));
elements.nextBackground.addEventListener("click", () => cycleBackground(1));
elements.randomBackground.addEventListener("click", randomBackground);

elements.chooseGalleryImages.addEventListener("click", () => elements.galleryInput.click());
elements.galleryInput.addEventListener("change", (event) => addGalleryImages(event.target.files));
elements.clearGallery.addEventListener("click", clearGallery);

elements.chooseDiaryImages.addEventListener("click", () => elements.diaryImageInput.click());
elements.diaryImageInput.addEventListener("change", (event) => {
  addDiaryImages(event.target.files).catch(() => showToast("图片处理失败，请换一张试试。"));
});
elements.clearDiaryImages.addEventListener("click", () => {
  clearDiaryImages();
  showToast("已移除待保存图片。");
});
elements.diaryForm.addEventListener("submit", (event) => {
  upsertDiaryEntry(event).catch(() => showToast("需要站长登录后才能保存记录。"));
});
elements.clearDiaryForm.addEventListener("click", () => {
  resetDiaryForm();
  showToast("输入已清空。");
});
elements.refreshAnime.addEventListener("click", () => {
  loadAnimeSchedule();
  loadAnimeUpdates();
});

window.addEventListener("beforeunload", () => {
  revokeBackgroundUrls();
  galleryUrls.forEach((url) => URL.revokeObjectURL(url));
});

loadAuthStatus();
resetDiaryForm();
loadSiteData();
loadAnimeSchedule();
loadAnimeUpdates();
