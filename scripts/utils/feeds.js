/**
 * Events and Scholarships Feed Ingestion for CyberDastak Opportunities
 * Fetches cybersecurity events and student scholarships/fellowships via RSS feeds and curated sources.
 */

const Parser = require('rss-parser');
const parser = new Parser({
  headers: {
    'User-Agent': 'CyberDastak-Opportunities/1.0 (https://github.com/CyberDastak/cyberdastak-opportunities)'
  },
  timeout: 10000
});

// Curated active cybersecurity event feeds & sources
const EVENT_FEEDS = [
  {
    url: 'https://infosec-conferences.com/feed/',
    name: 'Infosec Conferences',
    category: 'Conference'
  }
];

// Evergreen & upcoming verified India/Global cybersecurity events
const CURATED_EVENTS = [
  {
    title: 'c0c0n International Hacking and Cybersecurity Briefing',
    organization: 'Kerala Police & ISRA',
    location: 'Kochi, Kerala, India / Hybrid',
    date: '2026-10-08',
    description: 'One of the oldest and largest cybersecurity and hacking conferences in India, organized by Kerala Police, ISRA, and leading infosec communities.',
    url: 'https://isra.org.in/c0c0n/',
    source: 'curated',
    tags: ['Conference', 'India', 'Hacking', 'Infosec']
  },
  {
    title: 'nullcon Goa Cyber Security Conference & Training',
    organization: 'null Community',
    location: 'Goa, India',
    date: '2026-11-12',
    description: 'Premier security conference in India bringing together corporate, hackers, and researchers to share advanced vulnerabilities, zero-days, and defensive tactics.',
    url: 'https://nullcon.net/',
    source: 'curated',
    tags: ['Conference', 'India', 'Vulnerability Research', 'Defensive']
  },
  {
    title: 'BSides Delhi 2026',
    organization: 'Security BSides Community',
    location: 'New Delhi, India',
    date: '2026-10-24',
    description: 'Community-driven information security conference for hackers, researchers, and students to present security research, workshops, and capture-the-flag competitions.',
    url: 'https://bsidesdelhi.in/',
    source: 'curated',
    tags: ['Conference', 'Delhi', 'Community', 'CTF']
  },
  {
    title: 'OWASP Seasides Information Security Conference',
    organization: 'OWASP Foundation India',
    location: 'Goa, India / Virtual Streams',
    date: '2026-11-05',
    description: 'Annual non-profit open-source application security and cloud security symposium featuring hands-on trainings, village tracks, and student security mentorship.',
    url: 'https://seasides.net/',
    source: 'curated',
    tags: ['AppSec', 'Webinar', 'OWASP', 'Cloud Security']
  },
  {
    title: 'National Cyber Security Scholars Webinar Series',
    organization: 'Data Security Council of India (DSCI)',
    location: 'Online (India)',
    date: '2026-09-28',
    description: 'Monthly interactive knowledge-sharing session on threat intelligence, SOC orchestration, and incident response strategies with leading CISO panelists.',
    url: 'https://www.dsci.in/events',
    source: 'curated',
    tags: ['Webinar', 'SOC', 'DSCI', 'Threat Intelligence']
  },
  {
    title: 'Innefu Cyber Intelligence & AI Summit',
    organization: 'Innefu Labs',
    location: 'Bengaluru, Karnataka, India',
    date: '2026-10-18',
    description: 'Specialized summit on predictive intelligence, open-source intelligence (OSINT), and cyber warfare defence for security professionals in India.',
    url: 'https://www.innefu.com/events',
    source: 'curated',
    tags: ['Summit', 'AI Security', 'Bengaluru', 'OSINT']
  }
];

