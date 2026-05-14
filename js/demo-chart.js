/**
 * demo-chart.js
 * ─────────────────────────────────────────────
 * Demo 3: Live Chart Builder
 *
 * Features:
 *   - Bar / Line / Scatter chart types (Chart.js)
 *   - Robust CSV parser: quoted fields, BOM, mixed types
 *   - Drag-and-drop or file-input CSV upload
 *   - Auto column-type detection (numeric vs label)
 *   - Editable X/Y axis and title labels
 *   - Stats panel: min, max, mean, trend arrow
 *   - Built-in sample dataset to demo instantly
 * ─────────────────────────────────────────────
 * Requires Chart.js (loaded via CDN in index.html)
 */

/* ── Module state ── */
let chartInst   = null;
let chartType   = 'bar';
let csvHeaders  = [];     // column names (from header row, or auto-generated Col1/Col2…)
let csvRows     = [];     // array of plain objects { colName: rawString }
let chartLabels = [];     // currently plotted X values (strings or numbers)
let chartValues = [];     // currently plotted Y values (numbers)
let hasHeaders  = false;  // did the CSV have a detectable header row?

/* ── Sample dataset — neutral labels, loads on page init ── */
const SAMPLE = {
    headers: ['Label', 'Value A', 'Value B', 'Value C'],
    rows: [
        { Label: 'Jan', 'Value A': 42,  'Value B': 31,  'Value C': 14 },
        { Label: 'Feb', 'Value A': 51,  'Value B': 39,  'Value C': 13 },
        { Label: 'Mar', 'Value A': 48,  'Value B': 34,  'Value C': 14 },
        { Label: 'Apr', 'Value A': 63,  'Value B': 50,  'Value C': 13 },
        { Label: 'May', 'Value A': 59,  'Value B': 45,  'Value C': 13 },
        { Label: 'Jun', 'Value A': 72,  'Value B': 56,  'Value C': 13 },
        { Label: 'Jul', 'Value A': 68,  'Value B': 53,  'Value C': 13 },
        { Label: 'Aug', 'Value A': 82,  'Value B': 63,  'Value C': 13 },
        { Label: 'Sep', 'Value A': 75,  'Value B': 59,  'Value C': 13 },
        { Label: 'Oct', 'Value A': 89,  'Value B': 70,  'Value C': 13 },
        { Label: 'Nov', 'Value A': 92,  'Value B': 73,  'Value C': 13 },
        { Label: 'Dec', 'Value A': 106, 'Value B': 85,  'Value C': 12 },
    ]
};

/* ── Number formatter (1234567 → "1.23M") ── */
function fmtVal(v) {
    const n = parseFloat(v);
    if (isNaN(n)) return v;
    if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + 'k';
    return Number.isInteger(n) ? n : n.toFixed(2);
}

/**
 * parseCsvRobust(raw)
 * Full CSV parser handling:
 *   - BOM stripping, \r\n / \r normalisation
 *   - Quoted fields (including commas inside quotes)
 *   - Escaped double-quotes ("")
 *   - Numeric coercion (strips $, %, spaces)
 *   - Auto-detects header row (non-numeric first row = header)
 */
function parseCsvRobust(raw) {
    raw = raw.replace(/^\uFEFF/, ''); // strip BOM
    const lines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split('\n');
    if (!lines.length) return { headers: [], rows: [], hasHeaders: false };

    function splitLine(line) {
        const fields = [];
        let cur = '', inQ = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
                if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
                else inQ = !inQ;
            } else if (ch === ',' && !inQ) {
                fields.push(cur.trim());
                cur = '';
            } else {
                cur += ch;
            }
        }
        fields.push(cur.trim());
        return fields.map(f => f.replace(/^"|"$/g, ''));
    }

    const firstRow = splitLine(lines[0]);
    function looksNumeric(s) {
        return s !== '' && !isNaN(parseFloat(s.replace(/[$,%\s]/g, '')));
    }
    const row1AllNum = firstRow.every(looksNumeric);
    const hasHdr     = !row1AllNum;

    let headers, dataLines;
    if (hasHdr) {
        headers   = firstRow.map((h, i) => h || `Col${i + 1}`);
        dataLines = lines.slice(1);
    } else {
        headers   = firstRow.map((_, i) => `Col${i + 1}`);
        dataLines = lines;
    }

    const rows = dataLines
        .filter(l => l.trim())
        .map(l => {
            const vals = splitLine(l);
            const obj  = {};
            headers.forEach((h, i) => {
                const raw     = vals[i] !== undefined ? vals[i] : '';
                const cleaned = raw.replace(/[$,%\s]/g, '');
                obj[h] = cleaned !== '' && !isNaN(parseFloat(cleaned))
                    ? parseFloat(cleaned)
                    : raw;
            });
            return obj;
        });

    return { headers, rows, hasHeaders: hasHdr };
}

