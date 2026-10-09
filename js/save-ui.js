// Save management (export / import, best score) and the away-time payout
// shown when the player comes back. The destructive full reset stays in
// main.js because it shares the new-run sequence there.

import { gameState, bestLocalScore } from './state.js';
import { playSound } from './audio.js';
import { showNewsTicker } from './effects.js';
import { resetBestScore, exportSaveString, importSaveString } from './save.js';
import { calculateOfflineProgress } from './offline.js';
import {
    updateUI, updateAutoSellToggle, openModal, closeModal, setGameplayDisabled,
    snapMoneyDisplay,
} from './ui.js';
import { resetInputCooldowns } from './production.js';
import {
    checkTrophy, renderTrophies, checkAchievements, resetRecordTracking,
} from './achievements.js';
import { startGameLoop, resetLoopTimers } from './game-loop.js';
import { formatInteger, formatDate } from './format.js';

export function resetBestScoreAction() {
    if (!confirm('هل أنت متأكد من إعادة تعيين أفضل النتائج؟')) return;
    resetBestScore();
    resetRecordTracking();
    updateUI();
    showNewsTicker('تمت إعادة تعيين النتائج المحلية.', '🔄', 3500);
    playSound('completion');
}

export function exportBestScore() {
    const { totalSold, money, date } = bestLocalScore;
    const text = `أفضل مبيعات محلية: ${formatInteger(totalSold)} مشبك — المال: $${parseFloat(money || 0).toFixed(2)} — التاريخ: ${date ? formatDate(date) : '—'}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text)
            .then(() => {
                showNewsTicker('تم نسخ النتيجة إلى الحافظة!', '📋', 3500);
                playSound('completion');
            })
            .catch(() => alert(text));
    } else {
        alert(text);
    }
}

export function openSaveModal() {
    openModal('saveModal');
    const textarea = document.getElementById('saveDataTextarea');
    if (textarea) textarea.value = '';
}

export function doExportSave() {
    const encoded = exportSaveString();
    const textarea = document.getElementById('saveDataTextarea');
    if (textarea) textarea.value = encoded;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(encoded)
            .then(() => showNewsTicker('تم نسخ بيانات الحفظ إلى الحافظة!', '📋', 3500))
            .catch(() => showNewsTicker('تم تصدير الحفظ في الصندوق أدناه.', '📋', 3500));
    } else {
        showNewsTicker('تم تصدير الحفظ في الصندوق أدناه.', '📋', 3500);
    }
    playSound('completion');
}

export function doImportSave() {
    const textarea = document.getElementById('saveDataTextarea');
    if (!textarea || !textarea.value.trim()) {
        showNewsTicker('الرجاء لصق بيانات الحفظ أولاً.', '⚠️', 3000);
        return;
    }
    if (!confirm('سيتم استبدال تقدمك الحالي. هل أنت متأكد؟')) return;
    if (importSaveString(textarea.value)) {
        showNewsTicker('تم استيراد الحفظ بنجاح!', '✅', 3500);
        playSound('completion');
        checkTrophy(gameState.lifetimeSold);
        renderTrophies();
        checkAchievements();
        updateAutoSellToggle();
        resetInputCooldowns();
        snapMoneyDisplay();
        // If we were on the game-over screen, the imported save revives play.
        setGameplayDisabled(false);
        closeModal('gameOverModal');
        updateUI();
        closeModal('saveModal');
        startGameLoop();
    } else {
        showNewsTicker('فشل استيراد الحفظ — البيانات غير صالحة.', '❌', 3500);
        playSound('warning');
    }
}

export function showOfflineModal(progress) {
    if (!progress || progress.clipsProduced <= 0) return;
    const modal = document.getElementById('offlineModal');
    if (!modal) return;
    const elapsedMin = Math.floor(progress.elapsedMs / 60000);
    document.getElementById('offlineTimeAway').textContent = elapsedMin >= 60
        ? `${Math.floor(elapsedMin / 60)} ساعة و${elapsedMin % 60} دقيقة`
        : `${elapsedMin} دقيقة`;
    document.getElementById('offlineClipsProduced').textContent = formatInteger(progress.clipsProduced);
    document.getElementById('offlineMoneyEarned').textContent = `$${(progress.moneyEarned || 0).toFixed(2)}`;
    document.getElementById('offlineClipsSold').textContent = formatInteger(progress.clipsSold || 0);
    modal.classList.add('active');
}

// rAF (and thus production) pauses while the tab is hidden. On return, pay
// out the away time through the same offline-progress engine used at load,
// then re-anchor the loop timers so the pause is not seen as one huge tick.
export function setupVisibilityCatchUp() {
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') return;
        const progress = calculateOfflineProgress();
        resetLoopTimers();
        if (progress && progress.clipsProduced > 0) {
            const sold = progress.clipsSold
                ? ` وبيع ${formatInteger(progress.clipsSold)} مشبك`
                : '';
            showNewsTicker(`⏰ أثناء غيابك: إنتاج ${formatInteger(progress.clipsProduced)} مشبك${sold}!`, '🏭', 5000);
            snapMoneyDisplay();
            // Trophies won during the replay were awarded silently.
            renderTrophies();
            checkAchievements();
            updateUI();
        }
    });
}
