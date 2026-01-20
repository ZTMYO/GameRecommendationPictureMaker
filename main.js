const gameNameInput = document.getElementById('gameName');
const gameName2Input = document.getElementById('gameName2');
const gameTagsInput = document.getElementById('gameTags');
const gameNameFontSizeInput = document.getElementById('gameNameFontSize');
const gameName2FontSizeInput = document.getElementById('gameName2FontSize');
const gameTagsFontSizeInput = document.getElementById('gameTagsFontSize');
const image1Input = document.getElementById('image1');
const image2Input = document.getElementById('image2');
const image1Preview = document.getElementById('image1Preview');
const image2Preview = document.getElementById('image2Preview');
const generateBtn = document.getElementById('generateBtn');
const downloadBtn = document.getElementById('downloadBtn');
const addToFolderBtn = document.getElementById('addToFolderBtn');
const folderFloatingBtn = document.getElementById('folderFloatingBtn');
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
const steamSearchMessage = document.getElementById('steamSearchMessage');
const steamScreenshotsContainer = document.getElementById('steamScreenshots');
const steamScreenshotsWrapper = document.querySelector('.steam-screenshots-wrapper');
const steamScreenshotsScrollbar = document.querySelector('.steam-screenshots-scrollbar');
const steamScreenshotsThumb = document.querySelector('.steam-screenshots-thumb');

// 自定义滚动条拖拽状态
let isDraggingSteamThumb = false;
let steamThumbDragStartY = 0;
let steamScrollStartTop = 0;
const sourceSteamBtn = document.getElementById('sourceSteamBtn');
const sourceLocalBtn = document.getElementById('sourceLocalBtn');
const steamSourceGroup = document.getElementById('steamSourceGroup');
const localSourceGroup = document.getElementById('localSourceGroup');

// 下载格式选择模态框相关元素
const downloadFormatModal = document.getElementById('downloadFormatModal');
const downloadConfirmBtn = document.getElementById('downloadConfirmBtn');
const downloadCloseBtn = document.getElementById('downloadCloseBtn');

const imageFolderModal = document.getElementById('imageFolderModal');
const imageFolderList = document.getElementById('imageFolderList');
const imageFolderCloseBtn = document.getElementById('imageFolderCloseBtn');
const imageFolderExportBtn = document.getElementById('imageFolderExportBtn');

const ctx = canvas.getContext('2d');

// 下载计数器，用于生成有序文件名
let downloadIndex = 1;

// 是否已经成功生成过至少一张预览图
let hasGeneratedOnce = false;

// 折扣价格信息
let hasDiscountPrice = false;
let discountOriginalPriceText = '';
let discountCurrentPriceText = '';

// 本地预览使用的临时 URL，便于切换文件时释放
let image1PreviewUrl = '';
let image2PreviewUrl = '';
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

// 当前图片来源模式：'steam' 或 'local'
let currentSourceMode = 'steam';

let imageFolder = [];
let imageFolderIdCounter = 0;

function showToast(message) {
  const container = document.getElementById('toastContainer');
  if (!container || !message) return;

  const toast = document.createElement('div');
  toast.className = 'toast-message';
  toast.textContent = message;

  container.appendChild(toast);

  // 触发过渡
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  // 一段时间后自动移除
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      if (toast.parentNode === container) {
        container.removeChild(toast);
      }
    }, 300);
  }, 2200);
}

// 自定义本地图片选择按钮：触发隐藏的 file input
document.querySelectorAll('.file-select-btn').forEach((btn) => {
  const targetId = btn.getAttribute('data-target');
  if (!targetId) return;
  const input = document.getElementById(targetId);
  if (!input) return;
  btn.addEventListener('click', () => {
    input.click();
  });
});

// 设置 Steam 搜索提示文本
function setSteamSearchMessage(msg) {
  if (!steamSearchMessage) return;
  steamSearchMessage.textContent = msg || '';
}

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

