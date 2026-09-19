/**
 * 将Canvas导出为图片并下载
 * 兼容处理移动端大图导出问题
 *
 * 手机/APK WebView 环境说明:
 * - Android WebView 没有 Web Share API,blob 下载也会被静默丢弃;
 * - 因此移动端在触发下载后,额外弹出图片预览兜底层:
 *   长按图片可"保存图片"(依赖封装的下载能力),不行则直接截图保存。
 * @param {HTMLCanvasElement} canvas - canvas元素
 * @param {string} filename - 文件名
 */
export const downloadCanvasAsImage = (canvas, filename) => {
  try {
    // 优先尝试使用 toBlob，因为它处理大文件更有效率且不容易崩溃
    if (canvas.toBlob) {
      canvas.toBlob((blob) => {
        if (!blob) {
          console.error('Canvas转换Blob失败');
          fallbackToDataURL(canvas, filename);
          return;
        }

        // 尝试使用 navigator.share (真实移动浏览器;Android WebView 中不存在,会走下载分支)
        try {
          if (navigator.share && navigator.canShare && navigator.canShare({ files: [new File([blob], filename, { type: blob.type })] })) {
            const file = new File([blob], filename, { type: blob.type });
            navigator.share({
                files: [file],
                title: '分享图片',
                text: filename
            }).catch((err) => {
                if (err && err.name === 'AbortError') return;
                console.log('分享失败，尝试下载:', err);
                downloadBlob(blob, filename, canvas);
            });
            return;
          }
        } catch (e) {
          console.log('分享调起异常，尝试下载:', e);
        }

        downloadBlob(blob, filename, canvas);
      }, 'image/png');
    } else {
      fallbackToDataURL(canvas, filename);
    }
  } catch (e) {
    console.error('导出图片出错:', e);
    fallbackToDataURL(canvas, filename);
  }
};

const downloadBlob = (blob, filename, canvas) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;

  // 兼容某些移动端浏览器，添加到body
  document.body.appendChild(link);

  try {
      link.click();
  } catch (e) {
      console.error("Link click failed", e);
  }

  // 清理
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 100);

  // 移动端(尤其 App 内置 WebView)可能静默丢弃下载,弹出预览兜底
  if (/Android|iPhone|iPad|Mobi/i.test(navigator.userAgent) && canvas) {
    try {
      showImageFallback(canvas.toDataURL('image/png'), filename);
    } catch (e) {
      console.error('生成图片预览失败:', e);
    }
  }
};

const fallbackToDataURL = (canvas, filename) => {
  try {
    const imgUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = imgUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if (/Android|iPhone|iPad|Mobi/i.test(navigator.userAgent)) {
      showImageFallback(imgUrl, filename);
    }
  } catch (e) {
    console.error('DataURL导出失败:', e);
    alert('导出图片失败，图片可能过大');
  }
};

/**
 * 图片导出兜底弹层:预览图片 + 长按保存提示,保证手机上至少可以通过截图留存。
 */
const showImageFallback = (dataUrl, filename) => {
  const existing = document.getElementById('image-export-fallback');
  if (existing) existing.remove();

  const wrap = document.createElement('div');
  wrap.id = 'image-export-fallback';
  wrap.style.cssText =
    'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:16px;';

  const card = document.createElement('div');
  card.style.cssText =
    'background:#fff;border-radius:12px;padding:14px;max-width:92vw;width:420px;max-height:86vh;overflow:auto;font-family:system-ui,sans-serif;font-size:14px;color:#333;box-sizing:border-box;';

  const title = document.createElement('div');
  title.textContent = '图片已生成';
  title.style.cssText = 'font-weight:600;font-size:16px;margin-bottom:6px;';

  const desc = document.createElement('div');
  desc.style.cssText = 'line-height:1.6;margin-bottom:10px;color:#555;';
  desc.textContent =
    '当前环境可能无法直接保存文件。可长按下方图片选择"保存图片";若没有该选项,请对本页截图保存。';

  const img = document.createElement('img');
  img.src = dataUrl;
  img.alt = filename;
  img.style.cssText =
    'width:100%;height:auto;border:1px solid #eee;border-radius:8px;display:block;';

  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:8px;margin-top:12px;';

  const mkBtn = (text, bg, color) => {
    const b = document.createElement('button');
    b.textContent = text;
    b.style.cssText = `flex:1;padding:10px 0;border:none;border-radius:8px;font-size:14px;background:${bg};color:${color};`;
    return b;
  };

  const dlBtn = mkBtn('尝试下载', '#18a058', '#fff');
  dlBtn.onclick = () => {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const closeBtn = mkBtn('关闭', '#eeeeee', '#555555');
  closeBtn.onclick = () => wrap.remove();

  row.append(dlBtn, closeBtn);
  card.append(title, desc, img, row);
  wrap.appendChild(card);
  wrap.onclick = (e) => {
    if (e.target === wrap) wrap.remove();
  };
  document.body.appendChild(wrap);
};
