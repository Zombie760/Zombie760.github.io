/**
 * BOTWAVEBOMBA — USA Corruption Tracker
 * Follow the money. Politicians lie. Ledgers don't.
 */

const CORRUPTION_API = '/botwavebomba/api/corruption.json';

async function loadCorruptionData() {
  try {
    const resp = await fetch(CORRUPTION_API, { cache: 'no-cache' });
    if (resp.ok) return await resp.json();
  } catch (e) {
    console.warn('Corruption API not available');
  }
  return [];
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
  renderCards(data);
  renderTable(data);

  // Update page title with count
  const title = document.querySelector('.bwb-page-title');
  if (title) {
    const totalAmount = data.reduce((sum, d) => sum + d.amount, 0);
    title.textContent = `USA CORRUPTION TRACKER — ${data.length} DONATIONS | $${(totalAmount / 1000000).toFixed(1)}M TRACED`;
  }
}

document.addEventListener('DOMContentLoaded', init);
