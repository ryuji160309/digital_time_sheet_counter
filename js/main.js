/**
 * メインエントリーポイント
 * アプリケーションの初期化と、HTML要素と処理モジュールの紐付けを行います。
 */

import { CONFIG, DEFAULT_COLORS, state, appMode, loadState, saveState, calculateDougaCount, migrateParsedData } from './state.js';
import { applyColorsToCSS, updateDougaCountDisplay, generateTimesheet, updateVisuals, exportPDF, handleInputLogic } from './ui.js';

document.addEventListener('DOMContentLoaded', () => {
    loadState(); 
    applyColorsToCSS(); 
    initUI(); 
    generateTimesheet(); 
    setupKeyboardNavigation(); 
    setupTabletNumpad(); 
    updateDougaCountDisplay();
});

function initUI() {
    initUIValues();
    
    // 基本情報の入力監視
    const globalFields = ['title', 'episode', 'part', 'animator'];
    globalFields.forEach(field => { 
        document.getElementById(`info-${field}`).addEventListener('change', (e) => { 
            state[field] = e.target.value; saveState(); generateTimesheet(); 
        }); 
    });

    document.getElementById('info-cut').addEventListener('change', (e) => { 
        state.cuts[state.activeCutIndex].cutName = e.target.value; saveState(); updateCutSelector(); generateTimesheet(); 
    });
    document.getElementById('input-sec').addEventListener('change', (e) => { 
        state.cuts[state.activeCutIndex].durationSec = parseInt(e.target.value, 10) || 0; saveState(); generateTimesheet(); 
    });
    document.getElementById('input-frame').addEventListener('change', (e) => { 
        state.cuts[state.activeCutIndex].durationFrame = parseInt(e.target.value, 10) || 0; saveState(); generateTimesheet(); 
    });

    // カット管理
    document.getElementById('select-active-cut').addEventListener('change', (e) => {
        state.activeCutIndex = parseInt(e.target.value, 10);
        saveState(); initUIValues(); 
    });
    document.getElementById('btn-add-cut').addEventListener('click', () => {
        const currentCut = state.cuts[state.activeCutIndex];
        const newCutName = currentCut.cutName ? String(parseInt(currentCut.cutName, 10) + 1 || currentCut.cutName + '_new') : String(state.cuts.length + 1);
        state.cuts.push({
            id: Date.now(), cutName: newCutName, 
            durationSec: currentCut.durationSec, durationFrame: currentCut.durationFrame, 
            data: {}, lipData: {}
        });
        state.activeCutIndex = state.cuts.length - 1;
        saveState(); initUIValues(); generateTimesheet();
    });

    // セル列増減
    document.getElementById('btn-add-cell').addEventListener('click', () => { 
        state.cellCols.push(getNextColName(state.cellCols)); saveState(); renderColumnInputs(); generateTimesheet(); 
    });
    document.getElementById('btn-remove-cell').addEventListener('click', () => { 
        if (state.cellCols.length > 1) { state.cellCols.pop(); saveState(); renderColumnInputs(); generateTimesheet(); } 
    });

    // 各種ボタンのイベント紐付け
    document.getElementById('btn-export').addEventListener('click', exportData);
    document.getElementById('btn-import').addEventListener('click', () => document.getElementById('input-import').click());
    document.getElementById('input-import').addEventListener('change', importData);
    document.getElementById('btn-export-pdf').addEventListener('click', exportPDF);
    
    // モーダル・リセット操作
    document.getElementById('btn-open-settings').addEventListener('click', () => {
        document.getElementById('color-bg').value = state.colors.bg; document.getElementById('color-line').value = state.colors.line;
        document.getElementById('color-text').value = state.colors.text; document.getElementById('color-lip').value = state.colors.lip;
        document.getElementById('modal-settings').style.display = 'flex';
    });
    document.getElementById('btn-reset-colors').addEventListener('click', () => {
        document.getElementById('color-bg').value = DEFAULT_COLORS.bg; document.getElementById('color-line').value = DEFAULT_COLORS.line;
        document.getElementById('color-text').value = DEFAULT_COLORS.text; document.getElementById('color-lip').value = DEFAULT_COLORS.lip;
    });
    document.getElementById('btn-save-colors').addEventListener('click', () => {
        state.colors.bg = document.getElementById('color-bg').value; state.colors.line = document.getElementById('color-line').value;
        state.colors.text = document.getElementById('color-text').value; state.colors.lip = document.getElementById('color-lip').value;
        applyColorsToCSS(); saveState(); document.getElementById('modal-settings').style.display = 'none';
    });
    
    document.getElementById('btn-open-reset').addEventListener('click', () => document.getElementById('modal-reset').style.display = 'flex');
    document.getElementById('btn-cancel-reset').addEventListener('click', () => document.getElementById('modal-reset').style.display = 'none');
    document.getElementById('btn-execute-reset').addEventListener('click', () => {
        const keepInfo = document.getElementById('check-keep-info').checked;
        state.cuts.forEach(cut => { cut.data = {}; cut.lipData = {}; });
        if (!keepInfo) { 
            state.title = ''; state.episode = ''; state.part = ''; state.animator = ''; 
            state.cuts = [{ id: Date.now(), cutName: '1', durationSec: 6, durationFrame: 0, data: {}, lipData: {} }]; 
            state.activeCutIndex = 0; 
        }
        saveState(); initUIValues(); generateTimesheet(); document.getElementById('modal-reset').style.display = 'none';
    });

    document.getElementById('btn-show-breakdown').addEventListener('click', showBreakdownModal);
    document.getElementById('btn-close-breakdown').addEventListener('click', () => document.getElementById('modal-breakdown').style.display = 'none');

    // モード切替
    document.getElementById('btn-toggle-lipsync').addEventListener('click', toggleLipSync);
    document.getElementById('btn-toggle-tablet').addEventListener('click', toggleTabletMode);

    // テンキーの表示制御
    document.addEventListener('focusin', (e) => {
        if (appMode.isTabletMode && e.target.classList.contains('cell-input')) {
            document.getElementById('virtual-numpad').style.display = 'block';
        }
    });
}

