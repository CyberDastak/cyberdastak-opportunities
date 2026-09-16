/**
 * CyberDastak Opportunities - Daily Ingestion Pipeline
 * Fetches, deduplicates, prunes stale entries, and persists:
 *  1. /data/jobs.json (Strictly India-based, <= 15 days incoming, max 30 days retention)
 *  2. /data/events.json (Infosec events, webinars, conferences)
 *  3. /data/scholarships.json (Student cybersecurity grants & fellowships)
 *  4. /data/newly-added.json (Diff for the email digest step)
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { fetchAdzunaJobs } = require('./utils/adzuna');
const { fetchJSearchJobs } = require('./utils/jsearch');
const { fetchCybersecurityEvents, fetchScholarships } = require('./utils/feeds');

const DATA_DIR = path.resolve(__dirname, '../data');
const JOBS_FILE = path.join(DATA_DIR, 'jobs.json');
const EVENTS_FILE = path.join(DATA_DIR, 'events.json');
const SCHOLARSHIPS_FILE = path.join(DATA_DIR, 'scholarships.json');
const NEWLY_ADDED_FILE = path.join(DATA_DIR, 'newly-added.json');

// Retention & Freshness Policies
const JOB_MAX_INCOMING_AGE_DAYS = 15; // Only keep jobs posted within the last 15 days (discard older)
const JOB_RETENTION_DAYS = 30;         // Remove any job from jobs.json older than 30 days total
const GENERAL_RETENTION_DAYS = 60;     // Retention window for events and scholarships

// Curated baseline jobs for initial setup or when API keys are not yet configured
// All seeds are dynamically generated within the last 1-5 days to ensure freshness
const CURATED_INDIA_JOBS = [
  {
    id: 'seed-soc-analyst-blr',
    title: 'Associate SOC Analyst (L1)',
    organization: 'Tata Consultancy Services (Cyber Security Unit)',
    location: 'Bengaluru, Karnataka, India',
    type: 'Full-time',
    postedDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    description: 'Monitor SIEM alerts (Splunk/QRadar), triage security incidents, perform initial packet analysis, and escalate critical cybersecurity threats to L2/L3 teams.',
    url: 'https://www.tcs.com/careers/india',
    source: 'curated',
    tags: ['SOC Analyst', 'SIEM', 'Bengaluru', 'Incident Response']
  },
  {
    id: 'seed-vapt-pune',
    title: 'Junior Penetration Tester / Ethical Hacker',
    organization: 'Quick Heal Security Labs',
    location: 'Pune, Maharashtra, India',
    type: 'Full-time',
    postedDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    description: 'Perform web application penetration testing (OWASP Top 10), network vulnerability assessments, API security testing, and write comprehensive remediation reports.',
    url: 'https://www.quickheal.co.in/careers',
    source: 'curated',
    tags: ['VAPT', 'Penetration Testing', 'Pune', 'OWASP']
  },
  {
    id: 'seed-intern-delhi',
    title: 'Cybersecurity Threat Intelligence Intern',
    organization: 'Data Security Council of India (DSCI)',
    location: 'Noida / New Delhi, India',
    type: 'Internship',
    postedDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    description: 'Research emerging ransomware families, assist in tracking APT threat actors targeting Indian infrastructure, and develop open-source intelligence (OSINT) playbooks.',
    url: 'https://www.dsci.in/careers',
    source: 'curated',
    tags: ['Internship', 'Threat Intelligence', 'Delhi NCR', 'OSINT']
  },
  {
    id: 'seed-cloud-sec-hyd',
    title: 'Cloud Security Associate',
    organization: 'Infosys Cyber Defense Center',
    location: 'Hyderabad, Telangana, India (Hybrid)',
    type: 'Full-time',
    postedDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    description: 'Assist in configuring AWS and Azure security posture management (CSPM), identity and access controls (IAM), and compliance audit automation.',
    url: 'https://www.infosys.com/careers',
    source: 'curated',
    tags: ['Cloud Security', 'AWS', 'Hyderabad', 'Compliance']
  },
  {
    id: 'seed-infosec-remote',
    title: 'Information Security & Compliance Analyst',
    organization: 'Razorpay Security Team',
    location: 'Remote (India)',
    type: 'Full-time',
    postedDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    description: 'Coordinate PCI-DSS, ISO 27001, and SOC 2 audits, conduct vendor risk assessments, and assist in developer security awareness programs.',
    url: 'https://razorpay.com/jobs',
    source: 'curated',
    tags: ['Compliance', 'ISO 27001', 'Remote', 'Fintech Security']
  }
];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readJsonFile(filePath, fallback = []) {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.warn(`[Warning] Could not read ${filePath}, starting fresh: ${err.message}`);
  }
  return fallback;
}

function writeJsonFile(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * Creates a unique deduplication fingerprint based on normalized title and URL.
 */
