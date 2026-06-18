/**
 * UI制御モジュール
 * DOMの生成、描画更新、PDF出力、キーボード・テンキー入力イベントのハンドリングを行います。
 */

import { CONFIG, state, appMode, saveState, calculateDougaCount } from './state.js';

/**
 * 【処理フロー概要】
 * 1. generateTimesheet: 全カットのデータからHTML要素を構築し画面に表示。
 * 2. 入力イベント: input要素のchangeやキーボード操作でローカルデータを更新し、saveState()を呼ぶ。
 * 3. exportPDF: 現在のHTML要素をPDF用に最適化し、html2pdfに渡して出力する。
 */

// --- 描画・更新系 ---

export function applyColorsToCSS() {
    const root = document.documentElement;
    root.style.setProperty('--sheet-bg', state.colors.bg);
    root.style.setProperty('--sheet-line', state.colors.line);
    root.style.setProperty('--sheet-text', state.colors.text);
    root.style.setProperty('--sheet-lip', state.colors.lip);
}

export function updateDougaCountDisplay() {
    const calcResult = calculateDougaCount();
    const countBtn = document.getElementById('btn-show-breakdown');
    const countSpan = document.getElementById('display-douga-count');
    if (!countSpan) return;

    countSpan.textContent = calcResult.total;

    if (calcResult.warnings.length > 0) {
        countBtn.style.color = '#cf1322'; countBtn.style.borderColor = '#ffa39e'; countBtn.style.background = '#fff1f0';
        countSpan.style.color = '#cf1322';
        if (!document.getElementById('warn-icon')) countBtn.innerHTML += '<span id="warn-icon"> ⚠️</span>';
    } else {
        countBtn.style.color = 'var(--sheet-line)'; countBtn.style.borderColor = 'var(--sheet-line)'; countBtn.style.background = '#eaf6eb';
        countSpan.style.color = 'var(--sheet-line)';
        const icon = document.getElementById('warn-icon'); if (icon) icon.remove();
    }
}

export function generateTimesheet() {
    const container = document.getElementById('timesheet-container'); 
    container.innerHTML = ''; 
    
    state.cuts.forEach((cut, cutIndex) => {
        const framesPerPage = CONFIG.fps * CONFIG.secondsPerBlock * CONFIG.blocksPerPage;
        const totalFrames = (cut.durationSec * CONFIG.fps) + cut.durationFrame;
        const totalPages = Math.max(1, Math.ceil(totalFrames / framesPerPage));

        const cutDiv = document.createElement('div');
        cutDiv.className = 'cut-container';

        for (let p = 0; p < totalPages; p++) {
            const pageDiv = document.createElement('div'); pageDiv.className = 'page';
            pageDiv.appendChild(createPageHeader(cut, p, totalPages));

            const tablesDiv = document.createElement('div'); tablesDiv.className = 'page-tables';
            for (let b = 0; b < CONFIG.blocksPerPage; b++) {
                const startFrame = (p * framesPerPage) + (b * CONFIG.fps * CONFIG.secondsPerBlock) + 1;
                const table = document.createElement('table');
                table.appendChild(createTableHeader()); 
                table.appendChild(createTableBody(cut, cutIndex, startFrame, CONFIG.fps * CONFIG.secondsPerBlock, totalFrames));
                tablesDiv.appendChild(table);
            }
            pageDiv.appendChild(tablesDiv); cutDiv.appendChild(pageDiv);
        }
        container.appendChild(cutDiv);
    });
    
    updateVisuals();
    if (appMode.isTabletMode) { document.querySelectorAll('input.cell-input').forEach(inp => inp.setAttribute('inputmode', 'none')); }
}

