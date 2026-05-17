/* facts-loader.js — pulls /facts.json and overwrites every <span data-fact="X">
   on the page with the live value. SSR fallback in HTML means the page still
   reads correctly with JS disabled.

   Every claim on the site is also a click target: the parent element of any
   data-fact span (or any [data-verify-cmd] element) reveals a copy-able shell
   command that lets the reader verify the number on their own machine. */

(async function () {
  const updateFact = (key, value) => {
    document.querySelectorAll(`[data-fact="${key}"]`).forEach((el) => {
      el.textContent = value;
    });
  };

  try {
    const r = await fetch("/facts.json", { cache: "no-store" });
    if (!r.ok) return;
    const f = await r.json();

    // Numeric facts
    for (const k of [
      "services_active",
      "services_failed",
      "timers_active",
      "bomba_sources",
      "books_complete",
      "books_in_progress",
      "books_total_catalog",
      "bounty_confirmed_findings",
      "substrate_receipts",
      "github_commits_30d",
      "monthly_cloud_cost_usd",
    ]) {
      if (k in f) updateFact(k, f[k]);
    }

    // Special: as_of becomes a freshness badge
    if (f.as_of) {
      const stamp = new Date(f.as_of);
      const stale = (Date.now() - stamp.getTime()) / (1000 * 60 * 60); // hours
      document.querySelectorAll("[data-fact=as_of]").forEach((el) => {
        el.textContent = stamp.toISOString().slice(0, 16).replace("T", " ") + "Z";
        if (stale > 25) el.classList.add("stale");
      });
    }
  } catch (e) {
    // Quiet on network failure — SSR values stay visible
  }

  // Verify-it-yourself: click a [data-verify-cmd] element to reveal + copy the command
  document.querySelectorAll("[data-verify-cmd]").forEach((el) => {
    el.style.cursor = "pointer";
    el.title = "Click to copy the verification command";
    el.addEventListener("click", async () => {
      const cmd = el.getAttribute("data-verify-cmd");
      try {
        await navigator.clipboard.writeText(cmd);
        const old = el.textContent;
        el.textContent = "copied: " + cmd;
        setTimeout(() => (el.textContent = old), 2500);
      } catch (_) {
        prompt("Copy this command to verify:", cmd);
      }
    });
  });
})();