function initUIValues() {
    document.getElementById('info-title').value = state.title || ''; 
    document.getElementById('info-episode').value = state.episode || '';
    document.getElementById('info-part').value = state.part || ''; 
    document.getElementById('info-animator').value = state.animator || '';
    
    const activeCut = state.cuts[state.activeCutIndex];
    document.getElementById('info-cut').value = activeCut.cutName || '';
    document.getElementById('input-sec').value = activeCut.durationSec; 
    document.getElementById('input-frame').value = activeCut.durationFrame;
    
    updateCutSelector();
    renderColumnInputs();
}

function updateCutSelector() {
    const selector = document.getElementById('select-active-cut');
    selector.innerHTML = '';
    state.cuts.forEach((cut, index) => {
        const opt = document.createElement('option'); opt.value = index; opt.textContent = `Cut ${cut.cutName || (index+1)}`;
        if (index === state.activeCutIndex) opt.selected = true;
        selector.appendChild(opt);
    });
}

function getNextColName(colsArray) {
    const validCols = colsArray.filter(c => c.trim() !== '');
    if (validCols.length === 0) return 'A';
    const last = validCols[validCols.length - 1];
    if (last.slice(-1) < 'Z') return last.slice(0, -1) + String.fromCharCode(last.charCodeAt(last.length - 1) + 1);
    else return last + 'A';
}

function renderColumnInputs() {
    const container = document.getElementById('cell-controls-container'); container.innerHTML = ''; 
    state.cellCols.forEach((colName, index) => {
        const input = document.createElement('input'); input.type = 'text'; input.value = colName; input.className = 'col-input';
        input.addEventListener('change', (e) => { state.cellCols[index] = e.target.value; saveState(); generateTimesheet(); });
        container.appendChild(input);
    });
}

// --- イベント群・モード切替・モーダル表示系 ---
function toggleLipSync() {
    appMode.isLipSyncMode = !appMode.isLipSyncMode;
    const btnMain = document.getElementById('btn-toggle-lipsync'); const btnNum = document.querySelector('.np-btn-lip');
    if (appMode.isLipSyncMode) {
        btnMain.textContent = '口パクモード: ON (1:○, 2:△, 3:✕)'; btnMain.classList.add('active'); if (btnNum) btnNum.classList.add('active');
        document.body.classList.add('lip-sync-mode');
    } else {
        btnMain.textContent = '口パクモード: OFF (1:○, 2:△, 3:✕)'; btnMain.classList.remove('active'); if (btnNum) btnNum.classList.remove('active');
        document.body.classList.remove('lip-sync-mode');
    }
}