// Evergreen & upcoming verified India/Global cybersecurity scholarships
const CURATED_SCHOLARSHIPS = [
  {
    title: 'ISC2 Women in Cybersecurity Scholarship',
    organization: 'Center for Cyber Safety and Education / ISC2',
    location: 'India & Global (Online)',
    deadline: '2026-10-15',
    description: 'Provides up to $5,000 for female students pursuing cybersecurity, information assurance, or related computer science degrees in India and globally.',
    url: 'https://www.iamcybersafe.org/s/womens-scholarships',
    source: 'curated',
    tags: ['Women in Cyber', 'Degree Grant', 'Certification']
  },
  {
    title: 'ISC2 Undergraduate & Graduate Cybersecurity Scholarships',
    organization: 'ISC2 Foundation',
    location: 'India & Worldwide',
    deadline: '2026-11-01',
    description: 'Tuition support and exam vouchers up to $5,000 for undergraduate and graduate students pursuing infosec degrees or specialized research.',
    url: 'https://www.iamcybersafe.org/s/undergraduate-scholarships',
    source: 'curated',
    tags: ['Undergraduate', 'Postgraduate', 'Tuition Assistance']
  },
  {
    title: 'SANS Cyber Diversity Academy Scholarship',
    organization: 'SANS Institute',
    location: 'Online (India Eligible)',
    deadline: '2026-10-30',
    description: '100% full tuition scholarship covering GIAC certifications (GSEC, GCIH), hands-on lab training, and direct recruitment pathways into global security roles.',
    url: 'https://www.sans.org/scholarship-academies/',
    source: 'curated',
    tags: ['GIAC Vouchers', 'Hands-on Labs', 'Diversity']
  },
  {
    title: 'Google Generation Scholarship (Asia-Pacific / India)',
    organization: 'Google',
    location: 'India & APAC',
    deadline: '2026-11-20',
    description: 'Award of $2,500 awarded based on academic performance, passion for cybersecurity/computer science, and demonstrated leadership.',
    url: 'https://buildyourfuture.withgoogle.com/scholarships/generation-google-scholarship-apac',
    source: 'curated',
    tags: ['Google', 'APAC', 'Computer Science', 'Diversity']
  },
  {
    title: 'National Cybersecurity Research Fellowship (ISEA)',
    organization: 'Govt. of India (MeitY / ISEA)',
    location: 'India',
    deadline: '2026-12-15',
    description: 'Doctoral and Master research fellowships for Indian scholars working on critical infrastructure protection, malware analysis, and cryptography.',
    url: 'https://www.isea.gov.in/',
    source: 'curated',
    tags: ['Govt of India', 'Fellowship', 'Research', 'MeitY']
  },
  {
    title: 'WiCyS (Women in Cybersecurity) Conference & Travel Grant',
    organization: 'WiCyS Global & India Chapter',
    location: 'India & Hybrid',
    deadline: '2026-11-10',
    description: 'Scholarship covering conference registration, mentoring, and technical workshops for aspiring female cybersecurity students and young professionals.',
    url: 'https://www.wicys.org/scholarships/',
    source: 'curated',
    tags: ['Travel Grant', 'Mentorship', 'Women in Tech']
  }
];

/**
 * Fetches cybersecurity events from RSS feeds and curated channels
 * @returns {Promise<Array>} List of events
 */
async function fetchCybersecurityEvents() {
  const events = [];
  const seenUrls = new Set();

  // 1. Incorporate curated events first
  for (const item of CURATED_EVENTS) {
    if (!seenUrls.has(item.url)) {
      seenUrls.add(item.url);
      events.push({
        id: `event-curated-${Buffer.from(item.url).toString('base64').slice(0, 12)}`,
        ...item
      });
    }
  }

  // 2. Fetch from live RSS feeds
  for (const feedConfig of EVENT_FEEDS) {
    try {
      const feed = await parser.parseURL(feedConfig.url);
      console.log(`[Events] Parsed ${feed.items?.length || 0} items from ${feedConfig.name}`);

      for (const item of feed.items || []) {
        const title = (item.title || '').trim();
        const tLow = title.toLowerCase();

        // Skip non-events (articles, guides, lists)
        if (
          tLow.includes('guide') ||
          tLow.includes('top 5') ||
          tLow.includes('cheatsheet') ||
          tLow.includes('content hub') ||
          tLow.includes('what is')
        ) {
          continue;
        }

        const text = `${title} ${item.contentSnippet || ''}`.toLowerCase();
        const isCyber = (
          text.includes('cyber') ||
          text.includes('security') ||
          text.includes('infosec') ||
          text.includes('summit') ||
          text.includes('conference') ||
          text.includes('expo') ||
          text.includes('hack')
        );

        if (!isCyber || !item.link || seenUrls.has(item.link)) continue;
        seenUrls.add(item.link);

        const isIndia = text.includes('india') || text.includes('delhi') || text.includes('bangalore') || text.includes('mumbai') || text.includes('goa') || text.includes('kochi');

        // If date is in the past, retain if still relevant, or default to current date
        let eventDate = item.isoDate || item.pubDate || new Date().toISOString();

        events.push({
          id: `event-${Buffer.from(item.link).toString('base64').slice(0, 16)}`,
          title: cleanText(title),
          organization: feedConfig.name,
          location: isIndia ? 'India (In-Person / Hybrid)' : (text.includes('virtual') || text.includes('online') ? 'Online' : 'Global / Virtual'),
          date: eventDate,
          description: cleanText(item.contentSnippet || item.content || '').slice(0, 350),
          url: item.link,
          source: 'rss',
          tags: isIndia ? ['Cybersecurity', 'India', feedConfig.category] : ['Cybersecurity', feedConfig.category]
        });
      }
    } catch (err) {
      console.warn(`[Events] Unable to reach feed ${feedConfig.name}: ${err.message}`);
    }
  }

  return events;
}

/**
 * Fetches cybersecurity and tech scholarships
 * @returns {Promise<Array>} List of scholarships
 */
async function fetchScholarships() {
  const scholarships = [];
  const seenUrls = new Set();

  // Incorporate curated scholarships
  for (const item of CURATED_SCHOLARSHIPS) {
    if (!seenUrls.has(item.url)) {
      seenUrls.add(item.url);
      scholarships.push({
        id: `scholarship-curated-${Buffer.from(item.url).toString('base64').slice(0, 12)}`,
        ...item
      });
    }
  }

  return scholarships;
}

function cleanText(str) {
  return (str || '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = {
  fetchCybersecurityEvents,
  fetchScholarships
};
