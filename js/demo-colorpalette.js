/**
 * demo-colorpalette.js
 * ─────────────────────────────────────────────
 * Demo 4: Color Palette Generator
 *
 * Extracts a dominant color palette from any
 * uploaded or dropped image using k-means
 * clustering on pixel data (runs entirely in
 * the browser — no server needed).
 *
 * Features:
 *   - Drag-and-drop or file-input upload
 *   - k-means++ centroid initialisation (k=12)
 *   - Perceptual deduplication (min Euclidean dist)
 *   - HSL breakdown per swatch
 *   - Brightness / saturation / temperature stats
 *   - Harmony detection (complementary, analogous…)
 *   - Copy HEX or CSS custom properties to clipboard
 * ─────────────────────────────────────────────
 */
(function () {

/* ── Colour space helpers ── */
function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
}
function hexToRgb(hex) {
    return [
        parseInt(hex.slice(1, 3), 16),
        parseInt(hex.slice(3, 5), 16),
        parseInt(hex.slice(5, 7), 16)
    ];
}
function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) { h = s = 0; }
    else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}
function colorDist(a, b) {
    return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}
function luminance(r, g, b) {
    return 0.2126 * (r / 255) + 0.7152 * (g / 255) + 0.0722 * (b / 255);
}

/**
 * kMeans(pixels, k, iters)
 * k-means++ clustering.
 * Returns clusters sorted by size (dominant first).
 */
function kMeans(pixels, k, iters = 20) {
    // k-means++ seeding: pick spread-out initial centroids
    const centers = [];
    centers.push(pixels[Math.floor(Math.random() * pixels.length)].slice());
    for (let i = 1; i < k; i++) {
        const dists = pixels.map(p => Math.min(...centers.map(c => colorDist(p, c))));
        const sum   = dists.reduce((a, b) => a + b, 0);
        let r = Math.random() * sum, cumul = 0;
        for (let j = 0; j < pixels.length; j++) {
            cumul += dists[j];
            if (cumul >= r) { centers.push(pixels[j].slice()); break; }
        }
    }

    const assignments = new Int32Array(pixels.length);
    for (let iter = 0; iter < iters; iter++) {
        // Assign each pixel to nearest centroid
        for (let i = 0; i < pixels.length; i++) {
            let best = 0, bestD = Infinity;
            for (let c = 0; c < k; c++) {
                const d = colorDist(pixels[i], centers[c]);
                if (d < bestD) { bestD = d; best = c; }
            }
            assignments[i] = best;
        }
        // Recompute centroids as mean of assigned pixels
        const sums   = Array.from({ length: k }, () => [0, 0, 0]);
        const counts = new Int32Array(k);
        for (let i = 0; i < pixels.length; i++) {
            const c = assignments[i];
            sums[c][0] += pixels[i][0];
            sums[c][1] += pixels[i][1];
            sums[c][2] += pixels[i][2];
            counts[c]++;
        }
        for (let c = 0; c < k; c++) {
            if (counts[c] > 0) {
                centers[c] = [sums[c][0] / counts[c], sums[c][1] / counts[c], sums[c][2] / counts[c]];
            }
        }
    }

    const counts2 = new Int32Array(k);
    for (let i = 0; i < pixels.length; i++) counts2[assignments[i]]++;
    return centers.map((c, i) => ({
        rgb: c.map(Math.round),
        count: counts2[i]
    })).sort((a, b) => b.count - a.count);
}

/**
 * samplePixels(imageData, maxPixels)
 * Downsamples image pixels for speed. Skips
 * transparent, near-white, and near-black extremes.
 */
function samplePixels(imageData, maxPixels = 6000) {
    const data  = imageData.data;
    const total = data.length / 4;
    const step  = Math.max(1, Math.floor(total / maxPixels));
    const pixels = [];
    for (let i = 0; i < total; i += step) {
        const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2], a = data[i * 4 + 3];
        if (a < 128) continue;
        const l = luminance(r, g, b);
        if (l > 0.98 || l < 0.005) continue; // skip extreme white/black
        pixels.push([r, g, b]);
    }
    return pixels;
}

/**
 * deduplicateClusters(clusters, minDist)
 * Removes clusters that are perceptually too similar
 * to an already-kept cluster (Euclidean in RGB).
 */