function toggleTabletMode() {
    appMode.isTabletMode = !appMode.isTabletMode;
    const btn = document.getElementById('btn-toggle-tablet'); const inputs = document.querySelectorAll('input.cell-input'); const numpad = document.getElementById('virtual-numpad');
    if (appMode.isTabletMode) {
        btn.textContent = '📱 タブレットモード: ON'; btn.classList.add('active');
        inputs.forEach(inp => inp.setAttribute('inputmode', 'none'));
    } else {
        btn.textContent = '📱 タブレットモード: OFF'; btn.classList.remove('active');
        inputs.forEach(inp => inp.removeAttribute('inputmode')); numpad.style.display = 'none';
    }
}

function showBreakdownModal() {
    const listDiv = document.getElementById('breakdown-list'); listDiv.innerHTML = '';
    const warnDiv = document.getElementById('warning-container'); 
    
    // UIモジュールから呼ばれるのではなく自前で計算結果を取得
    const calcResult = calculateDougaCount();
    const breakdown = calcResult.breakdown; const keys = Object.keys(breakdown);
    
    if (calcResult.warnings.length > 0) {
        warnDiv.style.display = 'block';
        warnDiv.innerHTML = '<strong>⚠️ 警告:</strong><br>' + calcResult.warnings.join('<br>');
    } else { warnDiv.style.display = 'none'; }

    if (keys.length === 0) {
        listDiv.innerHTML = '<p style="color:#666; text-align:center;">入力データがありません</p>';
    } else {
        keys.forEach(key => { listDiv.innerHTML += `<div class="breakdown-row"><span>${key}</span><span>${breakdown[key]} 枚</span></div>`; });
        listDiv.innerHTML += `<div class="breakdown-total"><span>計</span><span>${calcResult.total} 枚</span></div>`;
    }
    document.getElementById('modal-breakdown').style.display = 'flex';
}

function setupKeyboardNavigation() {
    document.addEventListener('keydown', (e) => {
        const el = document.activeElement;
        if (!el || !el.classList.contains('cell-input')) return;
        if (appMode.isLipSyncMode && e.key.length === 1 && !['1','2','3'].includes(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); }
        if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); handleInputLogic('Enter'); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); handleInputLogic('ArrowUp'); }
        else if (e.key === 'Backspace') { if (appMode.isLipSyncMode || el.value === '') { e.preventDefault(); handleInputLogic('BS'); } }
        else if (appMode.isLipSyncMode && ['1', '2', '3'].includes(e.key)) { e.preventDefault(); handleInputLogic(e.key); }
    });
}

function setupTabletNumpad() {
    const numpad = document.getElementById('virtual-numpad');
    const buttons = numpad.querySelectorAll('.np-btn');
    buttons.forEach(btn => {
        btn.addEventListener('mousedown', (e) => { e.preventDefault(); }); // フォーカス維持
        btn.addEventListener('click', (e) => {
            const key = btn.dataset.key;
            if (key === 'Close') { numpad.style.display = 'none'; const el = document.activeElement; if (el) el.blur(); 
            } else if (key === 'LipToggle') { toggleLipSync(); } else { handleInputLogic(key, true); }
        });
    });
}

function exportData() {
    const t = state.title || 'タイトル未定'; const e = state.episode || '話数未定';
    const c = state.cuts[0]?.cutName || 'cut未定'; const a = state.animator || '原画未定';
    const filename = `${t}_${e}_${c}_${a}.json`;
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url);
}

function importData(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            let parsed = JSON.parse(event.target.result);
            if (!parsed.cellCols) parsed.cellCols = parsed.gengaCols || ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
            state = migrateParsedData(parsed); 
            saveState(); applyColorsToCSS(); initUIValues(); generateTimesheet();
        } catch (err) { alert('読み込みに失敗しました。'); }
        e.target.value = '';
    };
    reader.readAsText(file);
}