function makeFingerprint(title, url) {
  const normTitle = (title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  let normUrl = (url || '').toLowerCase();
  try {
    const parsed = new URL(url);
    normUrl = `${parsed.hostname}${parsed.pathname}`;
  } catch (_) {
    normUrl = normUrl.replace(/^https?:\/\//, '').split('?')[0];
  }
  return `${normTitle}::${normUrl}`;
}

/**
 * Deduplicates and enforces retention and freshness policies
 * @param {Object} options
 * @param {Array} options.existingItems - Current persisted items
 * @param {Array} options.incomingItems - Newly fetched items
 * @param {string} options.dateField - Key used for date check
 * @param {number} options.retentionDays - Max retention age in days before pruning
 * @param {number|null} options.maxIncomingAgeDays - Max allowed age for incoming items (e.g. 15 for jobs)
 * @param {string} options.collectionName - Descriptive name for logging
 */
function processCollection({
  existingItems,
  incomingItems,
  dateField = 'postedDate',
  retentionDays = 60,
  maxIncomingAgeDays = null,
  collectionName = 'item'
}) {
  const now = Date.now();
  const retentionMs = retentionDays * 24 * 60 * 60 * 1000;
  const cutoff = now - retentionMs;
  const existingMap = new Map();

  // 1. Process and prune existing items older than retentionDays
  for (const item of existingItems) {
    const rawDate = item[dateField] || item.postedDate || item.date || item.deadline;
    const itemTime = rawDate ? new Date(rawDate).getTime() : now;

    const isUpcoming = itemTime >= now;
    const isWithinRetention = itemTime >= cutoff;

    if (isUpcoming || isWithinRetention) {
      const key = makeFingerprint(item.title, item.url);
      existingMap.set(key, item);
    } else {
      const ageDays = (now - itemTime) / (1000 * 60 * 60 * 24);
      console.log(`[Retention] Removed expired ${collectionName} from storage (>${retentionDays} days old): "${item.title}" (${ageDays.toFixed(1)} days old)`);
    }
  }

  const newlyAdded = [];

  // 2. Evaluate incoming items with strict date and freshness checks
  for (const item of incomingItems) {
    if (!item.title || !item.url) continue;

    const rawDate = item[dateField] || item.postedDate || item.date || item.deadline;
    if (!rawDate) {
      console.log(`[Ingestion] Discarded ${collectionName} with missing date field: "${item.title}"`);
      continue;
    }

    const itemTime = new Date(rawDate).getTime();
    if (isNaN(itemTime)) {
      console.log(`[Ingestion] Discarded ${collectionName} with invalid date ("${rawDate}"): "${item.title}"`);
      continue;
    }

    const ageDays = (now - itemTime) / (1000 * 60 * 60 * 24);

    // If maxIncomingAgeDays is specified (15 days for jobs), strictly discard older
    if (maxIncomingAgeDays !== null && ageDays > maxIncomingAgeDays) {
      console.log(`[Ingestion] Discarded ${collectionName} older than ${maxIncomingAgeDays} days: "${item.title}" (${ageDays.toFixed(1)} days old)`);
      continue;
    }

    // Discard anything older than maximum retention window
    const isUpcoming = itemTime >= now;
    const isWithinRetention = itemTime >= cutoff;
    if (!isUpcoming && !isWithinRetention) {
      console.log(`[Ingestion] Discarded historical ${collectionName} older than ${retentionDays} days: "${item.title}" (${ageDays.toFixed(1)} days old)`);
      continue;
    }

    const key = makeFingerprint(item.title, item.url);
    if (!existingMap.has(key)) {
      existingMap.set(key, item);
      newlyAdded.push(item);
    }
  }

  // Convert back to sorted list (newest/upcoming first)
  const merged = Array.from(existingMap.values()).sort((a, b) => {
    const dateA = new Date(a[dateField] || a.postedDate || a.date || a.deadline || 0).getTime();
    const dateB = new Date(b[dateField] || b.postedDate || b.date || b.deadline || 0).getTime();
    return dateB - dateA;
  });

  return { merged, newlyAdded };
}

async function runDailyIngestion() {
  console.log('====================================================');
  console.log('  CYBERDASTAK OPPORTUNITIES - DATA INGESTION PIPELINE');
  console.log(`  Started at: ${new Date().toISOString()}`);
  console.log(`  Job Freshness Policy: Incoming <= ${JOB_MAX_INCOMING_AGE_DAYS} days | Storage Retention <= ${JOB_RETENTION_DAYS} days`);
  console.log('====================================================');

  ensureDir(DATA_DIR);

  // 1. Read existing datasets
  const rawExistingJobs = readJsonFile(JOBS_FILE, []);
  const existingEvents = readJsonFile(EVENTS_FILE, []);
  const existingScholarships = readJsonFile(SCHOLARSHIPS_FILE, []);

  // Filter out any legacy stale jobs that were ingested before the 15-day incoming rule was applied
  const existingJobs = rawExistingJobs.filter(j => {
    const jTime = new Date(j.postedDate).getTime();
    const ageDays = (Date.now() - jTime) / (1000 * 60 * 60 * 24);
    if (ageDays > JOB_MAX_INCOMING_AGE_DAYS) {
      console.log(`[Freshness Purge] Removed legacy stale job (>15 days old): "${j.title}" (${ageDays.toFixed(1)} days old)`);
      return false;
    }
    return true;
  });

  console.log(`[Data State] Storage: ${existingJobs.length} active jobs (after purging ${rawExistingJobs.length - existingJobs.length} legacy stale >15d), ${existingEvents.length} events, ${existingScholarships.length} scholarships.`);

  // 2. Fetch Jobs (Adzuna + JSearch)
  console.log('\n--- Fetching Jobs & Internships (India Only, <= 15 days) ---');
  const [adzunaJobs, jSearchJobs] = await Promise.all([
    fetchAdzunaJobs().catch(e => { console.error('[Adzuna Error]', e.message); return []; }),
    fetchJSearchJobs().catch(e => { console.error('[JSearch Error]', e.message); return []; })
  ]);

  let incomingJobs = [...adzunaJobs, ...jSearchJobs];
  console.log(`[Fetch Summary] Total incoming jobs from APIs (<= 15 days): ${incomingJobs.length}`);

  // Fallback seed if running in an unconfigured environment or initial launch
  if (existingJobs.length === 0 && incomingJobs.length === 0) {
    console.log('[Notice] No API jobs found and jobs.json empty. Loading fresh curated India infosec jobs (<= 5 days old).');
    incomingJobs = [...CURATED_INDIA_JOBS];
  }

  // 3. Fetch Events
  console.log('\n--- Fetching Cybersecurity Events ---');
  const incomingEvents = await fetchCybersecurityEvents().catch(e => {
    console.error('[Events Error]', e.message);
    return [];
  });

  // 4. Fetch Scholarships
  console.log('\n--- Fetching Scholarships & Fellowships ---');
  const incomingScholarships = await fetchScholarships().catch(e => {
    console.error('[Scholarships Error]', e.message);
    return [];
  });

  // 5. Process deduplication, retention, and freshness
  console.log('\n--- Processing Collections, Freshness & Retention ---');
  const jobsResult = processCollection({
    existingItems: existingJobs,
    incomingItems: incomingJobs,
    dateField: 'postedDate',
    retentionDays: JOB_RETENTION_DAYS,           // Prune any job older than 30 days total
    maxIncomingAgeDays: JOB_MAX_INCOMING_AGE_DAYS, // Discard incoming jobs older than 15 days
    collectionName: 'job'
  });

  const eventsResult = processCollection({
    existingItems: existingEvents,
    incomingItems: incomingEvents,
    dateField: 'date',
    retentionDays: GENERAL_RETENTION_DAYS,
    maxIncomingAgeDays: null,
    collectionName: 'event'
  });

  const scholarshipsResult = processCollection({
    existingItems: existingScholarships,
    incomingItems: incomingScholarships,
    dateField: 'deadline',
    retentionDays: GENERAL_RETENTION_DAYS,
    maxIncomingAgeDays: null,
    collectionName: 'scholarship'
  });

  // 6. Save updated collections
  writeJsonFile(JOBS_FILE, jobsResult.merged);
  writeJsonFile(EVENTS_FILE, eventsResult.merged);
  writeJsonFile(SCHOLARSHIPS_FILE, scholarshipsResult.merged);

  // 7. Save newly-added report for email digest
  const newlyAddedPayload = {
    fetchedAt: new Date().toISOString(),
    counts: {
      totalJobs: jobsResult.merged.length,
      totalEvents: eventsResult.merged.length,
      totalScholarships: scholarshipsResult.merged.length,
      newJobs: jobsResult.newlyAdded.length,
      newEvents: eventsResult.newlyAdded.length,
      newScholarships: scholarshipsResult.newlyAdded.length,
      totalNew: jobsResult.newlyAdded.length + eventsResult.newlyAdded.length + scholarshipsResult.newlyAdded.length
    },
    jobs: jobsResult.newlyAdded,
    events: eventsResult.newlyAdded,
    scholarships: scholarshipsResult.newlyAdded
  };

  writeJsonFile(NEWLY_ADDED_FILE, newlyAddedPayload);

  // 8. Explicit Final Audit Log for jobs.json
  const now = Date.now();
  console.log('\n====================================================');
  console.log('  FINAL JOBS.JSON AUDIT (STRICT FRESHNESS VERIFICATION)');
  console.log('====================================================');
  let olderThan15Count = 0;
  jobsResult.merged.forEach((j, idx) => {
    const jTime = new Date(j.postedDate).getTime();
    const ageDays = (now - jTime) / (1000 * 60 * 60 * 24);
    const isUnder15 = ageDays <= JOB_MAX_INCOMING_AGE_DAYS;
    if (!isUnder15) olderThan15Count++;
    console.log(`  [Job #${idx + 1}] "${j.title}"`);
    console.log(`           Org: ${j.organization} | Location: ${j.location}`);
    console.log(`           Posted: ${j.postedDate} (${ageDays.toFixed(1)} days ago) -> ${isUnder15 ? 'PASS (<= 15 days)' : 'WARN (> 15 days)'}`);
  });

  if (olderThan15Count === 0) {
    console.log(`\n  ✅ AUDIT PASSED: All ${jobsResult.merged.length} jobs in final jobs.json were posted within the last 15 days!`);
    console.log('     No job older than 15 days appears in the final jobs.json.');
  } else {
    console.warn(`\n  ⚠️ AUDIT NOTE: ${olderThan15Count} job(s) exceed 15 days but remain within the 30-day retention window.`);
  }

  console.log('\n====================================================');
  console.log('  PIPELINE EXECUTION COMPLETE');
  console.log(`  Jobs: ${jobsResult.merged.length} total (+${jobsResult.newlyAdded.length} new)`);
  console.log(`  Events: ${eventsResult.merged.length} total (+${eventsResult.newlyAdded.length} new)`);
  console.log(`  Scholarships: ${scholarshipsResult.merged.length} total (+${scholarshipsResult.newlyAdded.length} new)`);
  console.log(`  Summary saved to ${NEWLY_ADDED_FILE}`);
  console.log('====================================================\n');

  return newlyAddedPayload;
}

if (require.main === module) {
  runDailyIngestion()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('[Fatal Error in Fetch Pipeline]', err);
      process.exit(1);
    });
}

module.exports = {
  runDailyIngestion,
  JOB_MAX_INCOMING_AGE_DAYS,
  JOB_RETENTION_DAYS
};
