import { test } from 'node:test';
import assert from 'node:assert/strict';

import { formatNumber, formatMoney } from '../js/format.js';

test('counts below 1000 render as plain integers', () => {
    assert.equal(formatNumber(0), '0');
    assert.equal(formatNumber(42), '42');
    assert.equal(formatNumber(999), '999');
});

test('large counts collapse to compact units', () => {
    assert.equal(formatNumber(1000), '1.00K');
    assert.equal(formatNumber(1234), '1.23K');
    assert.equal(formatNumber(1_500_000), '1.50M');
    assert.equal(formatNumber(2_000_000_000), '2.00B');
});

test('decimal precision shrinks as the scaled value grows', () => {
    assert.equal(formatNumber(12_300), '12.3K');
    assert.equal(formatNumber(123_000), '123K');
});

test('money keeps two decimals below 1000', () => {
    assert.equal(formatMoney(0), '0.00');
    assert.equal(formatMoney(5), '5.00');
    assert.equal(formatMoney(12.5), '12.50');
});

test('money compacts above 1000 like counts', () => {
    assert.equal(formatMoney(1500), '1.50K');
    assert.equal(formatMoney(2_500_000), '2.50M');
});

test('negative and non-finite values are handled', () => {
    assert.equal(formatNumber(-1500), '-1.50K');
    assert.equal(formatNumber(NaN), '0');
    assert.equal(formatMoney(Infinity), '0.00');
});
