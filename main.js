const gameNameInput = document.getElementById('gameName');
const gameName2Input = document.getElementById('gameName2');
const gameTagsInput = document.getElementById('gameTags');
const image1Input = document.getElementById('image1');
const image2Input = document.getElementById('image2');
const generateBtn = document.getElementById('generateBtn');
const downloadBtn = document.getElementById('downloadBtn');
const canvas = document.getElementById('previewCanvas');
const placeholder = document.getElementById('placeholder');
const watermarkInput = document.getElementById('watermarkText');
// 中部价格 / 评分文本输入
const metaPriceOriginalInput = document.getElementById('metaPriceOriginal');
const metaPriceCurrentInput = document.getElementById('metaPriceCurrent');
const metaRatingInput = document.getElementById('metaRating');

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

// 是否已经成功生成过至少一张预览图
let hasGeneratedOnce = false;

// 折扣价格信息
let hasDiscountPrice = false;
let discountOriginalPriceText = '';
let discountCurrentPriceText = '';

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

// 当前游戏的价格+评分信息文本（显示在中间黑色带右侧）
let gameMetaText = '';

function rebuildGameMetaText() {
  const parts = [];
  const original = metaPriceOriginalInput && metaPriceOriginalInput.value
    ? metaPriceOriginalInput.value.trim()
    : '';
  const price = metaPriceCurrentInput && metaPriceCurrentInput.value
    ? metaPriceCurrentInput.value.trim()
    : '';
  const rating = metaRatingInput && metaRatingInput.value
    ? metaRatingInput.value.trim()
    : '';

  // 根据原价和现价判断是否为折扣价（仅当两者都是金额且原价>现价时）
  hasDiscountPrice = false;
  discountOriginalPriceText = '';
  discountCurrentPriceText = '';

  if (original && price) {
    const extractNumber = (text) => {
      const match = text.replace(',', '').match(/([0-9]+(?:\.[0-9]+)?)/);
      return match ? parseFloat(match[1]) : NaN;
    };

    const originalVal = extractNumber(original);
    const currentVal = extractNumber(price);

    if (!Number.isNaN(originalVal) && !Number.isNaN(currentVal) && originalVal > currentVal) {
      hasDiscountPrice = true;
      discountOriginalPriceText = original;
      discountCurrentPriceText = price;
    }
  }

  if (price) {
    parts.push(price);
  }
  if (rating) {
    parts.push(rating);
  }

  gameMetaText = parts.join(' · ');
}

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