function createPageHeader(cut, pageIndex, totalPages) {
    const header = document.createElement('div'); header.className = 'page-header';
    header.innerHTML = `
        <div class="info-box" style="flex-grow: 2.5;"><span class="info-label">タイトル</span><span class="info-val">${state.title}</span></div>
        <div class="info-box" style="flex-grow: 1;"><span class="info-val">${state.episode}</span><span class="info-unit">話</span></div>
        <div class="info-box" style="flex-grow: 1;"><span class="info-label">パート</span><span class="info-val">${state.part}</span></div>
        <div class="info-box" style="flex-grow: 1.5;"><span class="info-label">カットナンバー</span><span class="info-val">${cut.cutName}</span></div>
        <div class="info-box" style="flex-grow: 2.5; display: flex; align-items: center; justify-content: center;">
            <div style="display: flex; align-items: flex-end; justify-content: center;">
                <span class="info-val" style="width: auto; line-height: 1;">${cut.durationSec}</span>
                <span class="info-unit" style="position: static; font-size: 10px; margin: 0 4px 2px 4px;">秒 ＋</span>
                <span class="info-val" style="width: auto; line-height: 1;">${cut.durationFrame}</span>
                <span class="info-unit" style="position: static; font-size: 10px; margin: 0 0 2px 4px;">コマ</span>
            </div>
        </div>
        <div class="info-box" style="flex-grow: 2;"><span class="info-label">原画</span><span class="info-val">${state.animator}</span></div>
        <div class="info-box" style="flex-grow: 1.5;"><span class="info-label">シート</span><span class="info-val">${pageIndex + 1} / ${totalPages}</span><span class="info-unit">枚目</span></div>
    `;
    return header;
}

function createTableHeader() {
    const thead = document.createElement('thead'); const tr1 = document.createElement('tr');
    const thSec = document.createElement('th'); thSec.textContent = 'Sec'; thSec.rowSpan = 2; thSec.className = 'group-header col-sec'; tr1.appendChild(thSec);
    const appendGrp = (txt, col) => { const th = document.createElement('th'); th.textContent = txt; th.colSpan = col; th.className = 'group-header'; tr1.appendChild(th); };

    appendGrp('原画', state.cellCols.length);
    const thDial = document.createElement('th'); thDial.textContent = 'セリフ'; thDial.rowSpan = 2; thDial.className = 'group-header col-dialogue'; tr1.appendChild(thDial);
    appendGrp('動画', state.cellCols.length); 
    const thCam = document.createElement('th'); thCam.textContent = 'カメラ'; thCam.rowSpan = 2; thCam.colSpan = 3; thCam.className = 'group-header col-cam'; tr1.appendChild(thCam);
    thead.appendChild(tr1);

    const tr2 = document.createElement('tr');
    const appendSub = (cols) => { cols.forEach(c => { const th = document.createElement('th'); th.textContent = c; th.className = 'sub-header'; tr2.appendChild(th); }); };
    appendSub(state.cellCols); appendSub(state.cellCols); 
    thead.appendChild(tr2); return thead;
}

function createTableBody(cut, cutIndex, startFrame, framesCount, totalFrames) {
    const tbody = document.createElement('tbody'); const cols = [];
    
    state.cellCols.forEach((c, index) => cols.push({ key: `genga_col${index}`, cls: 'col-genga' }));
    cols.push({ key: 'dialogue', cls: 'col-dialogue' });
    state.cellCols.forEach((c, index) => cols.push({ key: `douga_col${index}`, cls: 'col-douga' }));
    cols.push({ key: 'cam_1', cls: 'col-cam' }, { key: 'cam_2', cls: 'col-cam' }, { key: 'cam_3', cls: 'col-cam' });

    for (let i = 0; i < framesCount; i++) {
        const f = startFrame + i; const tr = document.createElement('tr');
        if (f % CONFIG.fps === 0) tr.classList.add('border-1second');
        else if (f % CONFIG.subDivisionFrame === 0) tr.classList.add('border-6frames');
        if (f === totalFrames) tr.classList.add('end-of-cut');

        const isOut = f > totalFrames; const tdF = document.createElement('td');
        tdF.className = 'col-sec'; if (isOut) tdF.classList.add('out-of-duration');
        tdF.textContent = f % CONFIG.fps === 0 ? `${Math.floor(f / CONFIG.fps)} sec` : f % CONFIG.fps; 
        tr.appendChild(tdF);

        cols.forEach(col => {
            const td = document.createElement('td'); td.className = col.cls;
            if (isOut) td.classList.add('out-of-duration');
            const input = document.createElement('input');
            input.type = 'text'; input.className = 'cell-input'; 
            input.dataset.cut = cutIndex; input.dataset.frame = f; input.dataset.colkey = col.key;
            
            if (cut.data[col.key] && cut.data[col.key][f]) input.value = cut.data[col.key][f];
            
            if (cut.lipData[col.key] && cut.lipData[col.key][f]) {
                const markDiv = document.createElement('div'); markDiv.className = 'lip-sync-mark';
                markDiv.textContent = cut.lipData[col.key][f]; td.appendChild(markDiv);
            }

            // 入力中（軽くするためのローカル更新）
            input.addEventListener('input', (e) => {
                if (appMode.isLipSyncMode) { e.target.value = state.cuts[cutIndex].data[col.key]?.[f] || ''; return; }
                if (!state.cuts[cutIndex].data[col.key]) state.cuts[cutIndex].data[col.key] = {};
                state.cuts[cutIndex].data[col.key][f] = e.target.value;
                adjustLocalVisuals(input); 
            });

            // 確定時（全計算と保存）
            input.addEventListener('change', (e) => {
                if (appMode.isLipSyncMode) return;
                let v = e.target.value; let c = false;
                if (v === '.') { v = '・'; c = true; } else if (v === '*') { v = '✕'; c = true; }
                if (c) { e.target.value = v; state.cuts[cutIndex].data[col.key][f] = v; }
                saveState(); updateVisuals();
            });

            td.appendChild(input); tr.appendChild(td);
        });
        tbody.appendChild(tr);
    }
    return tbody;
}

