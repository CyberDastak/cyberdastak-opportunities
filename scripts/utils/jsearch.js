/**
 * JSearch API (RapidAPI / OpenWeb Ninja) Integration for CyberDastak Opportunities
 * Fetches cybersecurity & infosec job listings targeted specifically to India.
 * Strictly verifies posting date presence and enforces <= 15 days age limit.
 */

const axios = require('axios');
const { evaluateIndiaEligibility } = require('./filter-india');

const JSEARCH_QUERIES = [
  'cybersecurity jobs in India',
  'SOC analyst jobs in India',
  'penetration testing internship India',
  'ethical hacker jobs in India',
  'information security engineer India'
];

const MAX_JOB_AGE_DAYS = 15;

/**
 * Fetches jobs from JSearch API
 * @param {Object} options
 * @param {string} options.apiKey - RapidAPI / OpenWeb Ninja API Key
 * @returns {Promise<Array>} Normalized job listings
 */
async function fetchJSearchJobs({ apiKey } = {}) {
  const key = apiKey || process.env.JSEARCH_API_KEY;

  if (!key) {
    console.warn('[JSearch] JSEARCH_API_KEY not set. Skipping JSearch fetch.');
    return [];
  }

  const results = [];
  const seenIds = new Set();
  const now = Date.now();

  for (const query of JSEARCH_QUERIES) {
    try {
      console.log(`[JSearch] Querying: "${query}"`);
      const response = await axios.get('https://jsearch.p.rapidapi.com/search', {
        params: {
          query,
          page: '1',
          num_pages: '1',
          date_posted: 'month',
          country: 'in'
        },
        headers: {
          'X-RapidAPI-Key': key,
          'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
          'User-Agent': 'CyberDastak-Opportunities/1.0'
        },
        timeout: 12000
      });

      const items = response.data?.data || [];
      console.log(`[JSearch] Received ${items.length} items for "${query}"`);

      for (const item of items) {
        const id = item.job_id;
        if (!id || seenIds.has(id)) continue;
        seenIds.add(id);

        // 1. Strict Posting Date Check: Must include a posting date field
        let postedTime = null;
        if (item.job_posted_at_timestamp && !isNaN(Number(item.job_posted_at_timestamp))) {
          postedTime = Number(item.job_posted_at_timestamp) * 1000;
        } else if (item.job_posted_at_datetime_utc) {
          postedTime = new Date(item.job_posted_at_datetime_utc).getTime();
        }

        if (!postedTime || isNaN(postedTime)) {
          console.log(`[JSearch] Discarding job "${item.job_title}" - missing valid posting date field.`);
          continue;
        }

        // 2. Strict Age Check: Only keep jobs posted within last 15 days
        const ageDays = (now - postedTime) / (1000 * 60 * 60 * 24);
        if (ageDays > MAX_JOB_AGE_DAYS) {
          console.log(`[JSearch] Discarding job older than ${MAX_JOB_AGE_DAYS} days: "${item.job_title}" (${ageDays.toFixed(1)} days old).`);
          continue;
        }

        const locationRaw = [item.job_city, item.job_state, item.job_country].filter(Boolean).join(', ');
        const eligibility = evaluateIndiaEligibility({
          title: item.job_title,
          location: locationRaw,
          country: item.job_country,
          description: item.job_description
        });

        // Strictly enforce India criteria
        if (!eligibility.isIndia) {
          continue;
        }

        const isIntern = eligibility.isInternship || (item.job_employment_type || '').toUpperCase() === 'INTERN';
        const isRemote = eligibility.isRemote || Boolean(item.job_is_remote);

        let finalType = 'Full-time';
        if (isIntern) finalType = 'Internship';
        else if ((item.job_employment_type || '').toUpperCase() === 'CONTRACTOR') finalType = 'Contract';
        else if ((item.job_employment_type || '').toUpperCase() === 'PARTTIME') finalType = 'Part-time';

        const tags = ['Cybersecurity'];
        if (isIntern) tags.push('Internship');
        if (isRemote) tags.push('Remote');
        if (query.includes('SOC')) tags.push('SOC Analyst');
        if (query.includes('penetration')) tags.push('VAPT');

        console.log(`[JSearch] Kept job posted ${ageDays.toFixed(1)} days ago: "${item.job_title}"`);

        results.push({
          id: `jsearch-${id}`,
          title: item.job_title,
          organization: item.employer_name || 'Verified Employer',
          location: eligibility.locationText || (isRemote ? 'Remote (India)' : 'India'),
          type: finalType,
          postedDate: new Date(postedTime).toISOString(),
          description: (item.job_description || '').slice(0, 400).trim(),
          url: item.job_apply_link || item.job_google_link || item.job_offer_expiration_datetime_utc,
          source: 'jsearch',
          tags: Array.from(new Set(tags))
        });
      }
    } catch (err) {
      console.error(`[JSearch] Error querying "${query}":`, err.response?.data?.message || err.message);
    }
  }

  return results;
}

module.exports = {
  fetchJSearchJobs,
  MAX_JOB_AGE_DAYS
};
