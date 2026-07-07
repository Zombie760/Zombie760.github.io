/**
 * BOTWAVEBOMBA — USA Corruption Tracker
 * Follow the money. Politicians lie. Ledgers don't.
 *
 * Renders BOTH shapes:
 *   v1: api/corruption.json          — flat array of donation rows (CA Governor race, 2025-2026)
 *   v2: api/corruption_v2.json       — { schema_version: 2, tier1_pacs, money_trail }
 *
 * Toggle is automatic: loadCorruptionData() tries v2 first, then v1.
 */

const CORRUPTION_API_V2 = (window.BWB_URL ? window.BWB_URL('api/corruption_v2.json') : '/api/corruption_v2.json');
const CORRUPTION_API_V1 = (window.BWB_URL ? window.BWB_URL('api/corruption.json') : '/api/corruption.json');

async function loadCorruptionData() {
  // Try v2 first (object with schema_version) — v1 is a flat array.
  try {
    const r2 = await fetch(CORRUPTION_API_V2, { cache: 'no-cache' });
    if (r2.ok) {
      const d2 = await r2.json();
      if (d2 && (d2.schema_version === 2 || d2.tier1_pacs || d2.money_trail)) {
        return d2;
      }
    }
  } catch (e) { /* v2 not present, fall through */ }
  try {
    const r1 = await fetch(CORRUPTION_API_V1, { cache: 'no-cache' });
    if (r1.ok) return await r1.json();
  } catch (e) {
    console.warn('Corruption API not available');
  }
  return [];
}

function isV2(data) {
  return data && typeof data === 'object' && !Array.isArray(data) && (data.schema_version === 2 || data.tier1_pacs || data.money_trail);
}

function formatMoney(amount) {
  if (amount >= 1000000) {
    return '$' + (amount / 1000000).toFixed(1) + 'M';
  }
  if (amount >= 1000) {
    return '$' + (amount / 1000).toFixed(0) + 'K';
  }
  return '$' + amount.toLocaleString();
}

function getOfficeBadge(office) {
  const badges = {
    'President': 'PRES',
    'Senate': 'SEN',
    'House': 'HOUSE',
    'Governor': 'GOV',
    'StateLegislature': 'STATE'
  };
  return badges[office] || office;
}

function getDonorTypeBadge(type) {
  const badges = {
    'corporation': 'CORP',
    'pac': 'PAC',
    'superpac': 'SUPER PAC',
    'individual': 'INDIVIDUAL',
    '501c4': 'DARK MONEY'
  };
  return badges[type] || type.toUpperCase();
}

function renderCards(data) {
  const container = document.getElementById('money-trail-feed');
  if (!container) return;

  // Group by recipient for card display
  const byRecipient = {};
  data.forEach(link => {
    const key = `${link.recipient}|${link.recipient_state}|${link.recipient_office}`;
    if (!byRecipient[key]) {
      byRecipient[key] = {
        recipient: link.recipient,
        state: link.recipient_state,
        office: link.recipient_office,
        total: 0,
        donors: []
      };
    }
    byRecipient[key].total += link.amount;
    byRecipient[key].donors.push(link);
  });

  let html = '';
  Object.values(byRecipient).forEach((group, idx) => {
    const officeBadge = getOfficeBadge(group.office);
    const stateCode = group.state;

    html += `
    <article class="bwb-story-card" data-story-id="corruption-${idx}">
      <div class="bwb-story-header">
        <span class="bwb-story-section">${officeBadge} — ${stateCode}</span>
        <span class="bwb-story-flag">${formatMoney(group.total)}</span>
      </div>
      <h2 class="bwb-story-title">${group.recipient}</h2>
      <div class="bwb-donor-list">
    `;

    group.donors.forEach(d => {
      const typeBadge = getDonorTypeBadge(d.donor_type);
      html += `
        <div class="bwb-donor-row">
          <span class="bwb-donor-name">${d.donor}</span>
          <span class="bwb-donor-type">${typeBadge}</span>
          <span class="bwb-donor-amount">${formatMoney(d.amount)}</span>
        </div>
      `;
    });

    html += `
      </div>
      <div class="bwb-story-meta">
        <span class="bwb-story-source">Source: ${group.donors[0].filing_type}</span>
        ${group.donors.some(d => d.flags?.includes('large_donation')) ? '<span class="bwb-story-flag flag-warning">LARGE DONATIONS</span>' : ''}
      </div>
      <div class="bwb-story-actions">
        <a href="${group.donors[0].source_url}" target="_blank" class="bwb-story-btn">View FEC Filing</a>
        <button class="bwb-story-btn btn-outline" onclick="shareTrail('${group.recipient.replace(/'/g, "\\'")}', '${formatMoney(group.total)}', '${officeBadge}', '${stateCode}')">Share</button>
      </div>
    </article>
    `;
  });

  container.innerHTML = html;
}