// 自定义 Steam 截图滚动条同步逻辑
function updateSteamScreenshotsScrollbar() {
  if (!steamScreenshotsContainer || !steamScreenshotsScrollbar || !steamScreenshotsThumb) return;

  const scrollHeight = steamScreenshotsContainer.scrollHeight;
  const clientHeight = steamScreenshotsContainer.clientHeight;

  // 如果内容没溢出，不显示自定义滚动条
  if (!scrollHeight || scrollHeight <= clientHeight) {
    steamScreenshotsScrollbar.style.display = 'none';
    return;
  }

  steamScreenshotsScrollbar.style.display = '';

  const maxScrollTop = scrollHeight - clientHeight;
  const scrollTop = steamScreenshotsContainer.scrollTop;
  const trackHeight = steamScreenshotsScrollbar.clientHeight || clientHeight;

  // 滑块高度最小限制，避免太细不好点
  const minThumbHeight = 32;
  let thumbHeight = (clientHeight / scrollHeight) * trackHeight;
  if (thumbHeight < minThumbHeight) thumbHeight = minThumbHeight;

  const maxThumbTop = trackHeight - thumbHeight;
  const ratio = maxScrollTop > 0 ? scrollTop / maxScrollTop : 0;
  const thumbTop = maxThumbTop * ratio;

  steamScreenshotsThumb.style.height = `${thumbHeight}px`;
  steamScreenshotsThumb.style.transform = `translateY(${thumbTop}px)`;
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('文件不存在'));
      return;
    }

    if (!file.type || !file.type.startsWith('image/')) {
      reject(new Error('请选择图片文件（支持常见格式，如 PNG/JPEG/WebP 等）'));
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

// 在指定区域内按等比缩放绘制图片，允许留黑边，不裁剪
function drawImageLetterboxed(img, destX, destY, destWidth, destHeight) {
  const imgRatio = img.width / img.height;
  const destRatio = destWidth / destHeight;

  let drawWidth;
  let drawHeight;
  let offsetX;
  let offsetY;

  if (imgRatio > destRatio) {
    // 图片更宽：以宽度适配，留上下黑边
    drawWidth = destWidth;
    drawHeight = destWidth / imgRatio;
    offsetX = destX;
    offsetY = destY + (destHeight - drawHeight) / 2;
  } else {
    // 图片更高：以高度适配，留左右黑边
    drawHeight = destHeight;
    drawWidth = destHeight * imgRatio;
    offsetX = destX + (destWidth - drawWidth) / 2;
    offsetY = destY;
  }

  ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
}

// 更新本地图片预览
function updateLocalImagePreview(fileInput, imgElement, urlHolderKey) {
  if (!fileInput || !imgElement) return;

  const [file] = fileInput.files;

  // 清空预览
  if (!file) {
    imgElement.style.display = 'none';
    imgElement.src = '';
    if (urlHolderKey === 'image1' && image1PreviewUrl) {
      URL.revokeObjectURL(image1PreviewUrl);
      image1PreviewUrl = '';
    }
    if (urlHolderKey === 'image2' && image2PreviewUrl) {
      URL.revokeObjectURL(image2PreviewUrl);
      image2PreviewUrl = '';
    }
    return;
  }

  if (!file.type || !file.type.startsWith('image/')) {
    showToast('请选择图片文件（支持常见格式，如 PNG/JPEG/WebP 等）');
    fileInput.value = '';
    return;
  }

  const url = URL.createObjectURL(file);

  if (urlHolderKey === 'image1' && image1PreviewUrl) {
    URL.revokeObjectURL(image1PreviewUrl);
  }
  if (urlHolderKey === 'image2' && image2PreviewUrl) {
    URL.revokeObjectURL(image2PreviewUrl);
  }

  if (urlHolderKey === 'image1') {
    image1PreviewUrl = url;
  } else {
    image2PreviewUrl = url;
  }

  imgElement.src = url;
  imgElement.style.display = 'block';
}

if (metaRatingInput) {
  metaRatingInput.addEventListener('input', () => {
    rebuildGameMetaText();
    if (hasGeneratedOnce && typeof generate === 'function') {
      generate();
    }
  });
}

// 标题 / 标签字号调整时即时刷新预览
function setupLiveFontSizeUpdate(inputEl) {
  if (!inputEl) return;
  inputEl.addEventListener('input', () => {
    if (!hasGeneratedOnce || typeof generate !== 'function') return;
    generate();
  });
}

setupLiveFontSizeUpdate(gameNameFontSizeInput);
setupLiveFontSizeUpdate(gameName2FontSizeInput);
setupLiveFontSizeUpdate(gameTagsFontSizeInput);

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

  const updateSteamSelectionOrder = () => {
    if (!steamScreenshotsContainer) return;
    const items = steamScreenshotsContainer.querySelectorAll('.steam-screenshot-item');
    // 先清除所有顺序标记
    items.forEach(item => {
      item.removeAttribute('data-order');
    });

    selectedSteamImages.forEach((url, index) => {
      const order = index + 1;
      items.forEach(item => {
        if (item.dataset.url === url) {
          item.setAttribute('data-order', String(order));
        }
      });
    });
  };

  if (!Array.isArray(screenshots) || screenshots.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'steam-screenshots-empty';
    empty.textContent = '未从 Steam 获取到截图，可尝试手动上传。';
    steamScreenshotsContainer.appendChild(empty);
    updateSteamScreenshotsScrollbar();
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
        item.removeAttribute('data-order');
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

      updateSteamSelectionOrder();
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
    updateSteamSelectionOrder();
  }

  updateSteamScreenshotsScrollbar();
}

