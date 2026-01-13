const gameNameInput = document.getElementById('gameName');
const gameTagsInput = document.getElementById('gameTags');
const image1Input = document.getElementById('image1');
const image2Input = document.getElementById('image2');
const generateBtn = document.getElementById('generateBtn');
const downloadBtn = document.getElementById('downloadBtn');
const canvas = document.getElementById('previewCanvas');
const placeholder = document.getElementById('placeholder');
const watermarkInput = document.getElementById('watermarkText');
const watermarkOnBtn = document.getElementById('watermarkOnBtn');
const watermarkOffBtn = document.getElementById('watermarkOffBtn');

// Steam 相关元素
const steamSearchInput = document.getElementById('steamSearchInput');
const steamSearchBtn = document.getElementById('steamSearchBtn');
const steamScreenshotsContainer = document.getElementById('steamScreenshots');
const sourceSteamBtn = document.getElementById('sourceSteamBtn');
const sourceLocalBtn = document.getElementById('sourceLocalBtn');
const steamSourceGroup = document.getElementById('steamSourceGroup');
const localSourceGroup = document.getElementById('localSourceGroup');

const ctx = canvas.getContext('2d');

// 下载计数器，用于生成有序文件名
let downloadIndex = 1;

// 水印开关状态，默认开启
let watermarkEnabled = true;

// 固定画布大小：宽 1440，高 1920
// 原始图片为 1920×1080，这里等比缩放到 1440×810，两张图共 1620，高度剩余 300 作为中间留白区
const CANVAS_WIDTH = 1440;
const IMAGE_HEIGHT = 810;
const GAP_HEIGHT = 300;
const CANVAS_HEIGHT = 1920;

canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

// 当前从 Steam 选中的两张截图 URL（最多 2 张）
let selectedSteamImages = [];

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('文件不存在'));
      return;
    }

    if (file.type !== 'image/webp') {
      reject(new Error('图片格式必须为 WebP'));
      return;
    }

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ img, url });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('图片加载失败'));
    };
    img.src = url;
  });
}

// 从远程 URL 加载图片（用于 Steam 截图）
function loadImageFromUrl(url) {
  return new Promise((resolve, reject) => {
    if (!url) {
      reject(new Error('图片地址不存在'));
      return;
    }

    const img = new Image();
    // 如果目标服务器未正确设置 CORS，这里绘制后下载可能会受限
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      resolve({ img, url });
    };
    img.onerror = () => {
      reject(new Error('图片加载失败'));
    };
    img.src = url;
  });
}

// --- Steam 相关逻辑 ---

function buildTagsText(data) {
  const genres = Array.isArray(data.genres) ? data.genres.map(g => g.description) : [];
  const categories = Array.isArray(data.categories) ? data.categories.map(c => c.description) : [];

  const picked = [];

  for (let i = 0; i < genres.length && picked.length < 3; i++) {
    if (!picked.includes(genres[i])) {
      picked.push(genres[i]);
    }
  }

  for (let i = 0; i < categories.length && picked.length < 5; i++) {
    if (!picked.includes(categories[i])) {
      picked.push(categories[i]);
    }
  }

  if (picked.length === 0) {
    return '';
  }

  return picked.join(' / ');
}

function renderSteamScreenshots(screenshots) {
  if (!steamScreenshotsContainer) return;

  steamScreenshotsContainer.innerHTML = '';
  selectedSteamImages = [];

  if (!Array.isArray(screenshots) || screenshots.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'steam-screenshots-empty';
    empty.textContent = '未从 Steam 获取到截图，可尝试手动上传。';
    steamScreenshotsContainer.appendChild(empty);
    return;
  }

  screenshots.forEach((shot, index) => {
    const url = shot.path_full || shot.path_thumbnail;
    if (!url) return;

    const item = document.createElement('div');
    item.className = 'steam-screenshot-item';
    item.dataset.url = url;
    item.title = '点击选择（最多两张）';

    const img = document.createElement('img');
    img.src = url;
    img.alt = `Steam 截图 ${index + 1}`;

    item.appendChild(img);

    item.addEventListener('click', () => {
      const currentUrl = item.dataset.url;
      const selectedIndex = selectedSteamImages.indexOf(currentUrl);

      if (selectedIndex >= 0) {
        // 取消选中
        selectedSteamImages.splice(selectedIndex, 1);
        item.classList.remove('selected');
      } else {
        if (selectedSteamImages.length >= 2) {
          // 简单策略：第三次点击时，先移除最早的一张
          const removedUrl = selectedSteamImages.shift();
          const allItems = steamScreenshotsContainer.querySelectorAll('.steam-screenshot-item');
          allItems.forEach(el => {
            if (el.dataset.url === removedUrl) {
              el.classList.remove('selected');
            }
          });
        }

        selectedSteamImages.push(currentUrl);
        item.classList.add('selected');
      }
    });

    steamScreenshotsContainer.appendChild(item);
  });

  // 默认选中前两张截图
  const urls = screenshots
    .map(shot => shot.path_full || shot.path_thumbnail)
    .filter(Boolean);

  selectedSteamImages = urls.slice(0, 2);

  if (selectedSteamImages.length > 0) {
    const items = steamScreenshotsContainer.querySelectorAll('.steam-screenshot-item');
    items.forEach(item => {
      if (selectedSteamImages.includes(item.dataset.url)) {
        item.classList.add('selected');
      }
    });
  }
}