/** numericCols(headers, rows) — returns header names whose values are mostly numeric */
function numericCols(headers, rows) {
    return headers.filter(h => {
        const sample       = rows.slice(0, 20).map(r => r[h]);
        const numericCount = sample.filter(v =>
            typeof v === 'number' || (!isNaN(parseFloat(v)) && v !== '')
        ).length;
        return numericCount >= Math.min(3, sample.length * 0.5);
    });
}

/** populateAxisSelectors — sets datalist options and default X/Y inputs */
function populateAxisSelectors(headers, rows, defaultX, defaultY) {
    const numCols = numericCols(headers, rows);

    const dl = document.getElementById('chart-cols-list');
    dl.innerHTML = '';
    headers.forEach(h => {
        const o = document.createElement('option');
        o.value = h;
        dl.appendChild(o);
    });

    const xInput = document.getElementById('chart-x-col');
    const yInput = document.getElementById('chart-y-col');
    xInput.value = defaultX || headers[0];

    const yCols = numCols.length ? numCols : headers;
    const yDef  = defaultY || yCols.find(c => c !== xInput.value) || yCols[0] || headers[1] || headers[0];
    yInput.value = yDef;

    const xl = document.getElementById('chart-xlabel');
    const yl = document.getElementById('chart-ylabel');
    if (!xl.value) xl.value = xInput.value;
    if (!yl.value) yl.value = yInput.value;

    document.getElementById('chart-axis-row').style.display      = 'flex';
    document.getElementById('chart-col-pickers').style.display   = 'flex';
    applyColumnSelection();
}

/** applyColumnSelection — reads current X/Y inputs, extracts data, redraws chart */
function applyColumnSelection() {
    if (!csvRows.length) return;
    const xCol = document.getElementById('chart-x-col').value.trim();
    const yCol = document.getElementById('chart-y-col').value.trim();
    if (!xCol || !yCol) return;

    function resolveCol(name) {
        if (csvHeaders.includes(name)) return name;
        const ci = csvHeaders.find(h => h.toLowerCase() === name.toLowerCase());
        if (ci) return ci;
        const idx = parseInt(name, 10);
        if (!isNaN(idx) && idx >= 0 && idx < csvHeaders.length) return csvHeaders[idx];
        return null;
    }

    const resolvedX = resolveCol(xCol);
    const resolvedY = resolveCol(yCol);
    if (!resolvedX || !resolvedY) return;

    // Sync axis label hints if user hasn't customised them yet
    const xl = document.getElementById('chart-xlabel');
    const yl = document.getElementById('chart-ylabel');
    if (csvHeaders.includes(xl.value) || xl.value === '') xl.value = resolvedX;
    if (csvHeaders.includes(yl.value) || yl.value === '') yl.value = resolvedY;

    chartLabels = csvRows.map(r => r[resolvedX] !== undefined ? String(r[resolvedX]) : '');
    chartValues = csvRows.map(r => {
        const v = parseFloat(r[resolvedY]);
        return isNaN(v) ? 0 : v;
    });

    updateChart();
}

/** validateColInput — flags invalid column names on blur only (no live red flash) */
function validateColInput(input) {
    if (!csvRows.length || !input.value.trim()) { input.style.borderColor = ''; return; }
    const name = input.value.trim();
    const ok = csvHeaders.includes(name)
        || csvHeaders.find(h => h.toLowerCase() === name.toLowerCase())
        || (!isNaN(parseInt(name, 10)) && parseInt(name, 10) < csvHeaders.length);
    input.style.borderColor = ok ? '' : 'var(--m)';
    if (!ok) {
        const ci = csvHeaders.find(h => h.toLowerCase() === name.toLowerCase());
        if (ci) { input.value = ci; input.style.borderColor = ''; applyColumnSelection(); }
    }
}

/** updateAxisLabels — updates chart labels without full re-render */
function updateAxisLabels() {
    if (!chartInst) return;
    const xl = document.getElementById('chart-xlabel').value.trim();
    const yl = document.getElementById('chart-ylabel').value.trim();
    const ti = document.getElementById('chart-title-input').value.trim();

    if (chartInst.options.scales.x)
        chartInst.options.scales.x.title = { display: !!xl, text: xl, color: '#4a567a', font: { family: "'Share Tech Mono'", size: 10 } };
    if (chartInst.options.scales.y)
        chartInst.options.scales.y.title = { display: !!yl, text: yl, color: '#4a567a', font: { family: "'Share Tech Mono'", size: 10 } };
    chartInst.options.plugins.title = { display: !!ti, text: ti, color: 'rgba(0,255,231,0.7)', font: { family: "'Share Tech Mono'", size: 11 } };
    chartInst.update('none');
}

