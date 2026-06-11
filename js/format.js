// Compact number formatting for idle-game scale values.
// Counts below 1000 render as plain integers ("999"), money below 1000 keeps
// two decimals ("12.50"); larger magnitudes collapse to "1.2K" / "3.4M" / "5B".

const UNITS = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp'];

export function formatNumber(value, { money = false } = {}) {
    const n = Number(value);
    if (!Number.isFinite(n)) return money ? '0.00' : '0';

    const sign = n < 0 ? '-' : '';
    const abs = Math.abs(n);

    if (abs < 1000) {
        return sign + (money ? abs.toFixed(2) : Math.floor(abs).toLocaleString());
    }

    let tier = Math.floor(Math.log10(abs) / 3);
    if (tier >= UNITS.length) tier = UNITS.length - 1;

    const scaled = abs / Math.pow(1000, tier);
    const decimals = scaled < 10 ? 2 : scaled < 100 ? 1 : 0;
    return sign + scaled.toFixed(decimals) + UNITS[tier];
}

export function formatMoney(value) {
    return formatNumber(value, { money: true });
}
