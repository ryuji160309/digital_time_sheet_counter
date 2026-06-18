/**
 * 状態管理・計算ロジックモジュール
 * アプリケーションのデータ構造、定数、保存/読み込み処理、および枚数計算を管理します。
 */

export const CONFIG = {
    fps: 24,
    secondsPerBlock: 3,
    blocksPerPage: 2,
    subDivisionFrame: 6,
    lsKey: 'timesheet_app_data'
};

export const DEFAULT_COLORS = {
    bg: '#B8E090', line: '#30A850', text: '#000000', lip: '#dc0000'
};

// グローバルな状態データ
export let state = {
    title: '', episode: '', part: '', animator: '',
    cellCols: ['A', 'B', 'C', 'D', 'E', 'F', 'G'], 
    colors: { ...DEFAULT_COLORS },
    cuts: [], 
    activeCutIndex: 0
};

// アプリの動作モード
export let appMode = {
    isLipSyncMode: false,
    isTabletMode: false
};

/**
 * データをローカルストレージに保存します。
 */
export function saveState() { 
    localStorage.setItem(CONFIG.lsKey, JSON.stringify(state)); 
}

/**
 * 古いバージョンのJSONデータを現在の複数カット対応形式に変換します。
 * @param {Object} parsed 読み込んだJSONデータ
 * @returns {Object} マイグレーション後のデータ
 */
export function migrateParsedData(parsed) {
    if (!parsed.cuts || parsed.cuts.length === 0) {
        let cutData = { ...parsed.data }; 
        let newLip = { ...parsed.lipData };
        if (parsed.cellCols) {
            parsed.cellCols.forEach((c, index) => {
                if (c && cutData[`genga_${c}`] !== undefined) { cutData[`genga_col${index}`] = cutData[`genga_${c}`]; delete cutData[`genga_${c}`]; }
                if (c && cutData[`douga_${c}`] !== undefined) { cutData[`douga_col${index}`] = cutData[`douga_${c}`]; delete cutData[`douga_${c}`]; }
                if (c && newLip[`genga_${c}`] !== undefined) { newLip[`genga_col${index}`] = newLip[`genga_${c}`]; delete newLip[`genga_${c}`]; }
                if (c && newLip[`douga_${c}`] !== undefined) { newLip[`douga_col${index}`] = newLip[`douga_${c}`]; delete newLip[`douga_${c}`]; }
            });
        }
        parsed.cuts = [{
            id: Date.now(),
            cutName: parsed.cut || '1',
            durationSec: parsed.durationSec !== undefined ? parsed.durationSec : 6,
            durationFrame: parsed.durationFrame !== undefined ? parsed.durationFrame : 0,
            data: cutData || {}, lipData: newLip || {}
        }];
        parsed.activeCutIndex = 0;
    }
    if (!parsed.colors) parsed.colors = { ...DEFAULT_COLORS };
    return parsed;
}

/**
 * ローカルストレージからデータを読み込みます。
 */
export function loadState() {
    const saved = localStorage.getItem(CONFIG.lsKey);
    if (saved) {
        try {
            let parsed = JSON.parse(saved);
            if (parsed.gengaCols && !parsed.cellCols) parsed.cellCols = parsed.gengaCols;
            if (!parsed.cellCols || parsed.cellCols.length === 0) parsed.cellCols = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
            state = migrateParsedData(parsed);
        } catch (e) {
            console.error("データ読み込みエラー:", e);
        }
    } else {
        state.cuts = [{ id: Date.now(), cutName: '1', durationSec: 6, durationFrame: 0, data: {}, lipData: {} }];
    }
}

/**
 * 動画枚数と抜け・外れ値の警告を計算します。
 * @returns {Object} { total: 総枚数, breakdown: 内訳オブジェクト, warnings: 警告配列 }
 */
export function calculateDougaCount() {
    let totalCount = 0; 
    let breakdown = {}; 
    let warnings = [];

    state.cellCols.forEach((colName, index) => {
        const displayName = colName || `Col${index+1}`; 
        const gKey = `genga_col${index}`; 
        const dKey = `douga_col${index}`;
        
        let validItems = [];
        let numericVals = []; 

        state.cuts.forEach((cut) => {
            const totalFrames = (cut.durationSec * CONFIG.fps) + cut.durationFrame;
            let gCount = 0; let dCount = 0;
            for(let f=1; f<=totalFrames; f++) {
                if (cut.data[gKey] && cut.data[gKey][f] && cut.data[gKey][f].trim() !== '' && cut.data[gKey][f] !== '/') gCount++;
                if (cut.data[dKey] && cut.data[dKey][f] && cut.data[dKey][f].trim() !== '' && cut.data[dKey][f] !== '/') dCount++;
            }
            const targetKey = dCount >= gCount ? dKey : gKey;
            
            for (let f = 1; f <= totalFrames; f++) {
                let val = cut.data[targetKey]?.[f]?.trim() || '';
                if (val && val !== '/') {
                    let lip = cut.lipData[targetKey]?.[f] || '';
                    validItems.push({ val, lip });
                    let num = parseInt(val, 10);
                    if (!isNaN(num)) numericVals.push(num);
                }
            }
        });

        // 警告判定（抜けと外れ値）
        let uniqueNums = Array.from(new Set(numericVals)).sort((a,b)=>a-b);
        if (uniqueNums.length > 0) {
            let outliers = []; let normalMax = uniqueNums[uniqueNums.length - 1];
            for (let i = 1; i < uniqueNums.length; i++) {
                if (uniqueNums[i] - uniqueNums[i-1] >= 10) { 
                    outliers.push(...uniqueNums.slice(i)); normalMax = uniqueNums[i-1]; break;
                }
            }
            let missing = [];
            for (let i = 1; i <= normalMax; i++) { if (!uniqueNums.includes(i)) missing.push(i); }

            let warnStrs = [];
            if (missing.length > 0) warnStrs.push(`${displayName}${missing.join(',')}が存在しません`);
            if (outliers.length > 0) warnStrs.push(`${displayName}${outliers.join(',')}だけ外れ値です`);
            if (warnStrs.length > 0) warnings.push(warnStrs.join(' / '));
        }

        // カウント処理
        let knownKeys = new Set(); let knownSequences = {}; 
        let currentStartKey = null; let currentInbetweens = []; let colCount = 0;

        validItems.forEach(item => {
            const isKeyPose = (item.val !== '・' && item.val !== '✕');
            if (isKeyPose) {
                if (!knownKeys.has(item.val)) { knownKeys.add(item.val); colCount++; }
                if (currentStartKey !== null) {
                    const endKey = item.val; const numInb = currentInbetweens.length;
                    if (numInb > 0) {
                        const seqKey = `${currentStartKey}_${endKey}_${numInb}`;
                        if (!knownSequences[seqKey]) knownSequences[seqKey] = Array.from({length: numInb}, () => new Set());
                        currentInbetweens.forEach((inb, idx) => {
                            const inbStr = `${inb.val}_${inb.lip}`;
                            if (!knownSequences[seqKey][idx].has(inbStr)) { knownSequences[seqKey][idx].add(inbStr); colCount++; }
                        });
                    }
                } else { colCount += currentInbetweens.length; }
                currentStartKey = item.val; currentInbetweens = [];
            } else { currentInbetweens.push(item); }
        });

        if (currentInbetweens.length > 0) colCount += currentInbetweens.length;
        if (colCount > 0) breakdown[displayName] = colCount;
        totalCount += colCount;
    });

    return { total: totalCount, breakdown: breakdown, warnings: warnings };
}