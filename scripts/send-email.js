/**
 * CyberDastak Opportunities - Daily Email Digest Sender
 * Reads newly-added items from /data/newly-added.json and emails a formatted HTML digest
 * via Nodemailer using SMTP credentials from GitHub Secrets.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const DATA_DIR = path.resolve(__dirname, '../data');
const NEWLY_ADDED_FILE = path.join(DATA_DIR, 'newly-added.json');
const PREVIEW_FILE = path.join(DATA_DIR, 'latest-email-preview.html');

async function sendDailyDigest() {
  console.log('====================================================');
  console.log('  CYBERDASTAK OPPORTUNITIES - EMAIL DIGEST DISPATCH');
  console.log('====================================================');

  if (!fs.existsSync(NEWLY_ADDED_FILE)) {
    console.warn(`[Email] ${NEWLY_ADDED_FILE} not found. Run fetch-data.js first.`);
    return;
  }

  const payload = JSON.parse(fs.readFileSync(NEWLY_ADDED_FILE, 'utf8'));
  const { counts = {}, jobs = [], events = [], scholarships = [] } = payload;
  const totalNew = counts.totalNew || 0;

  const skipEmpty = (process.env.SKIP_EMPTY_EMAIL || '').toLowerCase() === 'true';

  if (totalNew === 0 && skipEmpty) {
    console.log('[Email] No new items found and SKIP_EMPTY_EMAIL=true. Skipping digest delivery.');
    return;
  }

  // Format today's date in IST
  const nowIST = new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'full',
    timeStyle: 'short'
  });

  const siteUrl = process.env.SITE_URL || 'https://cyberdastak.github.io/cyberdastak-opportunities';

  // Build HTML Email Content
  const htmlContent = buildEmailTemplate({
    nowIST,
    counts,
    totalNew,
    jobs,
    events,
    scholarships,
    siteUrl
  });

  // Always write the HTML preview file for debugging/inspection
  fs.writeFileSync(PREVIEW_FILE, htmlContent, 'utf8');
  console.log(`[Email] Digest HTML preview written to: ${PREVIEW_FILE}`);

  // Check SMTP credentials
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const recipient = process.env.RECIPIENT_EMAIL;

  if (!smtpUser || !smtpPass || !recipient) {
    console.warn('\n[Email Notice] SMTP credentials (SMTP_USER, SMTP_PASS, RECIPIENT_EMAIL) are not set.');
    console.warn('[Email Notice] Skipping remote email delivery (dry-run mode). Preview saved to data/latest-email-preview.html\n');
    return;
  }

  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const secure = port === 465;

  console.log(`[Email] Connecting to SMTP server ${host}:${port} as ${smtpUser}...`);

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user: smtpUser,
      pass: smtpPass
    }
  });

  const subject = totalNew > 0
    ? `🛡️ CyberDastak Daily Digest: ${totalNew} New Cybersecurity Opportunities in India`
    : `🛡️ CyberDastak Daily Digest: Daily Update (${nowIST})`;

  try {
    const info = await transporter.sendMail({
      from: `"CyberDastak Opportunities" <${smtpUser}>`,
      to: recipient,
      subject,
      html: htmlContent
    });

    console.log(`[Email Success] Digest successfully sent to ${recipient}`);
    console.log(`[Email Message ID] ${info.messageId}`);
  } catch (err) {
    console.error('[Email Error] Failed to send email digest:', err.message);
    // Don't fail entire workflow if email provider is temporarily throttled
  }
}

function buildEmailTemplate({ nowIST, counts, totalNew, jobs, events, scholarships, siteUrl }) {
  const jobRows = jobs.map(j => `
    <div style="background:#1e293b; border:1px solid #334155; border-radius:8px; padding:16px; margin-bottom:14px;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <h3 style="margin:0 0 6px 0; font-size:16px; color:#38bdf8;">${escapeHtml(j.title)}</h3>
        <span style="background:#0284c7; color:#fff; font-size:11px; padding:3px 8px; border-radius:12px; font-weight:600;">${escapeHtml(j.type || 'Job')}</span>
      </div>
      <p style="margin:0 0 8px 0; color:#94a3b8; font-size:13px; font-weight:500;">
        🏢 <strong>${escapeHtml(j.organization)}</strong> &nbsp;|&nbsp; 📍 ${escapeHtml(j.location)}
      </p>
      <p style="margin:0 0 12px 0; color:#cbd5e1; font-size:13px; line-height:1.5;">${escapeHtml(j.description || '')}</p>
      <a href="${j.url}" target="_blank" style="display:inline-block; background:#0284c7; color:#ffffff; text-decoration:none; padding:8px 16px; border-radius:6px; font-size:13px; font-weight:bold;">
        Apply Now &rarr;
      </a>
    </div>
  `).join('');

  const eventRows = events.map(e => `
    <div style="background:#1e293b; border:1px solid #334155; border-radius:8px; padding:16px; margin-bottom:14px;">
      <h3 style="margin:0 0 6px 0; font-size:16px; color:#34d399;">${escapeHtml(e.title)}</h3>
      <p style="margin:0 0 8px 0; color:#94a3b8; font-size:13px;">
        🏛️ <strong>${escapeHtml(e.organization)}</strong> &nbsp;|&nbsp; 📅 ${escapeHtml(formatDate(e.date))} &nbsp;|&nbsp; 📍 ${escapeHtml(e.location)}
      </p>
      <p style="margin:0 0 12px 0; color:#cbd5e1; font-size:13px; line-height:1.5;">${escapeHtml(e.description || '')}</p>
      <a href="${e.url}" target="_blank" style="display:inline-block; background:#059669; color:#ffffff; text-decoration:none; padding:8px 16px; border-radius:6px; font-size:13px; font-weight:bold;">
        Register / Learn More &rarr;
      </a>
    </div>
  `).join('');

  const scholarshipRows = scholarships.map(s => `
    <div style="background:#1e293b; border:1px solid #334155; border-radius:8px; padding:16px; margin-bottom:14px;">
      <h3 style="margin:0 0 6px 0; font-size:16px; color:#f472b6;">${escapeHtml(s.title)}</h3>
      <p style="margin:0 0 8px 0; color:#94a3b8; font-size:13px;">
        🎓 <strong>${escapeHtml(s.organization)}</strong> &nbsp;|&nbsp; ⏳ Deadline: ${escapeHtml(formatDate(s.deadline))}
      </p>
      <p style="margin:0 0 12px 0; color:#cbd5e1; font-size:13px; line-height:1.5;">${escapeHtml(s.description || '')}</p>
      <a href="${s.url}" target="_blank" style="display:inline-block; background:#db2777; color:#ffffff; text-decoration:none; padding:8px 16px; border-radius:6px; font-size:13px; font-weight:bold;">
        View Opportunity &rarr;
      </a>
    </div>
  `).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CyberDastak Opportunities Daily Digest</title>
</head>
<body style="margin:0; padding:0; background-color:#0f172a; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#f8fafc;">
  <div style="max-width:640px; margin:0 auto; padding:24px 16px;">
    
    <!-- HEADER -->
    <div style="text-align:center; padding:24px 0 20px 0; border-bottom:1px solid #334155;">
      <div style="display:inline-block; background:#0284c7; color:#ffffff; font-size:12px; font-weight:bold; letter-spacing:1px; text-transform:uppercase; padding:4px 12px; border-radius:20px; margin-bottom:10px;">
        Daily Automated Intelligence
      </div>
      <h1 style="margin:0 0 6px 0; font-size:24px; color:#ffffff; letter-spacing:-0.5px;">CyberDastak Opportunities</h1>
      <p style="margin:0; font-size:13px; color:#94a3b8;">Cybersecurity Jobs (India) &bull; Events &bull; Scholarships</p>
      <p style="margin:8px 0 0 0; font-size:12px; color:#64748b;">${nowIST}</p>
    </div>

    <!-- STATS COUNTER -->
    <div style="background:#1e293b; border-radius:10px; padding:16px; margin:20px 0; text-align:center;">
      <table style="width:100%; border-collapse:collapse;">
        <tr>
          <td style="text-align:center; border-right:1px solid #334155;">
            <div style="font-size:22px; font-weight:bold; color:#38bdf8;">${counts.newJobs || 0}</div>
            <div style="font-size:11px; color:#94a3b8; text-transform:uppercase; margin-top:2px;">New Jobs</div>
          </td>
          <td style="text-align:center; border-right:1px solid #334155;">
            <div style="font-size:22px; font-weight:bold; color:#34d399;">${counts.newEvents || 0}</div>
            <div style="font-size:11px; color:#94a3b8; text-transform:uppercase; margin-top:2px;">New Events</div>
          </td>
          <td style="text-align:center;">
            <div style="font-size:22px; font-weight:bold; color:#f472b6;">${counts.newScholarships || 0}</div>
            <div style="font-size:11px; color:#94a3b8; text-transform:uppercase; margin-top:2px;">Scholarships</div>
          </td>
        </tr>
      </table>
    </div>

    ${totalNew === 0 ? `
      <!-- EMPTY STATE -->
      <div style="background:#1e293b; border:1px dashed #475569; border-radius:8px; padding:24px; text-align:center; margin:24px 0;">
        <div style="font-size:32px; margin-bottom:8px;">☕</div>
        <h3 style="margin:0 0 8px 0; color:#e2e8f0; font-size:16px;">No new additions in today's morning scan</h3>
        <p style="margin:0 0 16px 0; color:#94a3b8; font-size:13px; line-height:1.5;">
          Our scraper scanned Adzuna, JSearch, and public feeds at 9:00 AM IST. All current listings remain up to date. You can explore all ${counts.totalJobs || 0} active India cybersecurity jobs and active events on the live website.
        </p>
        <a href="${siteUrl}" target="_blank" style="display:inline-block; background:#0284c7; color:#ffffff; text-decoration:none; padding:10px 20px; border-radius:6px; font-size:13px; font-weight:bold;">
          Browse All Active Listings &rarr;
        </a>
      </div>
    ` : ''}

    ${jobs.length > 0 ? `
      <!-- JOBS SECTION -->
      <div style="margin-top:24px;">
        <h2 style="font-size:17px; color:#38bdf8; margin:0 0 12px 0; border-bottom:2px solid #0284c7; padding-bottom:6px;">
          🛡️ New Cybersecurity Jobs & Internships (India)
        </h2>
        ${jobRows}
      </div>
    ` : ''}

    ${events.length > 0 ? `
      <!-- EVENTS SECTION -->
      <div style="margin-top:28px;">
        <h2 style="font-size:17px; color:#34d399; margin:0 0 12px 0; border-bottom:2px solid #059669; padding-bottom:6px;">
          📅 Upcoming Infosec Events & Webinars
        </h2>
        ${eventRows}
      </div>
    ` : ''}

    ${scholarships.length > 0 ? `
      <!-- SCHOLARSHIPS SECTION -->
      <div style="margin-top:28px;">
        <h2 style="font-size:17px; color:#f472b6; margin:0 0 12px 0; border-bottom:2px solid #db2777; padding-bottom:6px;">
          🎓 Scholarships & Fellowships
        </h2>
        ${scholarshipRows}
      </div>
    ` : ''}

    <!-- CTA & FOOTER -->
    <div style="text-align:center; padding:32px 0 16px 0; border-top:1px solid #334155; margin-top:32px;">
      <a href="${siteUrl}" target="_blank" style="display:inline-block; background:#38bdf8; color:#0f172a; text-decoration:none; padding:12px 28px; border-radius:6px; font-size:14px; font-weight:bold; margin-bottom:16px;">
        View Live Portal on CyberDastak &rarr;
      </a>
      <p style="margin:0 0 6px 0; font-size:12px; color:#94a3b8;">
        Automated daily via GitHub Actions &bull; Hosted on GitHub Pages
      </p>
      <p style="margin:0; font-size:11px; color:#64748b;">
        Strictly filtered for India-based and India-eligible cybersecurity opportunities.
      </p>
    </div>

  </div>
</body>
</html>
  `;
}

function formatDate(dStr) {
  if (!dStr) return 'Active';
  try {
    const d = new Date(dStr);
    if (isNaN(d.getTime())) return dStr;
    return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch (_) {
    return dStr;
  }
}

function escapeHtml(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

if (require.main === module) {
  sendDailyDigest()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('[Fatal Error in Email Script]', err);
      process.exit(1);
    });
}

module.exports = {
  sendDailyDigest,
  buildEmailTemplate
};
