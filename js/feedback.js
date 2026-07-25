// A single switch for all player-facing feedback (sound, particles, card
// flashes, ticker messages).
//
// Offline catch-up replays thousands of real production and sale ticks
// through the very same functions the live loop uses — that is what keeps the
// two from drifting apart. Those functions fire sounds and animations, so the
// replay is wrapped in suspendFeedback()/resumeFeedback() to stay silent.

let suspended = 0;

export function suspendFeedback() {
    suspended++;
}

export function resumeFeedback() {
    suspended = Math.max(0, suspended - 1);
}

export function isFeedbackSuspended() {
    return suspended > 0;
}

// Runs `fn` with all feedback muted, restoring the previous state even if it
// throws.
export function withoutFeedback(fn) {
    suspendFeedback();
    try {
        return fn();
    } finally {
        resumeFeedback();
    }
}
