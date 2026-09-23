# Naukri Autonomous Job Application System — Existing Repository First

You are a senior TypeScript/Node.js automation engineer.

I want a production-quality automated Naukri.com job application system.

IMPORTANT:

Do NOT immediately build everything from scratch.

First research and inspect existing open-source implementations, especially:

1. https://github.com/wshal/Naukri-Auto-apply
2. https://github.com/Traverser25/NopeRi
3. https://github.com/Nawaz-B-04/job-automation
4. https://github.com/Vishnu8989/naukri-auto-applier

You may inspect other relevant repositories if useful.

## Phase 1 — Repository Research

Before writing implementation code:

* Inspect the repositories.
* Read their README files.
* Inspect their source code.
* Identify their architecture.
* Identify which Naukri flows actually work.
* Identify their browser automation approach.
* Identify their job-search implementation.
* Identify their application/form handling.
* Identify their questionnaire handling.
* Identify duplicate detection.
* Identify rate limiting.
* Identify session handling.
* Identify resume upload.
* Identify application tracking.
* Identify known limitations.
* Identify stale/broken code.
* Identify security risks.

Do NOT assume README claims are correct.

Verify important functionality from the actual source code.

Create an internal comparison:

Repository | Language | Browser/API | Job Search | Easy Apply | Questions | Resume | Duplicate Tracking | Scheduling | Last Activity | Reusable Components

Then decide which existing implementation gives us the best foundation.

---

# Phase 2 — Reuse Instead of Rebuild

If an existing repository provides working functionality:

REUSE IT.

Do not rewrite working functionality just because you prefer another architecture.

However, do not blindly copy the repository either.

Refactor/adapt it into a clean architecture.

Prefer TypeScript + Node.js + Playwright for the main system unless the inspected implementation provides a compelling reason to use another approach.

If useful, incorporate ideas/components from multiple repositories.

Example:

wshal:

* Playwright flow
* persistent browser profile
* profile facts
* questionnaire matching
* dry-run
* application tracking

NopeRi:

* Naukri job-search/API concepts
* session handling
* job details
* application flow

Nawaz-B-04:

* SQLite tracking
* configuration
* scheduled execution

Do NOT copy credentials, secrets, personal data, binaries, or suspicious code from third-party repositories.

---

# Phase 3 — Security Audit Before Reuse

Before executing any downloaded code:

Inspect:

* package.json
* package-lock.json
* requirements.txt
* shell scripts
* install scripts
* postinstall scripts
* GitHub Actions
* Dockerfiles
* executable files
* network requests
* credential handling
* browser extensions
* obfuscated JavaScript
* encoded payloads
* suspicious downloads

Look specifically for:

* credential exfiltration
* malicious npm packages
* arbitrary shell execution
* crypto miners
* reverse shells
* unexpected external endpoints
* password collection
* token theft
* browser cookie theft

Do not execute suspicious code.

If a repository is unsafe or unnecessarily risky, reject it and use another implementation.

---

# Phase 4 — Build the Final Architecture

Create a clean system approximately like:

src/

agent/
agent.ts

browser/
browser.ts
session.ts

naukri/
search.ts
jobs.ts
parser.ts
apply.ts
forms.ts

matching/
scorer.ts
rules.ts

profile/
profile.ts
resume.ts

questions/
matcher.ts
answerer.ts

applications/
tracker.ts
repository.ts

database/
database.ts
migrations/

config/
config.ts

logging/
logger.ts

cli/
commands.ts

tests/

config/

resumes/

logs/

---

# Phase 5 — Autonomous Workflow

The final workflow should be:

Naukri
↓
Authenticate using persistent browser session
↓
Search configured job keywords
↓
Sort by newest
↓
Collect latest jobs
↓
Extract job details
↓
Deduplicate
↓
Evaluate job against my profile
↓
Reject unsuitable jobs
↓
Open qualifying job
↓
Detect Easy Apply
↓
Fill application
↓
Answer known questions
↓
Upload resume
↓
Validate form
↓
Submit
↓
Verify successful submission
↓
Save application
↓
Continue to next job

---

# Phase 6 — My Job Profile

Use these as the default facts:

Name:
Amit Saroj

Role:
Full Stack Developer / Software Engineer

Experience:
5+ years

Core:
React.js
Next.js
Node.js
TypeScript
JavaScript
MERN
NestJS
Express.js
REST APIs
Microservices
PostgreSQL
MySQL
MongoDB
Redis
Kafka
RabbitMQ
BullMQ
Docker
AWS
CI/CD
GitHub
WebSockets
JWT
RBAC

AI:
Generative AI
Agentic AI
AI agents
LLM integrations
AI automation
Claude Code
Cursor
Codex

Current company:
Antier

Current designation:
Software Engineer

Current location:
Mohali, India

Preferred:
Remote
Chandigarh
Mohali
Delhi NCR
India

Notice period:
30 days

Current CTC:
12 LPA

Expected:
18–20 LPA

Email:
[sarojamit4956@gmail.com](mailto:sarojamit4956@gmail.com)

Phone:
+91 8707831236

Alternate:
+91 9120715464

LinkedIn:
https://www.linkedin.com/in/amit-saroj/

GitHub:
https://github.com/amitsaroj

Education:
Diploma in Computer Science and Engineering

10th:
79.5%

12th:
76%

Use the actual resume as the authoritative source if it contains more complete information.

