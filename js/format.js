// Compact number formatting for idle-game scale values.
// Counts below 1000 render as plain integers ("999"), money below 1000 keeps
// two decimals ("12.50"); larger magnitudes collapse to "1.2K" / "3.4M" / "5B".

const UNITS = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp'];

// Pinned locales. A bare toLocaleString() follows the device language, so on
// an Arabic-locale browser counts below 1000 rendered as Arabic-Indic digits
// ("٩٩٩") while everything else — "1.00K", money, toFixed() — stayed Latin,
// and a number changed script mid-game as it crossed 1000. Every number on
// screen now uses Latin digits; dates keep Arabic month names with Latin
// digits to match.
const INTEGER_FORMAT = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const DATE_FORMAT = new Intl.DateTimeFormat('ar-u-nu-latn', {
    dateStyle: 'medium',
    timeStyle: 'short',
});

// Full-precision integer with thousands separators ("12,345").
export function formatInteger(value) {
    const n = Number(value);
    return INTEGER_FORMAT.format(Number.isFinite(n) ? Math.floor(n) : 0);
}

export function formatDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : DATE_FORMAT.format(date);
}

export function formatNumber(value, { money = false } = {}) {
    const n = Number(value);
    if (!Number.isFinite(n)) return money ? '0.00' : '0';

    const sign = n < 0 ? '-' : '';
    const abs = Math.abs(n);

    if (abs < 1000) {
        return sign + (money ? abs.toFixed(2) : formatInteger(abs));
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