// 监听滚动和窗口尺寸变化，更新自定义滚动条
if (steamScreenshotsContainer) {
  steamScreenshotsContainer.addEventListener('scroll', () => {
    updateSteamScreenshotsScrollbar();
  });
}

// 自定义滚动条拖拽逻辑
if (steamScreenshotsContainer && steamScreenshotsScrollbar && steamScreenshotsThumb) {
  const onSteamThumbMouseMove = (e) => {
    if (!isDraggingSteamThumb) return;

    const scrollHeight = steamScreenshotsContainer.scrollHeight;
    const clientHeight = steamScreenshotsContainer.clientHeight;
    const maxScrollTop = scrollHeight - clientHeight;
    if (maxScrollTop <= 0) return;

    const trackHeight = steamScreenshotsScrollbar.clientHeight || clientHeight;
    const thumbHeight = steamScreenshotsThumb.clientHeight;
    const maxThumbTop = trackHeight - thumbHeight;
    if (maxThumbTop <= 0) return;

    const deltaY = e.clientY - steamThumbDragStartY;
    const scrollDelta = (deltaY * maxScrollTop) / maxThumbTop;
    let newScrollTop = steamScrollStartTop + scrollDelta;

    if (newScrollTop < 0) newScrollTop = 0;
    if (newScrollTop > maxScrollTop) newScrollTop = maxScrollTop;

    steamScreenshotsContainer.scrollTop = newScrollTop;
  };

  const onSteamThumbMouseUp = () => {
    if (!isDraggingSteamThumb) return;
    isDraggingSteamThumb = false;
    document.removeEventListener('mousemove', onSteamThumbMouseMove);
    document.removeEventListener('mouseup', onSteamThumbMouseUp);
  };

  steamScreenshotsThumb.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!steamScreenshotsContainer) return;

    isDraggingSteamThumb = true;
    steamThumbDragStartY = e.clientY;
    steamScrollStartTop = steamScreenshotsContainer.scrollTop;

    document.addEventListener('mousemove', onSteamThumbMouseMove);
    document.addEventListener('mouseup', onSteamThumbMouseUp);
  });

  // 点击轨道快速跳转到对应位置
  steamScreenshotsScrollbar.addEventListener('mousedown', (e) => {
    // 如果点在滑块上，交给滑块自身处理
    if (e.target === steamScreenshotsThumb) return;

    const rect = steamScreenshotsScrollbar.getBoundingClientRect();
    const clickY = e.clientY - rect.top;

    const scrollHeight = steamScreenshotsContainer.scrollHeight;
    const clientHeight = steamScreenshotsContainer.clientHeight;
    const maxScrollTop = scrollHeight - clientHeight;
    if (maxScrollTop <= 0) return;

    const trackHeight = steamScreenshotsScrollbar.clientHeight || clientHeight;
    const thumbHeight = steamScreenshotsThumb.clientHeight;
    const maxThumbTop = trackHeight - thumbHeight;
    if (maxThumbTop <= 0) return;

    let thumbTop = clickY - thumbHeight / 2;
    if (thumbTop < 0) thumbTop = 0;
    if (thumbTop > maxThumbTop) thumbTop = maxThumbTop;

    const ratio = thumbTop / maxThumbTop;
    steamScreenshotsContainer.scrollTop = ratio * maxScrollTop;
  });
}