/** updateChart — destroys old chart and renders a new one with current state */
function updateChart() {
    if (!chartLabels.length || !chartValues.length) return;

    const ctx  = document.getElementById('chart-canvas').getContext('2d');
    if (chartInst) { chartInst.destroy(); chartInst = null; }

    const cyan = 'rgba(0,255,231,';
    const xl   = (document.getElementById('chart-xlabel')?.value || '').trim();
    const yl   = (document.getElementById('chart-ylabel')?.value || '').trim();
    const ti   = (document.getElementById('chart-title-input')?.value || '').trim();
    const minV = Math.min(...chartValues), maxV = Math.max(...chartValues);
    const range = maxV - minV || 1;

    let datasets;
    if (chartType === 'scatter') {
        const xNums = chartLabels.map((v, i) => { const n = parseFloat(v); return isNaN(n) ? i : n; });
        datasets = [{
            label: yl || 'Y',
            data: xNums.map((x, i) => ({ x, y: chartValues[i] })),
            backgroundColor: cyan + '0.65)',
            borderColor:     cyan + '1)',
            pointRadius: 5, pointHoverRadius: 8,
        }];
    } else {
        datasets = [{
            label: yl || 'Value',
            data:  chartValues,
            backgroundColor: chartType === 'bar'
                ? chartValues.map(v => `rgba(0,255,231,${0.12 + 0.55 * (v - minV) / range})`)
                : cyan + '0.1)',
            borderColor:         cyan + '0.85)',
            borderWidth:         2,
            fill:                chartType === 'line',
            tension:             0.35,
            pointBackgroundColor: cyan + '1)',
            pointRadius:         chartType === 'line' ? 3 : 0,
            pointHoverRadius:    7,
        }];
    }

    const scaleCfg = (labelText) => ({
        ticks: { color: '#4a567a', font: { family: "'Share Tech Mono'", size: 10 } },
        grid:  { color: 'rgba(26,34,64,0.9)' },
        title: { display: !!labelText, text: labelText, color: '#4a567a', font: { family: "'Share Tech Mono'", size: 10 } }
    });

    chartInst = new Chart(ctx, {
        type: chartType === 'scatter' ? 'scatter' : chartType,
        data: { labels: chartType !== 'scatter' ? chartLabels : undefined, datasets },
        options: {
            responsive: true, maintainAspectRatio: false,
            animation: { duration: 420, easing: 'easeInOutQuart' },
            plugins: {
                legend: { display: false },
                title:  { display: !!ti, text: ti, color: 'rgba(0,255,231,0.7)', font: { family: "'Share Tech Mono'", size: 11 } },
                tooltip: {
                    backgroundColor: '#0d1117',
                    borderColor: 'rgba(0,255,231,0.25)', borderWidth: 1,
                    titleFont: { family: "'Share Tech Mono'", size: 10 },
                    bodyFont:  { family: "'Share Tech Mono'", size: 10 },
                    callbacks: {
                        title: (items) => { const lbl = items[0]?.label || ''; return xl ? `${xl}: ${lbl}` : lbl; },
                        label: (ctx) => {
                            if (chartType === 'scatter') return `(${ctx.parsed.x}, ${ctx.parsed.y})`;
                            return (yl ? `${yl}: ` : '') + fmtVal(ctx.parsed.y);
                        }
                    }
                }
            },
            scales: {
                x: { ...scaleCfg(xl), ticks: { ...scaleCfg(xl).ticks, maxRotation: 45, autoSkip: true, maxTicksLimit: 12 } },
                y: scaleCfg(yl)
            }
        }
    });

    // Update stats panel
    const nums = chartValues.filter(v => !isNaN(v));
    if (!nums.length) return;
    const min  = Math.min(...nums), max = Math.max(...nums);
    const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
    const first = nums[0], last = nums[nums.length - 1];
    document.getElementById('cs-min').textContent  = fmtVal(min);
    document.getElementById('cs-max').textContent  = fmtVal(max);
    document.getElementById('cs-mean').textContent = fmtVal(mean);
    const tEl = document.getElementById('cs-trend');
    tEl.textContent = last > first ? '▲ Up' : last < first ? '▼ Down' : '→ Flat';
    tEl.style.color = last > first ? 'var(--c)' : last < first ? 'var(--m)' : 'var(--muted)';
}

/** setChart — switch chart type and re-render */
function setChart(type) {
    chartType = type;
    ['bar', 'line', 'scatter'].forEach(t =>
        document.getElementById('ct-' + t).classList.toggle('active', t === type));
    if (csvRows.length) applyColumnSelection();
    else if (chartValues.length) updateChart();
}

