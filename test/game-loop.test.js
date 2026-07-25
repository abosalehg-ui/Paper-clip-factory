import './helpers/dom-stub.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { runFixedSteps } from '../js/game-loop.js';

// The loop was the only module with no test at all, which is exactly where the
// frame-rate-dependence bug lived: `last = currentTime` discarded the
// remainder past the threshold, quantising every logical tick up to the next
// whole frame. A 30fps device therefore produced measurably fewer clips per
// minute than a 60fps one.

function simulate(fps, seconds, interval = 1000) {
    const frame = 1000 / fps;
    let last = 0;
    let ticks = 0;
    for (let now = 0; now <= seconds * 1000; now += frame) {
        last = runFixedSteps(last, interval, now, () => { ticks++; });
    }
    return ticks;
}

test('tick count is independent of frame rate', () => {
    const seconds = 600;
    const expected = seconds;
    for (const fps of [144, 60, 50, 30, 24, 15, 10]) {
        const ticks = simulate(fps, seconds);
        assert.ok(
            Math.abs(ticks - expected) <= 1,
            `at ${fps}fps expected ~${expected} ticks over ${seconds}s, got ${ticks}`,
        );
    }
});

test('the remainder past the threshold is carried, not discarded', () => {
    let ticks = 0;
    // A frame lands 16ms late; the next tick must still be due 1000ms after
    // the *logical* time, not 1000ms after the late frame.
    let last = runFixedSteps(0, 1000, 1016, () => { ticks++; });
    assert.equal(ticks, 1);
    assert.equal(last, 1000, 'timer advances by exactly one interval');

    last = runFixedSteps(last, 1000, 2000, () => { ticks++; });
    assert.equal(ticks, 2);
    assert.equal(last, 2000);
});

test('a single frame can catch up several missed intervals', () => {
    let ticks = 0;
    const last = runFixedSteps(0, 1000, 5000, () => { ticks++; });
    assert.equal(ticks, 5);
    assert.equal(last, 5000);
});

test('a long stall re-anchors instead of grinding through a backlog', () => {
    let ticks = 0;
    // One hour of frozen time must not fire 3600 ticks in a single frame.
    const last = runFixedSteps(0, 1000, 3_600_000, () => { ticks++; });
    assert.ok(ticks <= 10, `expected the catch-up cap to hold, got ${ticks} ticks`);
    assert.equal(last, 3_600_000, 're-anchored to now');
});

test('no tick fires before a full interval has elapsed', () => {
    let ticks = 0;
    const last = runFixedSteps(0, 1000, 999, () => { ticks++; });
    assert.equal(ticks, 0);
    assert.equal(last, 0);
});
