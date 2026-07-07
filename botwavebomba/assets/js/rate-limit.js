// BOTWAVEBOMBA — Rate-Limit Middleware Stub (Cloudflare Worker / Node fetch handler)
// This is the *spec* for the rate-limit layer. The actual implementation
// runs in the Cloudflare Worker that fronts /api/checkout/* and the
// read paths that the Pro tier gates. Free tier: 5 cluster lookups/day.
// Pro: unlimited. Team: unlimited + 5 seats.
//
// The worker reads STRIPE_WEBHOOK_SECRET from env and refuses unsigned
// webhooks (ISC-5 webhook signature verification — see plan D-5).
//
// This stub documents the contract; deploy happens in the worker.
// For the in-browser fetch, see pro.html and team.html which POST to
// /api/checkout/session. The worker is the source-of-truth for the
// free-tier counter and the Pro unlock.

(function() {
  'use strict';

  var BWB_RATE = {
    FREE_DAILY_LIMIT: 5,

    // In-memory fallback (single-process). Production reads from
    // Cloudflare KV or the SQLite/Postgres substrate.
    _counts: {},

    bucket(userKey) {
      // userKey: ip|email|anonymous. The free tier counts on IP.
      var today = new Date().toISOString().slice(0, 10);
      var k = userKey + ':' + today;
      return k;
    },

    check(userKey) {
      var k = this.bucket(userKey);
      var n = this._counts[k] || 0;
      return {
        used: n,
        limit: this.FREE_DAILY_LIMIT,
        remaining: Math.max(0, this.FREE_DAILY_LIMIT - n),
        blocked: n >= this.FREE_DAILY_LIMIT
      };
    },

    increment(userKey) {
      var k = this.bucket(userKey);
      this._counts[k] = (this._counts[k] || 0) + 1;
    },

    // Tier resolution — the worker reads the Stripe customer ID from the
    // session cookie and looks up the subscription tier. Pro = unlimited.
    // Team = unlimited + per-seat quota. Free = 5/day.
    resolveTier(req) {
      // The cookie name is set by the Stripe webhook handler. The actual
      // session lookup is in the Cloudflare Worker (KV-backed).
      if (req.cookies && req.cookies.bwb_tier) return req.cookies.bwb_tier;
      return 'free';
    }
  };

  window.BWB_RATE = BWB_RATE;
})();