/** ingestCsv — parse and load CSV text into the chart */
function ingestCsv(text, filename) {
    const parsed = parseCsvRobust(text);
    const { headers, rows } = parsed;
    hasHeaders = parsed.hasHeaders;

    if (!headers.length || !rows.length) {
        showCsvError('Could not parse file — make sure it is a valid CSV');
        return;
    }

    csvHeaders = headers;
    csvRows    = rows;

    document.getElementById('chart-xlabel').value      = '';
    document.getElementById('chart-ylabel').value      = '';
    document.getElementById('chart-title-input').value = filename.replace(/\.csv$/i, '');

    const numCols  = numericCols(headers, rows);
    const defaultX = headers[0];
    const defaultY = numCols.find(c => c !== defaultX) || numCols[0] || headers[1] || headers[0];
    populateAxisSelectors(headers, rows, defaultX, defaultY);

    const info       = document.getElementById('chart-csv-info');
    const headerNote = hasHeaders ? 'headers detected' : 'no headers — auto-named columns';
    info.style.display = 'block';
    info.innerHTML = `✓ <b>${filename}</b> &nbsp;·&nbsp; ${rows.length} rows &nbsp;·&nbsp; ${headers.length} cols &nbsp;·&nbsp; ${headerNote}`
        + (numCols.length
            ? ` &nbsp;·&nbsp; numeric: <span style="color:var(--c)">${numCols.join(', ')}</span>`
            : ' &nbsp;·&nbsp; <span style="color:var(--y)">no numeric columns detected</span>');
    document.getElementById('chart-drop').style.display = 'none';
}

function showCsvError(msg) {
    const drop = document.getElementById('chart-drop');
    drop.style.display   = 'block';
    drop.textContent     = '⚠ ' + msg;
    drop.style.borderColor = 'var(--m)';
    setTimeout(() => {
        drop.textContent     = '⬆ drag & drop a CSV here, or use Upload CSV above';
        drop.style.borderColor = '';
    }, 3000);
}

/* ── File input handlers ── */
function handleCsvDrop(e) {
    e.preventDefault();
    document.getElementById('chart-drop').classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (!file.name.match(/\.csv$/i) && file.type !== 'text/csv') {
        showCsvError('Please drop a .csv file');
        return;
    }
    readCsvFile(file);
}

function handleCsvFile(input) {
    const file = input.files[0];
    if (!file) return;
    readCsvFile(file);
    input.value = '';
}

function readCsvFile(file) {
    const reader   = new FileReader();
    reader.onload  = ev => ingestCsv(ev.target.result, file.name);
    reader.onerror = ()  => showCsvError('Could not read file');
    reader.readAsText(file);
}

/** loadSampleData — load the built-in sample dataset */
function loadSampleData() {
    csvHeaders = SAMPLE.headers;
    csvRows    = SAMPLE.rows;
    hasHeaders = true;

    document.getElementById('chart-xlabel').value      = '';
    document.getElementById('chart-ylabel').value      = '';
    document.getElementById('chart-title-input').value = '';

    const numCols = numericCols(SAMPLE.headers, SAMPLE.rows);
    const defX    = SAMPLE.headers[0];
    const defY    = numCols[0] || SAMPLE.headers[1];
    populateAxisSelectors(SAMPLE.headers, SAMPLE.rows, defX, defY);

    document.getElementById('chart-drop').style.display = 'none';
    const info = document.getElementById('chart-csv-info');
    info.style.display = 'block';
    info.innerHTML = `✓ <b>Sample data</b> &nbsp;·&nbsp; ${SAMPLE.rows.length} rows &nbsp;·&nbsp; ${SAMPLE.headers.length} cols &nbsp;·&nbsp; numeric: <span style="color:var(--c)">${numCols.join(', ')}</span>`;
}

/** resetCsv — clear all CSV data and reset UI */
function resetCsv() {
    csvHeaders = []; csvRows = [];
    chartLabels = []; chartValues = [];
    document.getElementById('chart-axis-row').style.display  = 'none';
    document.getElementById('chart-csv-info').style.display  = 'none';
    document.getElementById('chart-drop').style.display      = 'block';
    document.getElementById('chart-drop').textContent        = '⬆ drag & drop a CSV here, or use Upload CSV above';
    document.getElementById('chart-drop').style.borderColor  = '';
    document.getElementById('chart-xlabel').value            = '';
    document.getElementById('chart-ylabel').value            = '';
    document.getElementById('chart-title-input').value       = '';
    if (chartInst) { chartInst.destroy(); chartInst = null; }
    ['cs-min', 'cs-max', 'cs-mean', 'cs-trend'].forEach(id =>
        document.getElementById(id).textContent = '—');
}

/* ── Initialise on DOM ready ── */
document.addEventListener('DOMContentLoaded', () => {
    loadSampleData();
    // Auto-run sentiment on placeholder text so demo is live immediately
    const sentInput = document.getElementById('sent-input');
    if (sentInput && sentInput.value.trim()) window.analyzeSentiment();
});
