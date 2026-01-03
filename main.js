const gameNameInput = document.getElementById('gameName');
const gameTagsInput = document.getElementById('gameTags');
const image1Input = document.getElementById('image1');
const image2Input = document.getElementById('image2');
const generateBtn = document.getElementById('generateBtn');
const downloadBtn = document.getElementById('downloadBtn');
const canvas = document.getElementById('previewCanvas');
const placeholder = document.getElementById('placeholder');

const ctx = canvas.getContext('2d');

// 下载计数器，用于生成有序文件名
let downloadIndex = 1;

// 固定画布大小：宽 1440，高 1920
// 原始图片为 1920×1080，这里等比缩放到 1440×810，两张图共 1620，高度剩余 300 作为中间留白区
const CANVAS_WIDTH = 1440;
const IMAGE_HEIGHT = 810;
const GAP_HEIGHT = 300;
const CANVAS_HEIGHT = 1920;

canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

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
  const text = '@ZTMYO';

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
  const file1 = image1Input.files[0];
  const file2 = image2Input.files[0];

  if (!file1 || !file2) {
    alert('请先选择两张图片（上方和下方）。');
    return;
  }

  try {
    const [img1Data, img2Data] = await Promise.all([
      loadImageFromFile(file1),
      loadImageFromFile(file2)
    ]);

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

    // 右下角水印
    drawWatermark();

    // 显示画布
    canvas.style.display = 'block';
    if (placeholder) {
      placeholder.style.display = 'none';
    }

    // 启用下载按钮
    downloadBtn.disabled = false;

    // 释放 URL
    URL.revokeObjectURL(img1Data.url);
    URL.revokeObjectURL(img2Data.url);
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
