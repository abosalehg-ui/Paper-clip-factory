export const STORAGE_KEYS = {
    BEST_SCORE: 'bestLocalScore',
    GAME_STATE: 'paperclipFactorySave',
    // Where an unreadable save is parked instead of being overwritten by the
    // next auto-save, so it can still be recovered by hand.
    GAME_STATE_CORRUPT: 'paperclipFactorySave:corrupt',
    SETTINGS: 'paperclipFactorySettings',
};

export const GAME_CONFIG = {
    INITIAL_WIRE: 1000,
    INITIAL_WIRE_COST: 20,
    INITIAL_PRICE: 0.25,
    INITIAL_DEMAND: 50,
    INITIAL_AUTO_CLIPPER_COST: 5,
    // 1.15 put the 100th machine at ~$5.9M: a simulated optimal run sat at
    // ~75 machines after six hours, so the 100-machine cap was never reached
    // and the expansion upgrade could not do anything. At 1.08 the cap lands
    // after roughly 75 minutes and the first expansion around the two-hour
    // mark, with marketing (demand) still the binding constraint beyond it.
    AUTO_CLIPPER_COST_MULTIPLIER: 1.08,
    WIRE_PURCHASE_AMOUNT: 1000,

    // ---- Wire buyer -----------------------------------------------------
    // Without it wire was the one thing the factory could not do for itself:
    // a purchase lasts ~16s at 60 machines, so "idle" play meant pressing the
    // wire button every few seconds, and eight hours away produced about two
    // minutes of output. The buyer runs on the production tick, so the
    // offline replay (which re-runs that tick) uses it too.
    WIRE_BUYER_COST: 500,
    // Restock when the spool would not cover this many production ticks.
    WIRE_BUYER_BUFFER_TICKS: 3,

    INITIAL_MAX_CLIPS: 5000,
    INITIAL_WAREHOUSE_COST: 100,
    WAREHOUSE_EXPANSION_AMOUNT: 5000,
    WAREHOUSE_COST_MULTIPLIER: 1.5,

    INITIAL_MAX_CLIPPERS: 100,
    INITIAL_EXPANSION_COST: 2000,
    EXPANSION_AMOUNT: 100,
    EXPANSION_COST_MULTIPLIER: 2,

    INSURANCE_BASE_COST: 1000,
    INSURANCE_DURATION_MS: 5 * 60 * 1000,

    EFFICIENCY_BASE_COST: 1000,
    EFFICIENCY_INCREMENT: 0.5,

    MARKETING_BASE_COST: 100,
    MARKETING_DEMAND_BONUS: 20,
    DEMAND_CAP_PER_LEVEL: 100,

    PRODUCTION_TICK_MS: 1000,
    SELL_TICK_MS: 2000,
    EVENT_CHECK_INTERVAL_MS: 3000,

    AUTO_SAVE_INTERVAL_MS: 30000,
    OFFLINE_PROGRESS_CAP_MS: 8 * 60 * 60 * 1000,

    RECORD_THRESHOLD: 1000,

    TROPHY_BRONZE_THRESHOLD: 1000,
    TROPHY_SILVER_THRESHOLD: 10000,
    TROPHY_GOLD_THRESHOLD: 100000,

    PRICE_ADJUST_DELTA: 0.01,
    MIN_PRICE: 0.01,

    // UI render throttle: cap DOM refresh rate independent of rAF (~60fps).
    RENDER_TICK_MS: 50,

    // ---- Price elasticity (the core economic decision) ------------------
    // Demand follows a linear demand curve: at `choke price` nobody buys, at
    // price 0 the whole base demand buys. Revenue = price x demand is then a
    // parabola whose peak sits at exactly choke/2 — a genuine interior
    // optimum, so neither "price as high as possible" nor "as low as
    // possible" wins. Marketing raises the choke price AND the base demand,
    // which is what makes it worth buying.
    PRICE_CHOKE_BASE: 1.0,          // choke price at marketing level 1
    PRICE_CHOKE_GROWTH: 0.15,       // added choke price per marketing level

    // Demand dynamics. Demand is a STOCK, not a rate: it is the number of
    // clips the market will absorb right now. Selling consumes it 1:1 and it
    // regenerates toward the cap on the restore tick, so the sustainable
    // sales rate IS the regeneration rate.
    //
    // The previous model decayed demand by 10% of the amount sold but floored
    // it at 10% of the cap. The floor dominated: every sale was guaranteed
    // 10% of the cap no matter what, so demand sat at its ceiling 66% of the
    // time and constrained a sale in 0.3% of ticks (measured over three
    // simulated hours). The whole decay/restore layer was inert.
    //
    // RESTORE is set so the long-run throughput matches the old effective
    // rate exactly (0.45 of the cap every 3s == 0.15 cap/second), which keeps
    // the progression curve intact while making the dynamics visible: dump a
    // full warehouse and the market needs time to come back.
    // Expressed per SECOND and applied on the production tick. It used to be
    // per-restore-tick and piggybacked on EVENT_CHECK_INTERVAL_MS — the random
    // event cadence, which has nothing to do with the market — so demand
    // refilled in 3-second lumps that the 2-second sell tick swallowed whole,
    // leaving the on-screen demand reading ~1 almost permanently. Accruing
    // every second makes the same long-run rate legible as a gauge.
    DEMAND_DECAY_FRACTION: 1,             // sold clips consume demand 1:1
    DEMAND_FLOOR_FRACTION: 0,             // no free drip; demandFloor() keeps >= 1
    DEMAND_RESTORE_FRACTION_PER_SECOND: 0.15,

    // ---- Selling --------------------------------------------------------
    // A manual sale has a cooldown so hammering the key cannot beat the
    // automation.
    //
    // AUTO_SELL_EFFICIENCY is a PRICE discount, not a cadence discount. A sale
    // clears min(clips, demand) outright, so under a regenerating demand stock
    // the long-run throughput equals the regeneration rate no matter how often
    // anyone sells — cadence and per-sale share both cancel out. The old
    // "emulate the manual cadence at 85%" slot maths could therefore never
    // express "idling is 85% of clicking"; it also floored 4 x 0.85 to 3
    // slots, i.e. 75%, while the README promised 85%. Selling wholesale at 85%
    // of list price says exactly what it means and is what the player sees.
    MANUAL_SELL_COOLDOWN_MS: 500,
    AUTO_SELL_EFFICIENCY: 0.85,

    // ---- Manual production rate ------------------------------------------
    // Selling was rate-limited but making was not, so key auto-repeat (~30/s)
    // handed the player the output of 30 machines from the first second —
    // machines the simulated economy does not reach until minute four. A token
    // bucket caps sustained manual output while still allowing a short burst,
    // and the wire-efficiency upgrade raises the ceiling, which turns the
    // exploit into a progression track.
    // 8/s is above a fast human tapping rate, so real presses never feel
    // swallowed, and far below the ~30/s a held key delivers.
    MANUAL_MAKE_BASE_RATE: 8,            // clips/second at wireEfficiency 1
    MANUAL_MAKE_RATE_PER_EFFICIENCY: 3,  // extra clips/second per +1 efficiency
    MANUAL_MAKE_BURST_SECONDS: 1.5,      // bucket depth, in seconds of output

    // ---- Upgrade cost curves -------------------------------------------
    // Marketing used to be linear (100 x level) while machines were
    // exponential. It bought the binding constraint — sell throughput — at a
    // fraction of what production cost, so it swallowed the whole economy
    // (a broken run reached marketing level 66,000). Exponential pricing puts
    // a practical ceiling on it.
    MARKETING_COST_MULTIPLIER: 1.6,

    // Wire price drifts up with lifetime production, which is what finally
    // gives the wire-efficiency upgrade something to solve.
    WIRE_COST_SCALE: 50000,         // clips produced to double the wire price
    MAX_WIRE_COST_MULTIPLIER: 50,

    // ---- Random events --------------------------------------------------
    // One roll per check; damage is a fraction of what the player owns, so
    // events keep stinging in a late-game economy instead of fading into
    // noise. Insurance now blunts damage rather than cancelling events.
    EVENT_BASE_CHANCE: 0.04,
    INSURANCE_DAMAGE_REDUCTION: 0.7,
    THEFT_WEALTH_FRACTION: 0.05,
    THEFT_MIN_AMOUNT: 50,
    FIRE_CLIP_FRACTION: 0.05,
    FIRE_MIN_CLIP_LOSS: 100,
    CLIPPER_LOSS_FRACTION: 0.03,
    NEGATIVE_PR_DEMAND_FACTOR: 0.5,
    // "You own enough of this to lose some" gates. Deliberately low: the old
    // absolute thresholds let a player dodge every event for free by staying
    // under them.
    MIN_EVENT_MONEY: 200,
    MIN_EVENT_CLIPS: 500,
    MIN_EVENT_CLIPPERS: 5,
    MIN_EVENT_DEMAND: 50,

    // ---- Prestige --------------------------------------------------------
    // The bonus compounds: (1 + BONUS)^points. It used to be additive
    // (1 + 0.05 x points), which decayed against exponential machine costs —
    // the first point was +5% but the twenty-first was +2.5%, so resetting
    // stopped being worth it after roughly ten runs. Compounding at a lower
    // per-point rate is gentler early and still meaningful at point fifty.
    PRESTIGE_REQUIREMENT: 100000,   // lifetime clips sold per prestige point
    PRESTIGE_BONUS_PER_POINT: 0.04, // x1.04 production per point, permanent
    PRESTIGE_MULTIPLIER_CAP: 1e9,   // keeps a hand-edited save from reaching Infinity

    // ---- Save hardening --------------------------------------------------
    // Bumped whenever the meaning of a saved field changes; migrateSave() in
    // state.js upgrades older payloads step by step.
    SAVE_VERSION: 1,
    // Any imported insuranceEndTime further out than this is clamped
    // (protects against clock-skewed or hand-edited saves).
    MAX_INSURANCE_FUTURE_MS: 24 * 60 * 60 * 1000,

    // ---- Input -----------------------------------------------------------
    // Holding a price button accelerates: the repeat delay decays toward the
    // floor so big price moves stop taking a minute and a half.
    PRICE_ADJUST_INTERVAL_MS: 180,
    PRICE_ADJUST_MIN_INTERVAL_MS: 20,
    PRICE_ADJUST_ACCELERATION: 0.82,
};

export const DEFAULT_KEY_BINDINGS = {
    make: ' ',
    sell: 's',
    wire: 'b',
    machine: 'a',
};
