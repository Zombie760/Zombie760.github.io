// BOTWAVEBOMBA — API Layer
// Reads from /botwavebomba/api/*.json (written by broadcast.py every 6h)
// Falls back to demo data if API not yet live

const BWB_API = {
  base: '/botwavebomba/api',
  dataBase: '/botwavebomba/data',

  async getLatest() {
    try {
      const r = await fetch(`${this.base}/latest.json`, { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      console.warn('BWB: live API unavailable, using demo data', e.message);
      return this._demoPayload();
    }
  },

  async getBlindspotsData() {
    try {
      const r = await fetch(`${this.base}/blindspots.json`, { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      return { stories: [] };
    }
  },

  async getSources() {
    const r = await fetch(`${this.dataBase}/source_registry.json`);
    return r.json();
  },

  getStoryParam() {
    return new URLSearchParams(window.location.search).get('id');
  },

  // Demo payload — shows site structure before broadcast.py writes live data
  _demoPayload() {
    return {
      generated_at: new Date().toISOString(),
      story_count: 6,
      stories: [
        {
          id: 'demo-001',
          headline: 'Ceasefire Negotiations Resume — Western and Regional Press Frame Differently',
          summary: 'Western outlets lead with US diplomatic role. IRNA and Al Mayadeen frame the same talks as Iranian strategic success. SCMP focuses on Chinese mediation. Three framings, one event.',
          published: new Date(Date.now() - 3600000).toISOString(),
          is_blindspot: true,
          blindspot_score: 8.2,
          bias_variance: 7.4,
          entity_count: 14,
          sources: [
            { id: 'reuters', name: 'Reuters', bloc: 'western', country: 'GB', headline: 'US mediators press ceasefire as talks resume', url: 'https://reuters.com' },
            { id: 'ap_news', name: 'AP News', bloc: 'western', country: 'US', headline: 'White House says ceasefire framework is close', url: 'https://apnews.com' },
            { id: 'bbc_news', name: 'BBC News', bloc: 'western', country: 'GB', headline: 'Ceasefire talks enter critical phase, diplomats say', url: 'https://bbc.com' },
            { id: 'irna', name: 'IRNA', bloc: 'adversarial', country: 'IR', headline: 'Iran\'s strategic patience yields fruit at negotiating table', url: 'https://irna.ir' },
            { id: 'scmp', name: 'SCMP', bloc: 'neutral', country: 'HK', headline: 'China\'s quiet mediation role emerges as key factor', url: 'https://scmp.com' },
          ]
        },
        {
          id: 'demo-002',
          headline: 'NATO Defense Spending Summit — Coverage Gap Between Alliance and Non-Aligned Press',
          summary: 'Western press frames NATO spending increase as security necessity. Russian and Iranian outlets frame as militarization. Swedish and Indian press offer independent analysis.',
          published: new Date(Date.now() - 7200000).toISOString(),
          is_blindspot: false,
          blindspot_score: 5.1,
          bias_variance: 8.9,
          entity_count: 22,
          sources: [
            { id: 'ft', name: 'Financial Times', bloc: 'western', country: 'GB', headline: 'NATO allies agree record defense spending commitments', url: 'https://ft.com' },
            { id: 'nytimes', name: 'New York Times', bloc: 'western', country: 'US', headline: 'Europe\'s defense buildup accelerates as threat grows', url: 'https://nytimes.com' },
            { id: 'rt', name: 'RT', bloc: 'adversarial', country: 'RU', headline: 'NATO\'s arms race signals end of European diplomacy', url: 'https://rt.com' },
            { id: 'sputnik', name: 'Sputnik', bloc: 'adversarial', country: 'RU', headline: 'Western militarization reaches Cold War levels', url: 'https://sputniknews.com' },
            { id: 'hindu', name: 'The Hindu', bloc: 'neutral', country: 'IN', headline: 'India watches NATO expansion with strategic concern', url: 'https://thehindu.com' },
            { id: 'dn_nyheter', name: 'DN Nyheter', bloc: 'neutral', country: 'SE', headline: 'Sweden\'s NATO membership changes security calculus', url: 'https://dn.se' },
          ]
        },
        {
          id: 'demo-003',
          headline: 'IMF Debt Restructuring Proposal — Southern Hemisphere Coverage Absent in Western Press',
          summary: 'A story covered in depth by SCMP, The Hindu, and Telex HU — virtually absent from AP, Reuters, and BBC front pages. The Global South debt crisis is a Western blindspot.',
          published: new Date(Date.now() - 10800000).toISOString(),
          is_blindspot: true,
          blindspot_score: 9.1,
          bias_variance: 6.2,
          entity_count: 8,
          sources: [
            { id: 'scmp', name: 'SCMP', bloc: 'neutral', country: 'HK', headline: 'IMF debt terms hit Africa hardest, new analysis shows', url: 'https://scmp.com' },
            { id: 'hindu', name: 'The Hindu', bloc: 'neutral', country: 'IN', headline: 'Global South demands IMF reform at annual summit', url: 'https://thehindu.com' },
            { id: 'rt', name: 'RT', bloc: 'adversarial', country: 'RU', headline: 'Western financial institutions weaponize debt', url: 'https://rt.com' },
          ]
        },
        {
          id: 'demo-004',
          headline: 'AI Regulation Debate — Five Different National Framings on the Same Technology',
          summary: 'US press frames AI regulation as innovation threat. EU press as rights necessity. Chinese press as sovereignty issue. Russian press as geopolitical contest. Indian press as development opportunity.',
          published: new Date(Date.now() - 14400000).toISOString(),
          is_blindspot: false,
          blindspot_score: 2.3,
          bias_variance: 9.4,
          entity_count: 31,
          sources: [
            { id: 'wired', name: 'Wired', bloc: 'western', country: 'US', headline: 'America\'s AI regulation gap is a competitive risk', url: 'https://wired.com' },
            { id: 'ft', name: 'Financial Times', bloc: 'western', country: 'GB', headline: 'EU AI Act sets global standard, industry warns of costs', url: 'https://ft.com' },
            { id: 'sixth_tone', name: 'Sixth Tone', bloc: 'neutral', country: 'CN', headline: 'China\'s AI governance model emphasizes state oversight', url: 'https://sixthtone.com' },
            { id: 'rt', name: 'RT', bloc: 'adversarial', country: 'RU', headline: 'Western AI dominance a new front in tech war', url: 'https://rt.com' },
            { id: 'hindu', name: 'The Hindu', bloc: 'neutral', country: 'IN', headline: 'India seeks sovereign AI stack to avoid dependency', url: 'https://thehindu.com' },
          ]
        },
        {
          id: 'demo-005',
          headline: 'Energy Pipeline Deal — Framing Splits on Economic vs Geopolitical Lens',
          summary: 'Financial press frames new pipeline deal as market development. Adversarial press frames as sovereignty play. Non-aligned press leads with energy security for smaller nations.',
          published: new Date(Date.now() - 18000000).toISOString(),
          is_blindspot: false,
          blindspot_score: 4.7,
          bias_variance: 5.8,
          entity_count: 17,
          sources: [
            { id: 'reuters', name: 'Reuters', bloc: 'western', country: 'GB', headline: 'New pipeline deal reshapes European energy market', url: 'https://reuters.com' },
            { id: 'tass', name: 'TASS', bloc: 'adversarial', country: 'RU', headline: 'Russia demonstrates energy independence from Western pressure', url: 'https://tass.com' },
            { id: 'telex_hu', name: 'Telex HU', bloc: 'neutral', country: 'HU', headline: 'Central Europe\'s energy calculus shifts with new deal', url: 'https://telex.hu' },
          ]
        },
        {
          id: 'demo-006',
          headline: 'War Crimes Tribunal — Adversarial Press Buries Story Western Press Leads On',
          summary: 'An adversarial blindspot: Western, EU, and non-aligned press cover the tribunal extensively. RT and Sputnik minimize or reframe. The omission pattern is the evidence.',
          published: new Date(Date.now() - 21600000).toISOString(),
          is_blindspot: true,
          blindspot_score: 7.8,
          bias_variance: 8.1,
          entity_count: 26,
          sources: [
            { id: 'guardian', name: 'The Guardian', bloc: 'western', country: 'GB', headline: 'ICC indictment marks turning point in accountability', url: 'https://theguardian.com' },
            { id: 'nytimes', name: 'New York Times', bloc: 'western', country: 'US', headline: 'International tribunal names senior commanders in charges', url: 'https://nytimes.com' },
            { id: 'bbc_news', name: 'BBC News', bloc: 'western', country: 'GB', headline: 'War crimes charges filed — what happens next', url: 'https://bbc.com' },
            { id: 'rt', name: 'RT', bloc: 'adversarial', country: 'RU', headline: 'Western-controlled court targets political opponents', url: 'https://rt.com' },
            { id: 'scmp', name: 'SCMP', bloc: 'neutral', country: 'HK', headline: 'Tribunal credibility questioned by non-Western jurists', url: 'https://scmp.com' },
          ]
        }
      ]
    };
  }
};

window.BWB_API = BWB_API;
