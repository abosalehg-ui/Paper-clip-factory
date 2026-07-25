export const STORAGE_KEYS = {
    BEST_SCORE: 'bestLocalScore',
    GAME_STATE: 'paperclipFactorySave',
    SETTINGS: 'paperclipFactorySettings',
};

export const GAME_CONFIG = {
    INITIAL_WIRE: 1000,
    INITIAL_WIRE_COST: 20,
    INITIAL_PRICE: 0.25,
    INITIAL_DEMAND: 50,
    INITIAL_AUTO_CLIPPER_COST: 5,
    AUTO_CLIPPER_COST_MULTIPLIER: 1.15,
    WIRE_PURCHASE_AMOUNT: 1000,

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
    PRICE_DEMAND_STEP: 5,           // demand nudge per +/- price button press

    // Demand dynamics, expressed as fractions of the effective cap so they
    // stay meaningful at every scale instead of going irrelevant late-game.
    DEMAND_DECAY_FRACTION: 0.1,     // demand lost per clip sold
    DEMAND_FLOOR_FRACTION: 0.1,     // demand never drops below this x cap
    DEMAND_RESTORE_FRACTION: 0.15,  // demand regained per restore tick

    // ---- Selling --------------------------------------------------------
    // A manual sale has a cooldown so hammering the key cannot beat the
    // automation. The auto-seller emulates the same cadence at a slight
    // discount, so idling is *almost* as good as clicking — the correct
    // shape for an idle game.
    MANUAL_SELL_COOLDOWN_MS: 500,
    AUTO_SELL_EFFICIENCY: 0.85,

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
    PRESTIGE_REQUIREMENT: 100000,   // lifetime clips sold per prestige point
    PRESTIGE_BONUS_PER_POINT: 0.05, // +5% production per point, permanent

    // ---- Save hardening --------------------------------------------------
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
