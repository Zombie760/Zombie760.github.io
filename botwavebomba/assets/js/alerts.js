// BOTWAVEBOMBA — Alert subscription client
// Reads alert type catalog from /api/alerts.json, lets the user
// pick types + channels, POSTs the subscription to the worker.
//
// The worker (/api/alerts/subscribe) is the source-of-truth for tier
// resolution (free/pro/team) and rate-limit enforcement. The worker
// also dispatches via the operator's Brevo SMTP relay (send_email_appraisal.py
// pattern) and stores the subscriber record.

(function() {
  'use strict';

  var ALERTS = {
    state: { types: [], channels: [], picked: {} },

    async loadCatalog() {
      try {
        var r = await fetch((window.BWB_BASE || '') + '/api/alerts.json', { cache: 'no-store' });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        this.state = await r.json();
        this.renderTypes();
        this.renderRecentStat();
      } catch (e) {
        this.renderError(e.message);
      }
    },

    renderTypes() {
      var list = document.getElementById('alert-types-list');
      if (!list) return;
      while (list.firstChild) list.removeChild(list.firstChild);
      var self = this;
      (this.state.alert_types || []).forEach(function(t) {
        var li = document.createElement('li');
        li.className = 'alert-type';
        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'alert-type-checkbox';
        cb.id = 'alert-type-' + t.key;
        cb.value = t.key;
        if (t.default_subscribed) cb.checked = true;
        var body = document.createElement('div');
        body.className = 'alert-type-body';
        var lab = document.createElement('div');
        lab.className = 'alert-type-label';
        lab.textContent = t.label;
        var desc = document.createElement('div');
        desc.className = 'alert-type-desc';
        desc.textContent = t.description;
        body.appendChild(lab);
        body.appendChild(desc);
        li.appendChild(cb);
        li.appendChild(body);
        list.appendChild(li);
      });
    },

    async renderRecentStat() {
      var stat = document.getElementById('alerts-stat-count');
      if (!stat) return;
      try {
        var r = await fetch((window.BWB_BASE || '') + '/api/blindspots.json', { cache: 'no-store' });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        var data = await r.json();
        stat.textContent = (data.stories || []).length;
      } catch (e) {
        stat.textContent = '—';
      }
    },

    renderError(msg) {
      var list = document.getElementById('alert-types-list');
      if (!list) return;
      list.innerHTML = '<li class="alert-type" style="color:#BF3B2D">Alert catalog unavailable: ' + msg + '. The free tier at / is fully functional.</li>';
    },

    collectSubscription() {
      var types = [];
      document.querySelectorAll('.alert-type-checkbox:checked').forEach(function(cb) {
        types.push(cb.value);
      });
      var channels = [];
      var email = document.getElementById('alert-email').value.trim();
      var telegram = document.getElementById('alert-telegram').value.trim();
      var slack = document.getElementById('alert-slack').value.trim();
      var discord = document.getElementById('alert-discord').value.trim();
      if (email) channels.push({ type: 'email', value: email });
      if (telegram) channels.push({ type: 'telegram', value: telegram });
      if (slack) channels.push({ type: 'slack_webhook', value: slack });
      if (discord) channels.push({ type: 'discord_webhook', value: discord });
      return { types: types, channels: channels };
    },

    async submit() {
      var sub = this.collectSubscription();
      if (!sub.types.length) {
        alert('Pick at least one alert type.');
        return;
      }
      if (!sub.channels.length) {
        alert('Pick at least one delivery channel (email is the easiest).');
        return;
      }
      try {
        var r = await fetch((window.BWB_BASE || '') + '/api/alerts/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sub),
          credentials: 'include'
        });
        var data = await r.json().catch(function() { return {}; });
        if (r.ok) {
          alert('Subscribed. Check ' + (sub.channels[0].value) + ' for a confirmation ping within 5 minutes.');
        } else {
          alert('Subscribe failed: ' + (data.error || ('HTTP ' + r.status)) + '. Email bombabombardier@gmail.com if this persists.');
        }
      } catch (e) {
        alert('Network error: ' + e.message);
      }
    }
  };

  window.BWB_ALERTS = ALERTS;

  // Bootstrap
  ALERTS.loadCatalog();
  var btn = document.getElementById('alerts-subscribe-btn');
  if (btn) btn.addEventListener('click', function(e) { e.preventDefault(); ALERTS.submit(); });
  var pushBtn = document.getElementById('alert-push-btn');
  if (pushBtn) pushBtn.addEventListener('click', function() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert('Web push not supported in this browser. Use email or Telegram.');
      return;
    }
    navigator.serviceWorker.ready.then(function(reg) {
      return reg.pushManager.subscribe({ userVisibleOnly: true });
    }).then(function(sub) {
      alert('Web push enabled. Subscription captured: ' + sub.endpoint.slice(0, 60) + '…');
    }).catch(function(err) {
      alert('Push subscribe failed: ' + err.message);
    });
  });
})();