window.addEventListener('resize', () => {
  updateSteamScreenshotsScrollbar();
});

async function fetchSteamAppDetailsById(appIdRaw) {
  const appId = String(appIdRaw || '').trim();

  if (!appId) {
    setSteamSearchMessage('请输入 Steam AppID。');
    return;
  }

  if (!/^[0-9]+$/.test(appId)) {
    setSteamSearchMessage('AppID 需要是纯数字，例如 730。');
    return;
  }

  const url = `http://localhost:3000/steam/appdetails?appids=${encodeURIComponent(appId)}&cc=cn&l=schinese`;

  try {
    // 请求前清空旧提示
    setSteamSearchMessage('');

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
    setSteamSearchMessage(err.message || '从 Steam 获取游戏信息失败。');
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
    titleY = midY - 76;
    subTitleY = midY;
    tagsY = midY + 64;
  } else {
    // 只有标题+标签时：保持原先相对紧凑的两行布局
    titleY = areaTop + areaHeight / 2 - 40;
    subTitleY = midY;
    tagsY = areaTop + areaHeight / 2 + 32;
  }

  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#F9FAFB';

  // 标题/副标题/标签字号可调
  const titleFontSize = gameNameFontSizeInput
    ? Math.min(100, Math.max(40, parseInt(gameNameFontSizeInput.value || '80', 10)))
    : 80;
  const subTitleFontSize = gameName2FontSizeInput
    ? Math.min(72, Math.max(28, parseInt(gameName2FontSizeInput.value || '48', 10)))
    : 48;
  const tagsFontSize = gameTagsFontSizeInput
    ? Math.min(60, Math.max(28, parseInt(gameTagsFontSizeInput.value || '40', 10)))
    : 40;

  const titleFont = `bold ${titleFontSize}px "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif`;
  ctx.font = titleFont;

  if (hasMeta) {
    // 有右侧信息时：左对齐，整体稍微靠左
    const leftPadding = 120;
    ctx.textAlign = 'left';
    ctx.fillText(titleText, leftPadding, titleY);

    // 名称 2（英文名），略小字号
    if (subTitleText) {
      ctx.font = `600 ${subTitleFontSize}px "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.fillStyle = '#E5E7EB';
      ctx.fillText(subTitleText, leftPadding, subTitleY);
    }

    ctx.font = `500 ${tagsFontSize}px "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif`;
    ctx.fillStyle = '#9CA3AF';
    ctx.fillText(tagsText, leftPadding, tagsY);
  } else {
    // 没有右侧信息时：标题和标签居中
    const centerX = CANVAS_WIDTH / 2;
    ctx.textAlign = 'center';
    ctx.fillText(titleText, centerX, titleY);

    // 名称 2（英文名），略小字号
    if (subTitleText) {
      ctx.font = `600 ${subTitleFontSize}px "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.fillStyle = '#E5E7EB';
      ctx.fillText(subTitleText, centerX, subTitleY);
    }

    ctx.font = `500 ${tagsFontSize}px "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif`;
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
        // 有副标题（三行）时整体字号略微放大
        const currentFontSize = hasSubTitle ? 60 : 56;
        const originalFontSize = hasSubTitle ? 48 : 44;

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
        const singlePriceFont = hasSubTitle
          ? 'bold 60px "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif'
          : 'bold 56px "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.font = singlePriceFont;
        ctx.fillStyle = '#F9FAFB';
        ctx.fillText(priceText, baseX, priceY);
      }
    }

    // 评分：略小一号，放在价格下方
    if (ratingText) {
      const hasSubTitleForRating = !!(subTitle && subTitle.trim());
      // 有副标题（三行）时，评分字体稍微更大一点以平衡整体
      ctx.font = hasSubTitleForRating
        ? '600 48px "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif'
        : '600 44px "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
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
  const useSteamImages = currentSourceMode === 'steam' && selectedSteamImages.length === 2;

  const file1 = image1Input.files[0];
  const file2 = image2Input.files[0];

  if (!useSteamImages && (!file1 || !file2)) {
    showToast('请先选择两张图片（上方和下方），或从 Steam 截图中选择两张。');
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
    drawImageLetterboxed(img1Data.img, 0, 0, CANVAS_WIDTH, IMAGE_HEIGHT);

    // 画第二张图片（下）
    drawImageLetterboxed(img2Data.img, 0, IMAGE_HEIGHT + GAP_HEIGHT, CANVAS_WIDTH, IMAGE_HEIGHT);

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
    if (addToFolderBtn) {
      addToFolderBtn.disabled = false;
    }
  } catch (err) {
    showToast(err.message || '生成失败，请检查图片。');
  }
}

function downloadImage(format) {
  let fmt;
  if (format === 'jpg' || format === 'jpeg') {
    fmt = 'jpg';
  } else if (format === 'webp') {
    fmt = 'webp';
  } else {
    fmt = 'png';
  }

  // 统一文件名：result.{ext}
  const filename = `result.${fmt}`;

  const link = document.createElement('a');
  link.download = filename;
  if (fmt === 'jpg') {
    // 适中质量的 JPG，减小体积
    link.href = canvas.toDataURL('image/jpeg', 0.9);
  } else if (fmt === 'webp') {
    // WEBP 格式（受浏览器支持情况影响）
    link.href = canvas.toDataURL('image/webp');
  } else {
    link.href = canvas.toDataURL('image/png');
  }
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function animateCanvasToFolder() {
  if (!canvas || !folderFloatingBtn) return;

  const canvasRect = canvas.getBoundingClientRect();
  const folderRect = folderFloatingBtn.getBoundingClientRect();

  // 如果画布当前不可见，就不做动画
  if (canvasRect.width === 0 || canvasRect.height === 0) return;

  const startX = canvasRect.left + canvasRect.width / 2;
  const startY = canvasRect.top + canvasRect.height / 2;

  const endX = folderRect.left + folderRect.width / 2;
  const endY = folderRect.top + folderRect.height / 2;

  const controlX = (startX + endX) / 2;
  const controlY = Math.min(startY, endY) - 150;

  const img = document.createElement('img');
  img.src = canvas.toDataURL('image/png');
  img.style.position = 'fixed';
  img.style.left = `${startX}px`;
  img.style.top = `${startY}px`;
  img.style.transform = 'translate(-50%, -50%) scale(1)';
  img.style.borderRadius = '12px';
  img.style.boxShadow = '0 10px 30px rgba(15, 23, 42, 0.45)';
  img.style.pointerEvents = 'none';
  img.style.zIndex = '70';
  img.style.width = `${canvasRect.width}px`;
  img.style.height = `${canvasRect.height}px`;

  document.body.appendChild(img);

  const duration = 600;
  const startTime = performance.now();

  function bezier(p0, p1, p2, t) {
    const oneMinusT = 1 - t;
    return oneMinusT * oneMinusT * p0 + 2 * oneMinusT * t * p1 + t * t * p2;
  }

  function step(now) {
    const elapsed = now - startTime;
    const t = Math.min(1, elapsed / duration);

    const x = bezier(startX, controlX, endX, t);
    const y = bezier(startY, controlY, endY, t);
    const scale = 1 - 0.7 * t; // 从 1 缩小到 0.3

    img.style.left = `${x}px`;
    img.style.top = `${y}px`;
    img.style.transform = `translate(-50%, -50%) scale(${scale})`;

    if (t < 1) {
      requestAnimationFrame(step);
    } else {
      document.body.removeChild(img);
    }
  }

  requestAnimationFrame(step);
}

function addCurrentCanvasToFolder() {
  if (!canvas) return;
  if (!hasGeneratedOnce) {
    showToast('请先生成一张推荐图，再加入文件夹。');
    return;
  }

  const dataUrl = canvas.toDataURL('image/png');
  const item = {
    id: ++imageFolderIdCounter,
    dataUrl
  };
  imageFolder.push(item);
  showToast('已将当前图片加入文件夹。');

  // 动画：当前预览图飞向右下角文件夹图标
  animateCanvasToFolder();

  // 清空并隐藏预览区域，显示占位提示
  try {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  } catch (_) {}
  canvas.style.display = 'none';
  if (placeholder) {
    placeholder.style.display = 'block';
  }
}

function renderImageFolderList() {
  if (!imageFolderList) return;

  imageFolderList.innerHTML = '';

  if (!imageFolder.length) {
    const empty = document.createElement('div');
    empty.className = 'image-folder-empty';
    empty.textContent = '文件夹为空，请先将生成的图片加入文件夹。';
    imageFolderList.appendChild(empty);
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'image-folder-grid';

  imageFolder.forEach((item, index) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'image-folder-item';

    const thumb = document.createElement('div');
    thumb.className = 'image-folder-thumb';

    const img = document.createElement('img');
    img.src = item.dataUrl;
    img.alt = `result_${index + 1}.png`;
    img.className = 'image-folder-img';

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'image-folder-remove';
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      imageFolder = imageFolder.filter((x) => x.id !== item.id);
      renderImageFolderList();
    });

    thumb.appendChild(img);
    thumb.appendChild(removeBtn);

    const name = document.createElement('div');
    name.className = 'image-folder-name';
    name.textContent = `result_${index + 1}.png`;

    wrapper.appendChild(thumb);
    wrapper.appendChild(name);

    grid.appendChild(wrapper);
  });

  imageFolderList.appendChild(grid);
}

function showImageFolderModal() {
  if (!imageFolderModal) return;
  renderImageFolderList();
  imageFolderModal.style.display = 'flex';
}

function hideImageFolderModal() {
  if (!imageFolderModal) return;
  imageFolderModal.style.display = 'none';
}

async function exportFolderAsZip() {
  if (!imageFolder.length) {
    showToast('文件夹为空，请先加入至少一张图片。');
    return;
  }

  try {
    const resp = await fetch('http://localhost:3000/export-zip', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        images: imageFolder.map((item) => item.dataUrl)
      })
    });

    if (!resp.ok) {
      throw new Error(`导出失败：${resp.status}`);
    }

    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'results.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    showToast((err && err.message) || '导出 ZIP 失败，请检查后端服务是否已启动。');
  }
}

