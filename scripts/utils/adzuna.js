/**
 * Adzuna India API Integration for CyberDastak Opportunities
 * Fetches cybersecurity jobs from Adzuna's India endpoint.
 * Strictly verifies posting date presence and enforces <= 15 days age limit.
 */

const axios = require('axios');
const { evaluateIndiaEligibility } = require('./filter-india');

const ADZUNA_KEYWORDS = [
  'cybersecurity',
  'SOC analyst',
  'penetration testing',
  'ethical hacking',
  'information security'
];

const MAX_JOB_AGE_DAYS = 15;

/**
 * Fetches India cybersecurity jobs from Adzuna
 * @param {Object} options
 * @param {string} options.appId - Adzuna App ID
 * @param {string} options.appKey - Adzuna App Key
 * @returns {Promise<Array>} Normalized job listings
 */
async function fetchAdzunaJobs({ appId, appKey } = {}) {
  const id = appId || process.env.ADZUNA_APP_ID;
  const key = appKey || process.env.ADZUNA_APP_KEY;

  if (!id || !key) {
    console.warn('[Adzuna] ADZUNA_APP_ID or ADZUNA_APP_KEY not set. Skipping Adzuna API fetch.');
    return [];
  }

  const results = [];
  const seenIds = new Set();
  const now = Date.now();

  for (const keyword of ADZUNA_KEYWORDS) {
    try {
      const url = `https://api.adzuna.com/v1/api/jobs/in/search/1`;
      const response = await axios.get(url, {
        params: {
          app_id: id,
          app_key: key,
          what: keyword,
          results_per_page: 20,
          'content-type': 'application/json'
        },
        timeout: 10000,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'CyberDastak-Opportunities/1.0'
        }
      });

      const items = response.data?.results || [];
      console.log(`[Adzuna] Fetched ${items.length} items for keyword "${keyword}"`);

      for (const item of items) {
        if (!item.id || seenIds.has(item.id)) continue;
        seenIds.add(item.id);

        // 1. Strict Posting Date Check: Must have a created date field
        if (!item.created) {
          console.log(`[Adzuna] Discarding job "${item.title}" - missing posting date field (created).`);
          continue;
        }

        const createdTime = new Date(item.created).getTime();
        if (isNaN(createdTime)) {
          console.log(`[Adzuna] Discarding job "${item.title}" - invalid posting date: "${item.created}".`);
          continue;
        }

        // 2. Strict Age Check: Only keep jobs posted within last 15 days
        const ageDays = (now - createdTime) / (1000 * 60 * 60 * 24);
        if (ageDays > MAX_JOB_AGE_DAYS) {
          console.log(`[Adzuna] Discarding job older than ${MAX_JOB_AGE_DAYS} days: "${item.title}" (${ageDays.toFixed(1)} days old).`);
          continue;
        }

        const locationStr = item.location?.display_name || item.location?.area?.join(', ') || 'India';
        const eligibility = evaluateIndiaEligibility({
          title: item.title,
          location: locationStr,
          country: 'IN', // Adzuna /in/ endpoint is India-specific
          description: item.description
        });

        if (!eligibility.isIndia) {
          continue;
        }

        const tags = ['Cybersecurity', keyword];
        if (eligibility.isInternship) tags.push('Internship');
        if (eligibility.isRemote) tags.push('Remote');

        console.log(`[Adzuna] Kept job posted ${ageDays.toFixed(1)} days ago: "${cleanHtml(item.title)}"`);

        results.push({
          id: `adzuna-${item.id}`,
          title: cleanHtml(item.title),
          organization: item.company?.display_name || 'Verified Employer',
          location: eligibility.locationText,
          type: eligibility.isInternship ? 'Internship' : (item.contract_time === 'part_time' ? 'Part-time' : 'Full-time'),
          postedDate: new Date(createdTime).toISOString(),
          description: cleanHtml(item.description || '').slice(0, 400),
          url: item.redirect_url,
          source: 'adzuna',
          tags: Array.from(new Set(tags))
        });
      }
    } catch (err) {
      console.error(`[Adzuna] Error fetching keyword "${keyword}":`, err.message);
    }
  }

  return results;
}

function cleanHtml(str) {
  return (str || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

module.exports = {
  fetchAdzunaJobs,
  MAX_JOB_AGE_DAYS
};
