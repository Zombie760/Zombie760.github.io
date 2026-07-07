/**
 * BOTWAVEBOMBA — Money Trail Flow Renderer (v2)
 * Loads api/corruption_v2.json and renders the 20 money_trail rows
 * as expandable flow lines: Donor PAC -> Lobbyist -> Congress -> Bill -> Vote.
 * Color codes by verified field. No external libs.
 * Byline: Kyle Jimenez. No Al Gringo / no gringo1904 byline.
 */
(function () {
  'use strict';
  var MONEY_TRAIL_URL = (window.BWB_URL ? window.BWB_URL('api/corruption_v2.json') : '/api/corruption_v2.json');

  function fmtMoney(n) {
    if (n == null) return '—';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K';
    return '$' + Number(n).toLocaleString();
  }
  function safeUrl(u) { return (u && typeof u === 'string' && /^https?:\/\//.test(u)) ? u : null; }
  function linkOrText(url, label) {
    var s = safeUrl(url);
    return s ? '<a href="' + s + '" target="_blank" rel="noopener noreferrer">' + (label || s) + '</a>' : '<span class="mt-missing">' + (label || '—') + '</span>';
  }
  function vc(r) { return r.verified === true ? 'mt-verified-green' : (r.verified === 'pending' ? 'mt-verified-yellow' : 'mt-verified-red'); }
  function vl(r) { return r.verified === true ? 'VERIFIED' : (r.verified === 'pending' ? 'PENDING' : 'UNVERIFIED'); }

  function buildFlow(row) {
    var donor = '<a href="https://www.fec.gov/data/committee/' + (row.donor_pac_fec || '') + '/" target="_blank" rel="noopener noreferrer" class="mt-node mt-node-pac">' +
      '<span class="mt-node-label">' + row.donor_pac + '</span><span class="mt-node-sub">FEC ' + (row.donor_pac_fec || '—') + '</span></a>';
    var lobby = '<span class="mt-node mt-node-lobby"><span class="mt-node-label">' + row.lobbyist + '</span><span class="mt-node-sub">registrant: ' + (row.lobbyist_registrant || '—') + '</span></span>';
    var cong = '<span class="mt-node mt-node-congress"><span class="mt-node-label">' + row.congress_member + '</span><span class="mt-node-sub">' + row.congress_office + ' / ' + row.congress_state + '</span></span>';
    var bill = '<a href="' + (safeUrl(row.bill_url) || '#') + '" target="_blank" rel="noopener noreferrer" class="mt-node mt-node-bill"><span class="mt-node-label">' + (row.bill_or_rule_id || 'bill') + '</span><span class="mt-node-sub">' + (row.agency || '—') + '</span></a>';
    var vote = '<a href="' + (safeUrl(row.vote_url) || '#') + '" target="_blank" rel="noopener noreferrer" class="mt-node mt-node-vote"><span class="mt-node-label">VOTE</span><span class="mt-node-sub">' + (row.vote_record || '—') + '</span></a>';
    return donor + '<span class="mt-arrow">▶</span>' + lobby + '<span class="mt-arrow">▶</span>' + cong + '<span class="mt-arrow">▶</span>' + bill + '<span class="mt-arrow">▶</span>' + vote;
  }

  function buildDetail(row) {
    return '<table class="mt-detail-table">' +
      '<tr><th>Donor PAC</th><td>' + (row.donor_pac || '—') + ' (FEC ' + (row.donor_pac_fec || '—') + ')</td></tr>' +
      '<tr><th>Amount</th><td>' + fmtMoney(row.amount) + ' <span class="mt-warn-illust">(illustrative — pending operator verify)</span></td></tr>' +
      '<tr><th>Amount basis</th><td>' + (row.donor_amount_basis || '—') + '</td></tr>' +
      '<tr><th>Lobbyist</th><td>' + (row.lobbyist || '—') + '<br>Registrant: ' + (row.lobbyist_registrant || '—') + '<br>' + linkOrText(row.lobbying_disclosure_url, 'Senate LDA filing') + '</td></tr>' +
      '<tr><th>Congress member</th><td>' + (row.congress_member || '—') + ' (' + (row.congress_office || '—') + ', ' + (row.congress_state || '—') + ')</td></tr>' +
      '<tr><th>Bill / Rule</th><td>' + (row.bill_or_rule || '—') + '<br>ID: ' + (row.bill_or_rule_id || '—') + '<br>' + linkOrText(row.bill_url, row.bill_or_rule_id || 'bill') + '</td></tr>' +
      '<tr><th>Agency</th><td>' + (row.agency || '—') + '</td></tr>' +
      '<tr><th>Contract</th><td>' + (row.contract_id || '—') + '</td></tr>' +
      '<tr><th>Vote record</th><td>' + (row.vote_record || '—') + '<br>' + linkOrText(row.vote_url, 'roll call') + '</td></tr>' +
      '<tr><th>Primary source</th><td>' + (row.primary_source || '—') + '</td></tr>' +
      '<tr><th>Provenance note</th><td>' + (row.provenance_note || '—') + '</td></tr>' +
      '</table>';
  }

  function render(data) {
    var rows = (data && data.money_trail) || [];
    var pacs = (data && data.tier1_pacs) || [];
    var stats = document.getElementById('mt-stats');
    var v = 0; for (var i = 0; i < rows.length; i++) if (rows[i].verified === true) v++;
    if (stats) stats.innerHTML = '<span class="mt-stat"><b>' + pacs.length + '</b> Tier-1 PACs</span><span class="mt-stat"><b>' + rows.length + '</b> money_trail rows</span><span class="mt-stat mt-stat-green"><b>' + v + '</b> verified</span><span class="mt-stat mt-stat-red"><b>' + (rows.length - v) + '</b> unverified</span>';

    var grid = document.getElementById('mt-pac-grid');
    if (grid) {
      var gh = '';
      for (var p = 0; p < pacs.length; p++) {
        var pc = pacs[p];
        gh += '<div class="mt-pac-card"><div class="mt-pac-name">' + pc.name + '</div><div class="mt-pac-meta">' + (pc.type || '—') + ' · HQ: ' + (pc.hq_state || '—') + ' · ' + (pc.founded || '—') + '</div><div class="mt-pac-links">' + linkOrText(pc.fec_url, 'FEC') + ' · ' + linkOrText(pc.opensecrets_url, 'OpenSecrets') + '</div><div class="mt-pac-notes">' + (pc.notes || '') + '</div></div>';
      }
      grid.innerHTML = gh || '<div class="mt-empty">No tier1_pacs.</div>';
    }

    var cont = document.getElementById('mt-rows');
    if (!cont) return;
    if (!rows.length) { cont.innerHTML = '<div class="mt-empty">No money_trail rows.</div>'; return; }
    var h = '';
    for (var j = 0; j < rows.length; j++) {
      var r = rows[j];
      h += '<div class="mt-row ' + vc(r) + '" data-trail-id="' + r.trail_id + '"><div class="mt-row-head"><span class="mt-id">' + r.trail_id + '</span><span class="mt-amount">' + fmtMoney(r.amount) + '</span><span class="mt-status">' + vl(r) + '</span><button class="mt-toggle" aria-expanded="false">EXPAND</button></div><div class="mt-flow">' + buildFlow(r) + '</div><div class="mt-detail" hidden>' + buildDetail(r) + '</div></div>';
    }
    cont.innerHTML = h;
    var btns = cont.querySelectorAll('.mt-toggle');
    for (var k = 0; k < btns.length; k++) {
      btns[k].addEventListener('click', (function (btn) {
        return function () {
          var row = btn.closest('.mt-row');
          if (!row) return;
          var det = row.querySelector('.mt-detail');
          if (!det) return;
          if (det.hasAttribute('hidden')) { det.removeAttribute('hidden'); btn.textContent = 'COLLAPSE'; btn.setAttribute('aria-expanded', 'true'); }
          else { det.setAttribute('hidden', ''); btn.textContent = 'EXPAND'; btn.setAttribute('aria-expanded', 'false'); }
        };
      })(btns[k]));
    }
  }

  async function init() {
    try {
      var r = await fetch(MONEY_TRAIL_URL, { cache: 'no-cache' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      var data = await r.json();
      if (!data || data.schema_version !== 2) throw new Error('schema_version !== 2');
      render(data);
    } catch (e) {
      var b = document.getElementById('mt-banner-error');
      if (b) { b.textContent = 'Failed to load corruption_v2.json: ' + e.message; b.style.display = 'block'; }
      console.error('[money-trail] init failed', e);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