function renderTable(data) {
  const tbody = document.querySelector('#donor-table tbody');
  if (!tbody) return;

  // Sort by amount descending
  const sorted = [...data].sort((a, b) => b.amount - a.amount);

  let html = '';
  sorted.forEach(link => {
    const officeBadge = getOfficeBadge(link.recipient_office);
    const typeBadge = getDonorTypeBadge(link.donor_type);

    html += `
    <tr>
      <td>${link.donor}</td>
      <td><span class="bwb-badge">${typeBadge}</span></td>
      <td>$${link.amount.toLocaleString()}</td>
      <td>${link.recipient}</td>
      <td><span class="bwb-badge">${officeBadge}</span></td>
      <td>${link.recipient_state}</td>
      <td><a href="${link.source_url}" target="_blank">${link.filing_type}</a></td>
    </tr>
    `;
  });

  tbody.innerHTML = html;
}

function shareTrail(recipient, amount, office, state) {
  const text = `${recipient} (${office}-${state}) received ${amount} in traced donations. Source: FEC filings. #CorruptionTracker #FollowTheMoney`;
  if (navigator.share) {
    navigator.share({ title: 'USA Corruption Tracker', text, url: window.location.href });
  } else {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard');
  }
}

async function init() {
  const data = await loadCorruptionData();

  if (isV2(data)) {
    renderV2(data);
  } else {
    renderCards(data);
    renderTable(data);
    const title = document.querySelector('.bwb-page-title');
    if (title) {
      const totalAmount = data.reduce((sum, d) => sum + d.amount, 0);
      title.textContent = `USA CORRUPTION TRACKER — ${data.length} DONATIONS | $${(totalAmount / 1000000).toFixed(1)}M TRACED`;
    }
  }
}

// =====================================================================
// V2 RENDER PATH — Tier 1 pro-Israel PACs + Donor->Lobbyist->Congress->Agency->Rule->Contract money trail
// =====================================================================

function renderV2(data) {
  renderV2PacGrid(data.tier1_pacs || []);
  renderV2MoneyTrail(data.money_trail || []);
  renderV2Thesis(data);
  const title = document.querySelector('.bwb-page-title');
  if (title) {
    const pacs = (data.tier1_pacs || []).length;
    const trails = (data.money_trail || []).length;
    title.textContent = `USA CORRUPTION TRACKER — ${pacs} PRO-ISRAEL PACs | ${trails} MONEY-TRAIL ROWS`;
  }
}

function renderV2Thesis(data) {
  // Inject thesis + disclaimer above the feed if not already present.
  const container = document.getElementById('money-trail-feed');
  if (!container) return;
  const thesis = data.thesis || '';
  const subDef = data.substrate_definition || '';
  const policy = data.primary_source_policy || '';
  if (!document.getElementById('v2-thesis')) {
    const div = document.createElement('div');
    div.id = 'v2-thesis';
    div.className = 'bwb-trades-explainer';
    div.style.marginBottom = '1.5rem';
    div.innerHTML = `
      <h3 class="bwb-sidebar-title">V2 SUBSTRATE: PRO-ISRAEL PAC MONEY TRAIL</h3>
      <p class="bwb-sidebar-body"><strong>Thesis:</strong> ${escapeHtml(thesis)}</p>
      <p class="bwb-sidebar-body"><strong>Scope:</strong> ${escapeHtml(subDef)}</p>
      <p class="bwb-sidebar-body"><strong>Money trail chain:</strong> Donor &rarr; Lobbyist &rarr; Congress &rarr; Agency &rarr; Rule &rarr; Contract</p>
      <p class="bwb-sidebar-body" style="opacity:.75;font-size:.85rem;"><strong>Primary-source policy:</strong> ${escapeHtml(policy)}</p>
    `;
    container.parentNode.insertBefore(div, container);
  }
}