async function fetchSteamAppDetailsById(appIdRaw) {
  const appId = String(appIdRaw || '').trim();

  if (!appId) {
    alert('请输入 Steam AppID。');
    return;
  }

  if (!/^[0-9]+$/.test(appId)) {
    alert('AppID 需要是纯数字，例如 730。');
    return;
  }

  const url = `http://localhost:3000/steam/appdetails?appids=${encodeURIComponent(appId)}&cc=cn&l=schinese`;

  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      throw new Error(`请求失败：${resp.status}`);
    }

    const json = await resp.json();
    const appDataWrapper = json[appId];

    if (!appDataWrapper || !appDataWrapper.success || !appDataWrapper.data) {
      throw new Error('未找到对应的游戏信息，请检查 AppID 是否正确。');
    }

    const data = appDataWrapper.data;

    // 填充名称
    if (data.name && gameNameInput) {
      gameNameInput.value = data.name;
    }

    // 填充标签
    if (gameTagsInput) {
      const tagsText = buildTagsText(data);
      if (tagsText) {
        gameTagsInput.value = tagsText;
      }
    }

    // 渲染截图并默认选中前两张
    renderSteamScreenshots(data.screenshots || []);

    // 自动生成一次预览
    if ((data.screenshots || []).length > 0) {
      generate();
    }
  } catch (err) {
    alert(err.message || '从 Steam 获取游戏信息失败。');
  }
}

function drawTextArea(title, tags) {
  const areaTop = IMAGE_HEIGHT;
  const areaHeight = GAP_HEIGHT;

  // 背景条
  ctx.fillStyle = '#020617';
  ctx.fillRect(0, areaTop, CANVAS_WIDTH, areaHeight);

  // 居中布局
  const centerX = CANVAS_WIDTH / 2;

  // 游戏名称
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#F9FAFB';
  ctx.font = 'bold 80px "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif';

  const titleY = areaTop + areaHeight / 2 - 40;
  const tagsY = areaTop + areaHeight / 2 + 32;

  const titleText = title && title.trim() ? title.trim() : '游戏名称';
  ctx.fillText(titleText, centerX, titleY);

  // Tag
  const tagsText = tags && tags.trim() ? tags.trim() : '动作 / 冒险 / 示例标签';
  ctx.font = '500 40px "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillStyle = '#9CA3AF';
  ctx.fillText(tagsText, centerX, tagsY);
}

// 右下角水印
function drawWatermark() {
  const padding = 40;
  const textRaw = watermarkInput && watermarkInput.value
    ? watermarkInput.value.trim()
    : '@ZTMYO';
  const text = textRaw || '@ZTMYO';

  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.font = '500 40px "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif';

  // 半透明深色背景条，提高可读性
  const metrics = ctx.measureText(text);
  const textWidth = metrics.width;
  const textHeight = 40; // 近似高度
  const x = CANVAS_WIDTH - padding;
  const y = CANVAS_HEIGHT - padding;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(x - textWidth - 20, y - textHeight - 14, textWidth + 26, textHeight + 22);

  ctx.fillStyle = 'rgba(249, 250, 251, 0.9)';
  ctx.fillText(text, x, y);
}