function deduplicateClusters(clusters, minDist = 28) {
    const kept = [];
    for (const c of clusters) {
        if (!kept.some(k => colorDist(k.rgb, c.rgb) < minDist)) kept.push(c);
    }
    return kept;
}

/**
 * detectHarmony(hexColors)
 * Returns an array of harmony tags (up to 4) based on
 * the hue distribution of the extracted palette.
 */
function detectHarmony(hexColors) {
    const hues = hexColors.map(h => { const [r, g, b] = hexToRgb(h); return rgbToHsl(r, g, b)[0]; });
    const tags  = [];

    const hueRange = Math.max(...hues) - Math.min(...hues);
    if (hueRange < 35) tags.push('Monochromatic');

    for (let i = 0; i < hues.length; i++) {
        for (let j = i + 1; j < hues.length; j++) {
            const diff = Math.abs(hues[i] - hues[j]);
            if (diff > 150 && diff < 210) { tags.push('Complementary'); break; }
        }
    }

    const sorted = [...hues].sort((a, b) => a - b);
    if (sorted.every((_, i) => i === 0 || sorted[i] - sorted[i - 1] < 50)) tags.push('Analogous');

    const warmCount = hues.filter(h => h < 60 || h > 300).length;
    if (warmCount > hues.length * 0.6)      tags.push('Warm');
    else if (warmCount < hues.length * 0.3) tags.push('Cool');
    else                                     tags.push('Neutral');

    const lums = hexColors.map(h => { const [r, g, b] = hexToRgb(h); return luminance(r, g, b); });
    if (Math.max(...lums) - Math.min(...lums) > 0.6) tags.push('High Contrast');

    return [...new Set(tags)].slice(0, 4);
}

/* ── Clipboard — works in both HTTP and HTTPS ── */
function cpgCopyText(text) {
    if (navigator.clipboard?.writeText) {
        return navigator.clipboard.writeText(text).then(() => true).catch(() => cpgCopyFallback(text));
    }
    return Promise.resolve(cpgCopyFallback(text));
}
function cpgCopyFallback(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
    document.body.appendChild(ta);
    ta.focus(); ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
    return ok;
}
function cpgShowToast(msg) {
    const toast = document.getElementById('cpg-toast');
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toast.classList.remove('show'), 1600);
}

/** render(clusters, imgSrc) — builds swatches, stats, and harmony tags */
function render(clusters, imgSrc) {
    const deduped    = deduplicateClusters(clusters, 28);
    const top        = deduped.slice(0, 8);
    const K          = top.length;
    const hexColors  = top.map(c => rgbToHex(...c.rgb));
    const totalCount = top.reduce((a, t) => a + t.count, 0);

    // Show image preview
    const preview = document.getElementById('cpg-preview');
    preview.src = imgSrc;
    preview.style.display = 'block';
    document.getElementById('cpg-drop-label').style.display = 'none';

    // Swatches grid
    const sw = document.getElementById('cpg-swatches');
    sw.style.display              = 'grid';
    sw.style.gridTemplateColumns  = `repeat(${Math.min(K, 8)}, 1fr)`;
    sw.innerHTML = hexColors.map((hex, i) => {
        const [r, g, b]  = hexToRgb(hex);
        const [h, s, l]  = rgbToHsl(r, g, b);
        const lum        = luminance(r, g, b);
        const textCol    = lum > 0.45 ? '#05070f' : '#ffffff';
        const pct        = Math.round(top[i].count / totalCount * 100);
        return `<div class="cpg-swatch" style="background:${hex}" onclick="cpgCopySwatch('${hex}',this)">
            <button class="cpg-swatch-copy" style="color:${textCol};border-color:${textCol}40"
                    onclick="event.stopPropagation();cpgCopySwatch('${hex}',this.parentElement)">copy</button>
            <div class="cpg-swatch-info">${hex}<br>H${h}° S${s}% L${l}%<br>${pct}%</div>
        </div>`;
    }).join('');

    // Stats
    const dom    = hexColors[0];
    const avgLum = hexColors.reduce((a, h) => { const [r, g, b] = hexToRgb(h); return a + luminance(r, g, b); }, 0) / K;
    const avgSat = hexColors.reduce((a, h) => { const [r, g, b] = hexToRgb(h); return a + rgbToHsl(r, g, b)[1]; }, 0) / K;
    const avgHue = hexColors.reduce((a, h) => { const [r, g, b] = hexToRgb(h); return a + rgbToHsl(r, g, b)[0]; }, 0) / K;
    const tempLabel = avgHue < 80 || avgHue > 290 ? '🔥 Warm' : avgHue < 180 ? '🌿 Neutral' : '❄ Cool';

    document.getElementById('cpg-dominant').textContent  = dom;
    document.getElementById('cpg-dominant').style.color  = dom;
    document.getElementById('cpg-brightness').textContent = avgLum > 0.6 ? 'Light' : avgLum > 0.3 ? 'Mid' : 'Dark';
    document.getElementById('cpg-saturation').textContent = Math.round(avgSat) + '%';
    document.getElementById('cpg-temp').textContent       = tempLabel;
    document.getElementById('cpg-stats').style.display    = 'flex';

    // Harmony tags
    const tags = detectHarmony(hexColors);
    const hr   = document.getElementById('cpg-harmony');
    hr.style.display = 'flex';
    hr.innerHTML = tags.map(t => `<div class="cpg-harmony-chip active">${t}</div>`).join('');

    document.getElementById('cpg-export').style.display = 'flex';
    window._cpgHexColors = hexColors;
}