function renderV2PacGrid(pacs) {
  const container = document.getElementById('money-trail-feed');
  if (!container) return;
  if (!pacs.length) return;

  const grid = document.createElement('div');
  grid.id = 'v2-pac-grid';
  grid.className = 'bwb-feed';
  grid.style.display = 'grid';
  grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(320px, 1fr))';
  grid.style.gap = '1rem';
  grid.style.marginBottom = '2rem';

  pacs.forEach((pac, idx) => {
    const fecId = pac.fec_committee_id || 'no-FEC';
    const fecUrl = pac.fec_url || `https://www.fec.gov/data/committees/?q=${encodeURIComponent(pac.name || pac.short_name || '')}`;
    const opensecrets = pac.opensecrets_url || '#';
    const card = document.createElement('article');
    card.className = 'bwb-story-card';
    card.dataset.pacId = fecId;
    card.innerHTML = `
      <div class="bwb-story-header">
        <span class="bwb-story-section">${escapeHtml(pac.type || 'PAC')}</span>
        <span class="bwb-story-flag">${escapeHtml(pac.hq_state || '')} ${pac.founded ? '&middot; f. ' + escapeHtml(String(pac.founded)) : ''}</span>
      </div>
      <h2 class="bwb-story-title">${escapeHtml(pac.name)}</h2>
      <p class="bwb-sidebar-body" style="font-size:.85rem;opacity:.85;">${escapeHtml(pac.notes || '')}</p>
      <div class="bwb-story-meta">
        <span class="bwb-story-source">FEC: ${escapeHtml(fecId)}</span>
      </div>
      <div class="bwb-story-actions">
        <a href="${escapeAttr(fecUrl)}" target="_blank" rel="noopener" class="bwb-story-btn">FEC Filing</a>
        <a href="${escapeAttr(opensecrets)}" target="_blank" rel="noopener" class="bwb-story-btn btn-outline">OpenSecrets</a>
      </div>
    `;
    grid.appendChild(card);
  });

  // Insert before the existing feed (cards container is the v1 hook; reuse it for v2 too)
  container.parentNode.insertBefore(grid, container);
}