async function generate() {
  const useSteamImages = selectedSteamImages.length === 2;

  const file1 = image1Input.files[0];
  const file2 = image2Input.files[0];

  if (!useSteamImages && (!file1 || !file2)) {
    alert('请先选择两张图片（上方和下方），或从 Steam 截图中选择两张。');
    return;
  }

  try {
    let img1Data;
    let img2Data;

    if (useSteamImages) {
      [img1Data, img2Data] = await Promise.all([
        loadImageFromUrl(selectedSteamImages[0]),
        loadImageFromUrl(selectedSteamImages[1])
      ]);
    } else {
      [img1Data, img2Data] = await Promise.all([
        loadImageFromFile(file1),
        loadImageFromFile(file2)
      ]);
    }

    // 清空画布
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // 背景填充
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // 画第一张图片（上）
    ctx.drawImage(img1Data.img, 0, 0, CANVAS_WIDTH, IMAGE_HEIGHT);

    // 画第二张图片（下）
    ctx.drawImage(img2Data.img, 0, IMAGE_HEIGHT + GAP_HEIGHT, CANVAS_WIDTH, IMAGE_HEIGHT);

    // 中间文字区域
    drawTextArea(gameNameInput.value, gameTagsInput.value);

    // 右下角水印（可选）
    if (watermarkEnabled) {
      drawWatermark();
    }

    // 显示画布
    canvas.style.display = 'block';
    if (placeholder) {
      placeholder.style.display = 'none';
    }

    // 启用下载按钮
    downloadBtn.disabled = false;

    // 释放 URL（仅对本地文件模式有效）
    if (!useSteamImages) {
      URL.revokeObjectURL(img1Data.url);
      URL.revokeObjectURL(img2Data.url);
    }
  } catch (err) {
    alert(err.message || '生成失败，请检查图片。');
  }
}

function downloadImage() {
  // 生成有序文件名：result_001.png, result_002.png ...
  const indexStr = String(downloadIndex).padStart(3, '0');
  const filename = `result_${indexStr}.png`;

  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/png');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  downloadIndex += 1;
}

generateBtn.addEventListener('click', () => {
  generate();
});

downloadBtn.addEventListener('click', () => {
  if (downloadBtn.disabled) return;
  downloadImage();
});

// 绑定 Steam AppID 获取按钮
if (steamSearchBtn && steamSearchInput) {
  steamSearchBtn.addEventListener('click', () => {
    fetchSteamAppDetailsById(steamSearchInput.value);
  });
}

// 图片来源切换：Steam 截图 / 本地图片
function setSourceMode(mode) {
  if (!steamSourceGroup || !localSourceGroup || !sourceSteamBtn || !sourceLocalBtn) return;

  if (mode === 'steam') {
    steamSourceGroup.style.display = '';
    localSourceGroup.style.display = 'none';
    sourceSteamBtn.classList.add('active');
    sourceLocalBtn.classList.remove('active');
  } else {
    steamSourceGroup.style.display = 'none';
    localSourceGroup.style.display = '';
    sourceSteamBtn.classList.remove('active');
    sourceLocalBtn.classList.add('active');
  }
}

if (sourceSteamBtn && sourceLocalBtn) {
  sourceSteamBtn.addEventListener('click', () => setSourceMode('steam'));
  sourceLocalBtn.addEventListener('click', () => setSourceMode('local'));
  // 默认使用 Steam 截图
  setSourceMode('steam');
}

// 水印开关切换
function setWatermarkEnabled(enabled) {
  watermarkEnabled = !!enabled;

  if (watermarkOnBtn && watermarkOffBtn) {
    if (watermarkEnabled) {
      watermarkOnBtn.classList.add('active');
      watermarkOffBtn.classList.remove('active');
    } else {
      watermarkOnBtn.classList.remove('active');
      watermarkOffBtn.classList.add('active');
    }
  }

  if (watermarkInput) {
    watermarkInput.style.display = watermarkEnabled ? '' : 'none';
  }

  // 切换水印开关后，尝试重新生成预览
  // generate() 内部会自行检查是否具备生成条件
  if (typeof generate === 'function') {
    generate();
  }
}

if (watermarkOnBtn && watermarkOffBtn) {
  watermarkOnBtn.addEventListener('click', () => setWatermarkEnabled(true));
  watermarkOffBtn.addEventListener('click', () => setWatermarkEnabled(false));
  // 默认开启水印
  setWatermarkEnabled(true);
}