/** processImage(file) — draws image to canvas and runs k-means */
function processImage(file) {
    // Show loading state
    document.getElementById('cpg-drop-label').style.display = 'none';
    document.getElementById('cpg-loading').style.display    = 'flex';
    document.getElementById('cpg-swatches').style.display   = 'none';
    document.getElementById('cpg-stats').style.display      = 'none';
    document.getElementById('cpg-harmony').style.display    = 'none';
    document.getElementById('cpg-export').style.display     = 'none';

    const reader = new FileReader();
    reader.onload = e => {
        const img = new Image();
        img.onload = () => {
            // Yield to browser to paint spinner before heavy computation
            setTimeout(() => {
                const canvas = document.createElement('canvas');
                const MAX    = 300;
                const scale  = Math.min(1, MAX / Math.max(img.width, img.height));
                canvas.width  = Math.round(img.width  * scale);
                canvas.height = Math.round(img.height * scale);
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const pixels    = samplePixels(imageData);

                document.getElementById('cpg-loading').style.display = 'none';
                if (pixels.length < 10) {
                    document.getElementById('cpg-drop-label').style.display = 'flex';
                    alert('Could not extract enough colour data. Try a different image.');
                    return;
                }

                const clusters = kMeans(pixels, 12, 30);
                render(clusters, e.target.result);
            }, 30);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

/* ── Public API — called from inline HTML event handlers ── */
window.cpgHandleFile = function (file) {
    if (file && file.type.startsWith('image/')) processImage(file);
};
window.cpgHandleDrop = function (e) {
    e.preventDefault();
    document.getElementById('cpg-drop').classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) processImage(file);
};
window.cpgCopySwatch = function (hex) {
    cpgCopyText(hex).then(() => cpgShowToast('Copied ' + hex));
};
window.cpgExportCSS = function () {
    if (!window._cpgHexColors) return;
    const css = window._cpgHexColors.map((h, i) => `  --color-${i + 1}: ${h};`).join('\n');
    cpgCopyText(`:root {\n${css}\n}`).then(() => cpgShowToast('CSS vars copied!'));
};
window.cpgExportHex = function () {
    if (!window._cpgHexColors) return;
    cpgCopyText(window._cpgHexColors.join(', ')).then(() => cpgShowToast('HEX list copied!'));
};
window.cpgReset = function () {
    document.getElementById('cpg-preview').style.display    = 'none';
    document.getElementById('cpg-drop-label').style.display = 'flex';
    document.getElementById('cpg-loading').style.display    = 'none';
    document.getElementById('cpg-swatches').style.display   = 'none';
    document.getElementById('cpg-stats').style.display      = 'none';
    document.getElementById('cpg-harmony').style.display    = 'none';
    document.getElementById('cpg-export').style.display     = 'none';
    document.getElementById('cpg-file-input').value         = '';
    window._cpgHexColors = null;
};

})(); // end color palette IIFE