generateBtn.addEventListener('click', () => {
  generate();
});

// 显示 / 隐藏下载格式选择模态框
function showDownloadFormatModal() {
  if (!downloadFormatModal) return;
  downloadFormatModal.style.display = 'flex';
}

function hideDownloadFormatModal() {
  if (!downloadFormatModal) return;
  downloadFormatModal.style.display = 'none';
}

// 点击下载按钮时，只弹出格式选择模态框
downloadBtn.addEventListener('click', () => {
  if (downloadBtn.disabled) return;
  showDownloadFormatModal();
});

// 模态框：右上角关闭按钮
if (downloadCloseBtn) {
  downloadCloseBtn.addEventListener('click', () => {
    hideDownloadFormatModal();
  });
}

// 模态框：确认下载按钮
if (downloadConfirmBtn) {
  downloadConfirmBtn.addEventListener('click', () => {
    if (!downloadFormatModal) return;

    const radios = downloadFormatModal.querySelectorAll('input[name="downloadFormat"]');
    let selected = 'png';
    radios.forEach((el) => {
      if (el.checked) {
        selected = el.value;
      }
    });

    hideDownloadFormatModal();
    downloadImage(selected);
  });
}

// 绑定 Steam AppID 获取按钮
if (steamSearchBtn && steamSearchInput) {
  steamSearchBtn.addEventListener('click', async () => {
    const appIdValue = steamSearchInput.value;
    // 进入加载状态
    steamSearchBtn.disabled = true;
    steamSearchBtn.classList.add('loading');

    try {
      await fetchSteamAppDetailsById(appIdValue);
    } finally {
      steamSearchBtn.disabled = false;
      steamSearchBtn.classList.remove('loading');
    }
  });
}