function adjustLocalVisuals(input) {
    const val = input.value;
    const isNarrow = input.parentElement.classList.contains('col-genga') || input.parentElement.classList.contains('col-douga') || input.parentElement.classList.contains('col-dialogue');
    if (isNarrow) {
        if (val.length >= 3) input.style.fontSize = '9px';
        else if (val.length === 2) input.style.fontSize = '11px';
        else input.style.fontSize = '14px'; 
    }
}

export function updateVisuals() {
    document.querySelectorAll('input.cell-input').forEach(input => {
        adjustLocalVisuals(input);
        const val = input.value; const cIdx = input.dataset.cut; const f = parseInt(input.dataset.frame, 10); const k = input.dataset.colkey;
        if (val === '/') {
            const p = state.cuts[cIdx].data[k] && state.cuts[cIdx].data[k][f - 1] === '/'; 
            const n = state.cuts[cIdx].data[k] && state.cuts[cIdx].data[k][f + 1] === '/';
            if (p || n) input.classList.add('hold-line'); else input.classList.remove('hold-line');
        } else { input.classList.remove('hold-line'); }
    });
}

// --- PDF出力 ---
export function exportPDF() {
    const loadingMsg = document.getElementById('pdf-loading'); loadingMsg.style.display = 'inline';
    const printWrapper = document.createElement('div');
    printWrapper.style.position = 'absolute'; printWrapper.style.top = '0'; printWrapper.style.left = '-9999px';
    const printContainer = document.createElement('div'); 
    printContainer.style.width = '1050px'; printContainer.style.display = 'flex'; printContainer.style.flexDirection = 'column';

    const pages = document.querySelectorAll('.page');
    pages.forEach(page => {
        const clone = page.cloneNode(true); clone.style.margin = '0 0 20px 0'; clone.style.boxShadow = 'none';
        const originalInputs = page.querySelectorAll('input.cell-input'); const clonedInputs = clone.querySelectorAll('input.cell-input');
        originalInputs.forEach((input, index) => {
            const div = document.createElement('div'); div.textContent = input.value; div.className = input.className; div.style.fontSize = input.style.fontSize; 
            div.style.display = 'flex'; div.style.alignItems = 'center'; div.style.justifyContent = 'center'; div.style.width = '100%'; div.style.height = '100%'; div.style.boxSizing = 'border-box'; div.style.color = 'var(--sheet-text)';
            if(input.classList.contains('hold-line')) div.classList.add('hold-line');
            clonedInputs[index].parentNode.replaceChild(div, clonedInputs[index]);
        });
        printContainer.appendChild(clone);
    });
    printWrapper.appendChild(printContainer); document.body.appendChild(printWrapper);

    const t = state.title || 'タイトル未定'; const e = state.episode || '話数未定';
    const c = state.cuts[0]?.cutName || 'cut未定'; const a = state.animator || '原画未定';
    const filename = `${t}_${e}_${c}_${a}.pdf`;

    const opt = {
        margin: 10, filename: filename, image: { type: 'jpeg', quality: 1.0 },
        html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'mm', format: 'a3', orientation: 'portrait' }, pagebreak: { mode: 'css', elements: '.page' }
    };
    html2pdf().set(opt).from(printContainer).save().then(() => { document.body.removeChild(printWrapper); loadingMsg.style.display = 'none'; });
}

// --- 入力制御（キーボード・テンキー） ---

