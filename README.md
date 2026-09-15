# 🛡️ CyberDastak Opportunities

> **Daily-updated aggregator for Cybersecurity Jobs, Internships, Events, and Scholarships — strictly India-focused, running 100% serverless on GitHub Actions & GitHub Pages.**

An automated open-source intelligence pipeline that scans the web every morning at **9:00 AM IST (03:30 UTC)**, deduplicates listings, prunes expired entries older than 60 days, redeploys a static responsive web portal to GitHub Pages, and delivers a formatted daily email digest directly to your inbox.

---

## 🌟 Features

- **Strictly India-Focused**: Jobs and internships are filtered specifically for Indian cities (Bengaluru, Delhi NCR, Mumbai, Pune, Hyderabad, etc.) and India-eligible remote roles. Foreign non-eligible roles are automatically discarded.
- **3 Dynamic Categories**:
  1. 🛡️ **Jobs & Internships** (SOC Analysts, Penetration Testers, Incident Responders, Security Engineers, Interns)
  2. 📅 **Cybersecurity Events** (Conferences, OWASP meetups, BSides, webinars, hackathons, CTFs)
  3. 🎓 **Scholarships & Grants** (ISC2, SANS Diversity Academies, Google Generation, MeitY ISEA Fellowships)
- **Zero Server Overhead**: Powered entirely by GitHub Actions cron and GitHub Pages. No backend server, cloud VM, or laptop needs to stay awake.
- **Smart Retention & Deduplication**: Keeps track of unique title + URL fingerprints. Prevents duplicate alerts and auto-purges stale listings older than 60 days.
- **Daily 9:00 AM IST Email Digest**: Beautifully styled HTML email with new opportunities delivered straight to your inbox via Nodemailer (Gmail App Password, Brevo, SendGrid, etc.).
- **Fast Static Web Portal**: Built with clean semantic HTML5 + Tailwind CSS + Vanilla JS. Instant live search, role-type filters, location filtering, and detailed modals.

---

## 📁 Project Architecture

```
cyberdastak-opportunities/
├── .github/
│   └── workflows/
│       └── daily-task.yml       # Scheduled cron (03:30 UTC / 9:00 AM IST) & Pages deployment
├── data/
│   ├── jobs.json                # Persisted India cybersecurity jobs & internships
│   ├── events.json              # Persisted cybersecurity conferences & webinars
│   ├── scholarships.json        # Persisted student grants & fellowships
│   └── newly-added.json         # Diff report generated from the latest run
├── scripts/
│   ├── fetch-data.js            # Master orchestrator: fetch, validate, deduplicate, prune
│   ├── send-email.js            # HTML digest renderer & SMTP sender
│   └── utils/
│       ├── adzuna.js            # Adzuna India API client
│       ├── jsearch.js           # JSearch (RapidAPI / OpenWeb Ninja) client
│       ├── feeds.js             # RSS parser for infosec events & scholarships
│       └── filter-india.js      # Strict India location & remote verification logic
├── site/
│   ├── index.html               # Responsive portal layout with 3 tabs & search
│   ├── app.js                   # Client-side tabs, search, filters & modals
│   ├── style.css                # Cyber glow styling & custom scrollbars
│   └── data/                    # Synced JSON files deployed to GitHub Pages
├── .env.example                 # Example local environment configuration
├── package.json                 # Node dependencies and build scripts
└── README.md                    # Setup & operation documentation
```

---

## 🔑 How to Get Free API Keys