// 图片来源切换：Steam 截图 / 本地图片
function setSourceMode(mode) {
  if (!steamSourceGroup || !localSourceGroup || !sourceSteamBtn || !sourceLocalBtn) return;

  if (mode === 'steam') {
    currentSourceMode = 'steam';
    steamSourceGroup.style.display = '';
    localSourceGroup.style.display = 'none';
    sourceSteamBtn.classList.add('active');
    sourceLocalBtn.classList.remove('active');
    // 切回 Steam 时，根据当前内容刷新一次滚动条
    updateSteamScreenshotsScrollbar();
  } else {
    currentSourceMode = 'local';
    steamSourceGroup.style.display = 'none';
    localSourceGroup.style.display = '';
    sourceSteamBtn.classList.remove('active');
    sourceLocalBtn.classList.add('active');
    // 使用本地图片时不需要 Steam 截图滚动条
    if (steamScreenshotsScrollbar) {
      steamScreenshotsScrollbar.style.display = 'none';
    }

    selectedSteamImages = [];
    if (steamScreenshotsContainer) {
      const items = steamScreenshotsContainer.querySelectorAll('.steam-screenshot-item.selected');
      items.forEach(el => el.classList.remove('selected'));
    }
  }
}

if (sourceSteamBtn && sourceLocalBtn) {
  sourceSteamBtn.addEventListener('click', () => setSourceMode('steam'));
  sourceLocalBtn.addEventListener('click', () => setSourceMode('local'));
  // 默认使用 Steam 截图
  setSourceMode('steam');
}

// 本地图片上传时显示预览
if (image1Input && image1Preview) {
  image1Input.addEventListener('change', () => {
    updateLocalImagePreview(image1Input, image1Preview, 'image1');
  });
}

if (image2Input && image2Preview) {
  image2Input.addEventListener('change', () => {
    updateLocalImagePreview(image2Input, image2Preview, 'image2');
  });
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

if (addToFolderBtn) {
  addToFolderBtn.addEventListener('click', () => {
    if (addToFolderBtn.disabled) return;
    addCurrentCanvasToFolder();
  });
}

if (folderFloatingBtn) {
  folderFloatingBtn.addEventListener('click', () => {
    showImageFolderModal();
  });
}

if (imageFolderCloseBtn) {
  imageFolderCloseBtn.addEventListener('click', () => {
    hideImageFolderModal();
  });
}

if (imageFolderExportBtn) {
  imageFolderExportBtn.addEventListener('click', () => {
    exportFolderAsZip();
  });
}