NEVER fabricate an answer.

---

# Phase 7 — Latest Jobs

Default:

MAX_JOB_AGE_DAYS=3

Prioritize:

* Posted today
* Few hours ago
* 1 day ago
* 2 days ago
* 3 days ago

Search keywords:

React Developer
React.js Developer
Full Stack Developer
MERN Developer
MERN Stack Developer
Node.js Developer
Next.js Developer
Senior React Developer
Senior Full Stack Developer
Software Engineer
Full Stack Engineer
Node.js Backend Developer

Make everything configurable.

---

# Phase 8 — Matching

Build a deterministic job matching engine.

Evaluate:

* title
* experience
* technologies
* location
* work mode
* salary
* notice period
* employment type
* mandatory qualifications

Default:

MIN_MATCH_SCORE=70

Do not blindly apply to every latest job.

The purpose is to maximize relevant applications rather than application count.

---

# Phase 9 — Questionnaire

Only answer questions using verified profile facts.

For example:

"What is your notice period?"

→ 30 days

"Current CTC?"

→ 12 LPA

"Expected CTC?"

→ 18–20 LPA

"Years of React experience?"

→ derive only if supported by the profile/resume.

Unknown mandatory question:

→ BLOCK application.

Never invent:

* years of experience
* certifications
* degrees
* employment history
* visa status
* authorization
* relocation willingness
* skills
* salary
* achievements

---

# Phase 10 — Duplicate Prevention

Use SQLite.

Store:

job_id
job_url
job_title
company
location
posted_date
match_score
application_status
application_date
resume
search_keyword
error
created_at
updated_at

Never apply twice to the same job.

Use multiple duplicate signals:

1. Naukri job ID
2. Canonical URL
3. normalized company + title

---

# Phase 11 — Application Limits

Configuration:

MAX_APPLICATIONS_PER_RUN=30

MAX_APPLICATIONS_PER_DAY=50

DELAY_BETWEEN_APPLICATIONS_MIN=10
DELAY_BETWEEN_APPLICATIONS_MAX=30

These must be configurable.

Never hammer the website.

If Naukri itself reports an application quota:

STOP.

Do not attempt to bypass it.

---

# Phase 12 — CAPTCHA / OTP / Security

Never bypass:

* CAPTCHA
* OTP
* MFA
* security verification
* anti-bot challenge

Detect these states.

Log:

CAPTCHA_DETECTED
OTP_REQUIRED
SECURITY_CHECK_REQUIRED

Pause/skip safely.

Do not attempt to circumvent Naukri's security mechanisms.

---

# Phase 13 — Dry Run

Implement:

DRY_RUN=true

Dry run must:

* search
* parse
* deduplicate
* score
* inspect application
* identify fields
* identify questions
* determine answers
* report what would happen

But:

DO NOT SUBMIT.

Example:

npm run agent -- --dry-run

Only after verification:

npm run agent

---

# Phase 14 — Persistent Browser

Use Playwright persistent context.

Example:

./naukri-browser-profile

The user may authenticate once.

After authentication:

the agent should reuse the session.

Do not store plaintext Naukri passwords.

Do not automatically collect credentials.

If authentication expires:

pause and report:

"Naukri authentication required."

---

# Phase 15 — Observability

Every application should produce structured logs.

Example:

{
"event": "APPLICATION_SUBMITTED",
"jobId": "...",
"company": "...",
"title": "...",
"url": "...",
"timestamp": "..."
}

Save failed-job screenshots.

Directory:

logs/screenshots/

---

# Phase 16 — CLI

Implement:

npm run agent

npm run agent -- --dry-run

npm run search

npm run applications

npm run stats

npm run test

npm run debug

---

# Phase 17 — Scheduling

The agent should support automatic recurring execution.

Example:

Run several times per day.

Do not rely on GitHub Actions if persistent browser authentication is required unless the authentication architecture is explicitly designed for it.

Prefer local/VM execution with a persistent browser profile for the initial version.

Make scheduling configurable.

---

# Phase 18 — Testing

Before real applications:

Test:

* Naukri session detection
* search
* job extraction
* freshness detection
* deduplication
* scoring
* questionnaire matching
* form filling
* resume upload
* database
* daily limit
* error recovery

Run:

npm test

and:

npm run typecheck

and:

npm run lint

Fix all errors.

---

# Phase 19 — Browser Verification

Use Playwright against the current Naukri UI.

Do not trust selectors from old GitHub repositories.

Verify current:

* search page
* job cards
* job detail
* Apply button
* Easy Apply flow
* questionnaire
* submission confirmation

Create selector fallbacks where appropriate.

Keep Naukri selectors isolated.

---

# Phase 20 — Final Deliverable

At completion provide:

1. Repository selected as the base.
2. Why it was selected.
3. Repositories inspected.
4. Components reused.
5. Components rewritten.
6. Security issues discovered.
7. Final architecture.
8. Files created/modified.
9. Installation commands.
10. Environment variables.
11. Database schema.
12. Dry-run command.
13. Real-run command.
14. Test results.
15. Known limitations.

IMPORTANT:

Do not stop after research.

After inspecting the existing repositories, actually implement the system in the current workspace.

Do not build from scratch if an existing implementation provides a reliable foundation.

Do not blindly trust third-party code.

Reuse good code, remove unsafe/brittle code, and build the missing pieces.