function moveFocus(f, k, cIdx, direction, currentEl) {
    let nextF = f;
    if (direction === 'down') nextF = f + 1;
    else if (direction === 'up') nextF = f - 1;
    else if (direction === 'right') {
        const inputsInRow = Array.from(currentEl.closest('tr').querySelectorAll('input.cell-input'));
        const currentIndex = inputsInRow.indexOf(currentEl);
        if (currentIndex >= 0 && currentIndex < inputsInRow.length - 1) {
            const nextInput = inputsInRow[currentIndex + 1]; if (!nextInput.disabled) nextInput.focus(); return;
        }
    }
    if (nextF > 0) {
        const next = document.querySelector(`input[data-cut="${cIdx}"][data-frame="${nextF}"][data-colkey="${k}"]`);
        if (next && !next.disabled) next.focus();
    }
}

export function handleInputLogic(key, isVirtual = false) {
    const el = document.activeElement;
    if (!el || !el.classList.contains('cell-input')) return;
    const f = parseInt(el.dataset.frame, 10); const k = el.dataset.colkey; const cIdx = el.dataset.cut;

    if (appMode.isLipSyncMode) {
        if (['1', '2', '3'].includes(key)) {
            if (isVirtual) el.focus();
            const mark = key === '1' ? '○' : key === '2' ? '△' : '✕';
            if (state.cuts[cIdx].lipData[k] && state.cuts[cIdx].lipData[k][f] === mark) {
                delete state.cuts[cIdx].lipData[k][f];
                let existingMark = el.closest('td').querySelector('.lip-sync-mark'); if (existingMark) existingMark.remove();
                saveState(); return; 
            }
            if (!state.cuts[cIdx].lipData[k]) state.cuts[cIdx].lipData[k] = {};
            state.cuts[cIdx].lipData[k][f] = mark; saveState();
            let td = el.closest('td'); let markDiv = td.querySelector('.lip-sync-mark');
            if (!markDiv) { markDiv = document.createElement('div'); markDiv.className = 'lip-sync-mark'; td.appendChild(markDiv); }
            markDiv.textContent = mark;
            moveFocus(f, k, cIdx, 'down', el); return;
        }
        if (key === 'BS') {
            if (isVirtual) el.focus();
            if (state.cuts[cIdx].lipData[k] && state.cuts[cIdx].lipData[k][f]) {
                delete state.cuts[cIdx].lipData[k][f];
                let markDiv = el.closest('td').querySelector('.lip-sync-mark'); if (markDiv) markDiv.remove();
                saveState(); return;
            } else { moveFocus(f, k, cIdx, 'up', el); }
        } else if (key === 'Enter' || key === 'ArrowDown') { if (isVirtual) el.focus(); moveFocus(f, k, cIdx, 'down', el); 
        } else if (key === 'ArrowUp') { moveFocus(f, k, cIdx, 'up', el); 
        } else if (key === 'Tab') { if (isVirtual) el.focus(); moveFocus(f, k, cIdx, 'right', el); }
    } else {
        if (['0','1','2','3','4','5','6','7','8','9','/','*','.'].includes(key)) {
            if (isVirtual) {
                el.value += key;
                if (!state.cuts[cIdx].data[k]) state.cuts[cIdx].data[k] = {};
                state.cuts[cIdx].data[k][f] = el.value; adjustLocalVisuals(el); el.focus();
                clearTimeout(el.dataset.saveTimer);
                el.dataset.saveTimer = setTimeout(() => { saveState(); updateVisuals(); }, 300);
            }
        } else if (key === 'Enter' || key === 'ArrowDown') { 
            if (isVirtual) { 
                let v = el.value; let c = false;
                if (v === '.') { v = '・'; c = true; } else if (v === '*') { v = '✕'; c = true; }
                if (c) { el.value = v; state.cuts[cIdx].data[k][f] = v; }
                saveState(); updateVisuals(); el.focus(); 
            } else {
                el.blur(); // focusを外してchangeイベント(全計算)を発火
            }
            moveFocus(f, k, cIdx, 'down', el); 
        } else if (key === 'ArrowUp') { moveFocus(f, k, cIdx, 'up', el); 
        } else if (key === 'Tab') { if (isVirtual) el.focus(); moveFocus(f, k, cIdx, 'right', el);
        } else if (key === 'BS') {
            if (isVirtual) el.focus();
            if (el.value === '') { moveFocus(f, k, cIdx, 'up', el); }
            else if (isVirtual) { 
                el.value = el.value.slice(0, -1); 
                state.cuts[cIdx].data[k][f] = el.value; adjustLocalVisuals(el);
                clearTimeout(el.dataset.saveTimer);
                el.dataset.saveTimer = setTimeout(() => { saveState(); updateVisuals(); }, 300);
            }
        }
    }
}