function renderV2MoneyTrail(rows) {
  // Create (or replace) a v2 table element after the existing v1 table container.
  const existingTable = document.getElementById('donor-table');
  if (!existingTable) return;

  let tableContainer = document.getElementById('v2-money-trail-container');
  if (tableContainer) tableContainer.remove();

  tableContainer = document.createElement('div');
  tableContainer.id = 'v2-money-trail-container';
  tableContainer.className = 'bwb-corruption-table-container';
  tableContainer.style.marginTop = '2rem';
  tableContainer.innerHTML = `
    <h3 class="bwb-sidebar-title">MONEY TRAIL: DONOR &rarr; LOBBYIST &rarr; CONGRESS &rarr; AGENCY &rarr; RULE &rarr; CONTRACT</h3>
    <p class="bwb-sidebar-body" style="opacity:.75;font-size:.85rem;">Sortable columns. Click any column header to re-sort. Click any bill/vote URL to open the primary source. <span class="bwb-badge">${rows.length} ROWS</span> <span class="bwb-badge" style="background:#666;">SCAFFOLD &mdash; OPERATOR VERIFIES</span></p>
    <table class="bwb-corruption-table" id="v2-money-trail-table">
      <thead>
        <tr>
          <th data-sort="donor_pac">Donor / PAC</th>
          <th data-sort="donor_amount_to_congress">Amount</th>
          <th data-sort="lobbyist_registrant">Lobbyist / Registrant</th>
          <th data-sort="congress_member">Congress Member</th>
          <th data-sort="bill_or_rule">Bill / Rule</th>
          <th data-sort="vote_url">Roll-call Vote</th>
          <th data-sort="verified">Verified</th>
        </tr>
      </thead>
      <tbody></tbody>
    </table>
  `;
  existingTable.parentNode.parentNode.appendChild(tableContainer);

  const tbody = tableContainer.querySelector('tbody');
  rows.forEach(row => {
    const tr = document.createElement('tr');
    const fecLink = row.donor_pac_fec
      ? ` <a href="https://www.fec.gov/data/committee/${escapeAttr(row.donor_pac_fec)}/" target="_blank" rel="noopener">[FEC]</a>`
      : '';
    const billLink = row.bill_url
      ? `<a href="${escapeAttr(row.bill_url)}" target="_blank" rel="noopener">${escapeHtml(row.bill_or_rule_id || row.bill_or_rule || 'bill')}</a>`
      : escapeHtml(row.bill_or_rule || '');
    const voteLink = row.vote_url
      ? `<a href="${escapeAttr(row.vote_url)}" target="_blank" rel="noopener">${escapeHtml((row.vote_record || 'vote').slice(0, 60))}</a>`
      : escapeHtml(row.vote_record || '');
    const verifiedBadge = row.verified
      ? '<span class="bwb-badge" style="background:#2e7d32;">VERIFIED</span>'
      : '<span class="bwb-badge" style="background:#999;">SCAFFOLD</span>';
    tr.innerHTML = `
      <td>${escapeHtml(row.donor_pac || '')}${fecLink}</td>
      <td>${row.amount ? '$' + Number(row.amount).toLocaleString() : 'TBD'}</td>
      <td>${escapeHtml(row.lobbyist_registrant || row.lobbyist || 'n/a')}</td>
      <td>${escapeHtml(row.congress_member || '')}<br><span style="opacity:.7;font-size:.8em;">${escapeHtml(row.congress_office || '')} &middot; ${escapeHtml(row.congress_state || '')}</span></td>
      <td>${billLink}<br><span style="opacity:.7;font-size:.8em;">${escapeHtml(row.agency || '')}${row.contract_id ? ' &middot; ' + escapeHtml(row.contract_id) : ''}</span></td>
      <td>${voteLink}</td>
      <td>${verifiedBadge}</td>
    `;
    tr.dataset.row = JSON.stringify(row);
    tbody.appendChild(tr);
  });

  // Wire sortable headers
  let sortKey = 'donor_amount_to_congress';
  let sortDir = -1; // desc by default
  tableContainer.querySelectorAll('th[data-sort]').forEach(th => {
    th.style.cursor = 'pointer';
    th.addEventListener('click', () => {
      const k = th.getAttribute('data-sort');
      if (k === sortKey) sortDir = -sortDir; else { sortKey = k; sortDir = (k === 'verified' ? 1 : -1); }
      const sorted = [...rows].sort((a, b) => {
        const av = a[sortKey], bv = b[sortKey];
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * sortDir;
        return String(av).localeCompare(String(bv)) * sortDir;
      });
      const newTbody = tableContainer.querySelector('tbody');
      newTbody.innerHTML = '';
      sorted.forEach(row => {
        const newTr = document.createElement('tr');
        const fecLink = row.donor_pac_fec
          ? ` <a href="https://www.fec.gov/data/committee/${escapeAttr(row.donor_pac_fec)}/" target="_blank" rel="noopener">[FEC]</a>`
          : '';
        const billLink = row.bill_url
          ? `<a href="${escapeAttr(row.bill_url)}" target="_blank" rel="noopener">${escapeHtml(row.bill_or_rule_id || row.bill_or_rule || 'bill')}</a>`
          : escapeHtml(row.bill_or_rule || '');
        const voteLink = row.vote_url
          ? `<a href="${escapeAttr(row.vote_url)}" target="_blank" rel="noopener">${escapeHtml((row.vote_record || 'vote').slice(0, 60))}</a>`
          : escapeHtml(row.vote_record || '');
        const verifiedBadge = row.verified
          ? '<span class="bwb-badge" style="background:#2e7d32;">VERIFIED</span>'
          : '<span class="bwb-badge" style="background:#999;">SCAFFOLD</span>';
        newTr.innerHTML = `
          <td>${escapeHtml(row.donor_pac || '')}${fecLink}</td>
          <td>${row.amount ? '$' + Number(row.amount).toLocaleString() : 'TBD'}</td>
          <td>${escapeHtml(row.lobbyist_registrant || row.lobbyist || 'n/a')}</td>
          <td>${escapeHtml(row.congress_member || '')}<br><span style="opacity:.7;font-size:.8em;">${escapeHtml(row.congress_office || '')} &middot; ${escapeHtml(row.congress_state || '')}</span></td>
          <td>${billLink}<br><span style="opacity:.7;font-size:.8em;">${escapeHtml(row.agency || '')}${row.contract_id ? ' &middot; ' + escapeHtml(row.contract_id) : ''}</span></td>
          <td>${voteLink}</td>
          <td>${verifiedBadge}</td>
        `;
        newTbody.appendChild(newTr);
      });
    });
  });
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }

document.addEventListener('DOMContentLoaded', init);
