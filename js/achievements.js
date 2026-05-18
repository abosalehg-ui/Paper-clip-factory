import { GAME_CONFIG } from './config.js';
import { gameState, bestLocalScore } from './state.js';
import { playSound } from './audio.js';
import { showNewsTicker, flash } from './effects.js';
import { saveBestScore } from './save.js';

let trophyElements = null;

function getTrophyElements() {
    if (!trophyElements) {
        trophyElements = {
            bronze: document.getElementById('trophyBronzeIcon'),
            silver: document.getElementById('trophySilverIcon'),
            gold: document.getElementById('trophyGoldIcon'),
        };
    }
    return trophyElements;
}

export function checkTrophy(newTotalSold) {
    const body = document.body;
    const trophies = getTrophyElements();

    trophies.bronze.style.display = 'none';
    trophies.silver.style.display = 'none';
    trophies.gold.style.display = 'none';
    body.classList.remove('trophy-bronze', 'trophy-silver', 'trophy-gold');

    if (!gameState.trophyBronze && newTotalSold >= GAME_CONFIG.TROPHY_BRONZE_THRESHOLD) {
        gameState.trophyBronze = true;
        playSound('trophy');
        showNewsTicker('🏆 إنجاز جديد: البرونزي (1,000 مشبك مُباع)!', '🌟');
    }
    if (gameState.trophyBronze && newTotalSold < GAME_CONFIG.TROPHY_SILVER_THRESHOLD) {
        body.classList.add('trophy-bronze');
        trophies.bronze.style.display = 'flex';
    }

    if (!gameState.trophySilver && newTotalSold >= GAME_CONFIG.TROPHY_SILVER_THRESHOLD) {
        gameState.trophySilver = true;
        body.classList.remove('trophy-bronze');
        trophies.bronze.style.display = 'none';
        playSound('trophy');
        showNewsTicker('🏆 إنجاز جديد: الفضي (10,000 مشبك مُباع)!', '✨');
    }
    if (gameState.trophySilver && newTotalSold < GAME_CONFIG.TROPHY_GOLD_THRESHOLD) {
        body.classList.add('trophy-silver');
        trophies.silver.style.display = 'flex';
    }

    if (!gameState.trophyGold && newTotalSold >= GAME_CONFIG.TROPHY_GOLD_THRESHOLD) {
        gameState.trophyGold = true;
        body.classList.remove('trophy-silver');
        trophies.silver.style.display = 'none';
        playSound('trophy');
        showNewsTicker('🏆 إنجاز جديد: الذهبي (100,000 مشبك مُباع)! تهانينا!', '🌟');
    }
    if (gameState.trophyGold) {
        body.classList.add('trophy-gold');
        trophies.gold.style.display = 'flex';
    }
}

export function checkLocalRecord() {
    const previousBest = bestLocalScore.totalSold || 0;
    if (gameState.totalSold > previousBest + GAME_CONFIG.RECORD_THRESHOLD) {
        bestLocalScore.totalSold = gameState.totalSold;
        bestLocalScore.money = parseFloat(gameState.money.toFixed(2));
        bestLocalScore.date = new Date().toISOString();
        saveBestScore();

        showNewsTicker('🎉 رقم قياسي جديد! تم تحطيم أفضل مبيعاتك السابقة!', '🏅', 3500);
        playSound('completion');
        flash('card-clips');
        flash('card-money');
    }
}