if (metaRatingInput) {
  metaRatingInput.addEventListener('input', () => {
    rebuildGameMetaText();
    if (hasGeneratedOnce && typeof generate === 'function') {
      generate();
    }
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

    // 重置折扣信息
    hasDiscountPrice = false;
    discountOriginalPriceText = '';
    discountCurrentPriceText = '';

    // 计算价格/免费信息，填入价格输入框（原价+现价）
    let originalPriceText = '';
    let priceText = '';
    if (data.is_free) {
      priceText = '免费游玩';
    } else if (data.price_overview && typeof data.price_overview.final === 'number') {
      const finalCents = data.price_overview.final;
      const finalYuan = (finalCents / 100).toFixed(2);
      priceText = `¥${finalYuan}`;

      // 如果有折扣，则记录原价
      if (
        typeof data.price_overview.discount_percent === 'number' &&
        data.price_overview.discount_percent > 0 &&
        typeof data.price_overview.initial === 'number'
      ) {
        const initialCents = data.price_overview.initial;
        const initialYuan = (initialCents / 100).toFixed(2);
        originalPriceText = `¥${initialYuan}`;
      }
    }

    if (metaPriceOriginalInput) {
      metaPriceOriginalInput.value = originalPriceText;
    }
    if (metaPriceCurrentInput) {
      metaPriceCurrentInput.value = priceText;
    }

    // 计算评分信息（Metacritic），填入评分输入框
    let ratingText = '';
    if (data.metacritic && typeof data.metacritic.score === 'number') {
      ratingText = `评分 ${data.metacritic.score}`;
    }

    if (metaRatingInput) {
      metaRatingInput.value = ratingText;
    }

    rebuildGameMetaText();

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

function drawTextArea(title, subTitle, tags) {
  const areaTop = IMAGE_HEIGHT;
  const areaHeight = GAP_HEIGHT;

  // 背景条
  ctx.fillStyle = '#020617';
  ctx.fillRect(0, areaTop, CANVAS_WIDTH, areaHeight);

  const hasMeta = !!(gameMetaText && gameMetaText.trim());

  // 游戏名称1 / 名称2（英文） / 标签
  const titleText = title && title.trim() ? title.trim() : '游戏名称';
  const subTitleText = subTitle && subTitle.trim() ? subTitle.trim() : '';
  const tagsText = tags && tags.trim() ? tags.trim() : '动作 / 冒险 / 示例标签';

  const midY = areaTop + areaHeight / 2;
  let titleY;
  let subTitleY;
  let tagsY;

  if (subTitleText) {
    // 有名称2时：三行拉开间距
    titleY = midY - 58;     // 标题稍微靠上
    subTitleY = midY;       // 英文名居中
    tagsY = midY + 54;      // 标签再往下拉一些
  } else {
    // 只有标题+标签时：保持原先相对紧凑的两行布局
    titleY = areaTop + areaHeight / 2 - 40;
    subTitleY = midY; // 不会被使用
    tagsY = areaTop + areaHeight / 2 + 32;
  }

  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#F9FAFB';
  ctx.font = 'bold 80px "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif';

  if (hasMeta) {
    // 有右侧信息时：左对齐，整体稍微靠左
    const leftPadding = 120;
    ctx.textAlign = 'left';
    ctx.fillText(titleText, leftPadding, titleY);

    // 名称 2（英文名），略小字号
    if (subTitleText) {
      ctx.font = '600 48px "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillStyle = '#E5E7EB';
      ctx.fillText(subTitleText, leftPadding, subTitleY);
    }

    ctx.font = '500 40px "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = '#9CA3AF';
    ctx.fillText(tagsText, leftPadding, tagsY);
  } else {
    // 没有右侧信息时：标题和标签居中
    const centerX = CANVAS_WIDTH / 2;
    ctx.textAlign = 'center';
    ctx.fillText(titleText, centerX, titleY);

    // 名称 2（英文名），略小字号
    if (subTitleText) {
      ctx.font = '600 48px "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillStyle = '#E5E7EB';
      ctx.fillText(subTitleText, centerX, subTitleY);
    }

    ctx.font = '500 40px "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = '#9CA3AF';
    ctx.fillText(tagsText, centerX, tagsY);
  }

  // 右侧区域：价格 + 评分（右对齐，上下两行）
  if (hasMeta) {
    const rightPadding = 120;
    const baseX = CANVAS_WIDTH - rightPadding;
    const centerY = areaTop + areaHeight / 2;

    // 将组合文本拆成两部分：价格在上，评分在下
    const parts = gameMetaText.trim().split(' · ').filter(Boolean);
    const priceText = parts[0] || '';
    const ratingText = parts[1] || '';

    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    // 价格：有折扣时同一行显示「现价 + 原价(删除线)」，否则只显示一行现价
    if (priceText) {
      const hasSubTitle = !!(subTitle && subTitle.trim());
      let priceY;

      if (hasSubTitle) {
        // 有副标题时：让现价的基线与左侧主标题大致对齐
        priceY = titleY;
      } else {
        // 无副标题：保持原有相对位置
        priceY = ratingText ? centerY - 20 : centerY;
      }

      if (hasDiscountPrice && discountOriginalPriceText && discountCurrentPriceText) {
        // 使用不同字号：现价稍大、原价略小
        const currentFontSize = 56;
        const originalFontSize = 44;

        // 先测量两段文字宽度
        ctx.font = `bold ${currentFontSize}px "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif`;
        const currentMetrics = ctx.measureText(priceText);

        ctx.font = `500 ${originalFontSize}px "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif`;
        const originalMetrics = ctx.measureText(discountOriginalPriceText);

        const gap = 24; // 现价和原价之间的间距
        const totalWidth = currentMetrics.width + gap + originalMetrics.width;

        // 让整个价格块右对齐到 baseX
        const blockLeftX = baseX - totalWidth;
        const currentX = blockLeftX + currentMetrics.width; // 右对齐现价
        const originalX = baseX; // 原价右对齐到最右侧

        // 现价：加粗
        ctx.textAlign = 'right';
        ctx.font = `bold ${currentFontSize}px "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.fillStyle = '#ffffffff';
        ctx.fillText(priceText, currentX, priceY);

        // 原价：灰色、不加粗，带删除线
        ctx.font = `500 ${originalFontSize}px "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.fillStyle = '#9CA3AF';
        ctx.fillText(discountOriginalPriceText, originalX, priceY);

        const lineMetrics = ctx.measureText(discountOriginalPriceText);
        const lineY = priceY - originalFontSize * 0.14; // 略微靠上，模拟删除线
        ctx.strokeStyle = '#6B7280';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(originalX - lineMetrics.width, lineY);
        ctx.lineTo(originalX, lineY);
        ctx.stroke();
      } else {
        // 无折扣：单行展示价格
        ctx.font = 'bold 56px "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.fillStyle = '#F9FAFB';
        ctx.fillText(priceText, baseX, priceY);
      }
    }

    // 评分：略小一号，放在价格下方
    if (ratingText) {
      ctx.font = '600 44px "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillStyle = '#E5E7EB';
      const hasSubTitle = !!(subTitle && subTitle.trim());
      let ratingY;

      if (hasSubTitle && priceText) {
        // 有副标题且有价格时：让评分落在副标题与标签之间的大致中部
        ratingY = (subTitleY + tagsY) / 2;
      } else if (priceText) {
        // 无副标题，仅根据价格做轻微下移
        ratingY = centerY + 34;
      } else {
        // 只有评分时垂直居中
        ratingY = centerY;
      }
      ctx.fillText(ratingText, baseX, ratingY);
    }
  }
}

// 右下角水印
function drawWatermark() {
  const padding = 40;
  const text = watermarkInput && watermarkInput.value
    ? watermarkInput.value.trim()
    : '';

  // 输入为空时不绘制水印
  if (!text) return;

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
    drawTextArea(gameNameInput.value, gameName2Input ? gameName2Input.value : '', gameTagsInput.value);

    // 右下角水印：仅当水印文本非空时绘制
    drawWatermark();

    // 显示画布
    canvas.style.display = 'block';
    if (placeholder) {
      placeholder.style.display = 'none';
    }

    // 标记已经成功生成过
    hasGeneratedOnce = true;

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

// 水印文本联动：修改后自动刷新预览（在已有预览的前提下）
if (watermarkInput) {
  watermarkInput.addEventListener('input', () => {
    if (hasGeneratedOnce && typeof generate === 'function') {
      generate();
    }
  });
}

// 中部价格 / 评分文本输入联动
if (metaPriceOriginalInput) {
  metaPriceOriginalInput.addEventListener('input', () => {
    rebuildGameMetaText();
    if (hasGeneratedOnce && typeof generate === 'function') {
      generate();
    }
  });
}

if (metaPriceCurrentInput) {
  metaPriceCurrentInput.addEventListener('input', () => {
    rebuildGameMetaText();
    if (hasGeneratedOnce && typeof generate === 'function') {
      generate();
    }
  });
}