### 1. Adzuna API (India Jobs)
Adzuna provides an official API endpoint for India job listings (`api.adzuna.com/v1/api/jobs/in/...`).
1. Visit the [Adzuna Developer Portal](https://developer.adzuna.com/).
2. Click **Get API Access** and sign up for a free developer account.
3. Once logged in, create a new application.
4. Note down your **App ID** (`ADZUNA_APP_ID`) and **App Key** (`ADZUNA_APP_KEY`).

### 2. JSearch API (OpenWeb Ninja / RapidAPI)
JSearch aggregates real-time job listings from LinkedIn, Indeed, Glassdoor, and company career pages.
1. Visit [RapidAPI - JSearch](https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch) or [OpenWeb Ninja](https://openwebninja.com/api/jsearch).
2. Sign up or log into your account.
3. Subscribe to the **Free Basic Tier** (includes free monthly requests).
4. Copy your **X-RapidAPI-Key** (`JSEARCH_API_KEY`).

### 3. SMTP Email Credentials (e.g. Gmail)
To send the daily email digest at 9:00 AM IST, you can use any standard SMTP provider or Gmail App Password:
1. Go to your [Google Account Security Settings](https://myaccount.google.com/security).
2. Ensure **2-Step Verification** is turned **ON**.
3. Under *2-Step Verification*, scroll down to **App passwords**.
4. Create a new app password (e.g. name it `CyberDastak Digest`).
5. Copy the generated **16-character password** (`SMTP_PASS`).
6. Your Gmail address is your `SMTP_USER`.

---

## ⚙️ How to Configure GitHub Repository Secrets

To enable the daily GitHub Actions workflow to query the APIs, deploy to Pages, and send emails, add the following secrets:

1. In your GitHub repository, navigate to **Settings** > **Secrets and variables** > **Actions**.
2. Click **New repository secret** and add each of the following:

| Secret Name | Description | Example / Default |
| :--- | :--- | :--- |
| `ADZUNA_APP_ID` | Adzuna Developer Application ID | `a1b2c3d4` |
| `ADZUNA_APP_KEY` | Adzuna Developer Application Key | `9f8e7d6c5b4a3...` |
| `JSEARCH_API_KEY` | RapidAPI / OpenWeb Ninja JSearch Key | `59a3c...` |
| `SMTP_USER` | Email address sending the daily digest | `your-email@gmail.com` |
| `SMTP_PASS` | 16-character Gmail App Password | `abcd efgh ijkl mnop` |
| `RECIPIENT_EMAIL` | Destination email to receive the daily digest | `you@domain.com` |
| `SMTP_HOST` | *(Optional)* SMTP Host | `smtp.gmail.com` |
| `SMTP_PORT` | *(Optional)* SMTP Port | `465` |
| `SKIP_EMPTY_EMAIL` | *(Optional)* Set to `true` to skip email if 0 new items | `false` |

> [!NOTE]
> If API keys or SMTP secrets are omitted initially, the workflow will run smoothly using curated baseline feeds in dry-run mode without crashing.

---

## 🌐 How to Enable GitHub Pages

The repository uses modern **GitHub Actions-based deployment** for GitHub Pages:

1. In your GitHub repository, navigate to **Settings** > **Pages**.
2. Under **Build and deployment**:
   - **Source**: Select **GitHub Actions** (do *NOT* select "Deploy from a branch").
3. Navigate to **Settings** > **Actions** > **General**:
   - Scroll down to **Workflow permissions**.
   - Select **Read and write permissions** (allows the workflow to commit updated `data/*.json` files back to the repository).
   - Check **Allow GitHub Actions to create and approve pull requests**.
   - Click **Save**.

Your website will be published live at:
```
https://<YOUR-USERNAME>.github.io/<YOUR-REPO-NAME>/
```

---

## 🚀 How to Test the Workflow Manually

You don't need to wait until 9:00 AM IST to test!

1. In your repository, click the **Actions** tab at the top.
2. In the left sidebar, click **CyberDastak Daily Ingestion, Site Deploy & Digest**.
3. Click the **Run workflow** dropdown on the right side.
4. Select `Branch: main` and click the green **Run workflow** button.
5. The workflow will:
   - Run the fetch script and query live sources.
   - Commit any new listings to `/data/`.
   - Deploy the `/site/` to GitHub Pages.
   - Send the daily digest email to your `RECIPIENT_EMAIL`.

---

## 💻 Local Development & Testing

You can run the entire pipeline or inspect the website locally:

### 1. Clone & Install
```bash
git clone https://github.com/CyberDastak/cyberdastak-opportunities.git
cd cyberdastak-opportunities
npm install
```

### 2. Configure Environment (Optional for local API test)
```bash
cp .env.example .env
# Edit .env with your Adzuna / JSearch / SMTP credentials
```

### 3. Run Data Ingestion
```bash
npm run fetch
```
Updates `data/jobs.json`, `data/events.json`, `data/scholarships.json`, and outputs `data/newly-added.json`.

### 4. Test Email Digest (Dry Run)
```bash
npm run email
```
If SMTP secrets are not set in `.env`, it automatically generates a local HTML preview at:
`data/latest-email-preview.html`. Open this file in your browser to inspect the email format.

### 5. Preview Static Website Locally
```bash
npm start
```
Starts a local web server (typically on `http://localhost:3000`) showing the live site with active search, filters, and tab switching.

---

## 📜 License & Acknowledgments

- **License**: [MIT](LICENSE)
- **Data Sources**: [Adzuna India](https://api.adzuna.com/), [OpenWeb Ninja / JSearch](https://openwebninja.com/), [Infosec Conferences](https://infosec-conferences.com/), [ISC2](https://www.isc2.org/), [OWASP](https://owasp.org/).
- Maintained with ❤️ by **CyberDastak**.
