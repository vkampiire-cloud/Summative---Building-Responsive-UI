# MediGuard — Drug Safety & Medication Recall Portal

> **Live Deployed Application:** [https://www.vkampiire.tech](https://www.vkampiire.tech)  
> **Demo Video Link:** https://youtu.be/ExWeag34fb8
> **Student:** Vanessa Kampire 
> **code vibe report: ** 

---

## 1. Project Purpose & Real-World Utility
Pharmaceutical drugs are frequently recalled due to contamination, defective packaging, or mislabeling. Finding this information in government databases is often difficult for regular patients and clinic workers.

**MediGuard** is a public health web application that provides real-time access to official medication recall alerts. It allows users to:
* **Search:** Look up medications by name (e.g., *Ibuprofen*, *Metformin*, *Amoxicillin*).
* **Filter by FDA Danger Level:**
  * **Class I:** High risk (dangerous / life-threatening).
  * **Class II:** Moderate risk (temporary health issues).
  * **Class III:** Low risk (minor labeling / packaging defects).
* **Filter by Status:** View *Ongoing* vs *Completed* recalls.
* **Sort:** Organize results by recall date (newest/oldest) or drug name (A–Z).

---

## 2. External API Attribution
* **API Name:** openFDA Drug Enforcement & Recalls API
* **Provider:** United States Food and Drug Administration (FDA)
* **Official Documentation:** [https://open.fda.gov/apis/drug/enforcement/](https://open.fda.gov/apis/drug/enforcement/)
* **Endpoint Used:** `https://api.fda.gov/drug/enforcement.json`
* **Data Retrieved:** Product description, recall classification, recalling firm, distribution scope, reason for recall, and initiation date.

---

## 3. System Architecture (Multi-Tier Deployment)
MediGuard is deployed across a 3-tier cloud architecture with automated load balancing:

```text
                  [ User Web Browser ]
                           │
                           ▼
          7314-lb-01 (13.40.176.113) - HAProxy
          • SSL Termination (HTTPS)
          • Round-Robin Load Balancing
                           │
             ┌─────────────┴─────────────┐
             ▼                           ▼
    7314-web-01 (18.130.99.55)   7314-web-02 (18.130.123.188)
    • Nginx Reverse Proxy (:80)   • Nginx Reverse Proxy (:80)
    • Adds X-Served-By Header     • Adds X-Served-By Header
             │                           │
             ▼                           ▼
    Python App (127.0.0.1:5000)   Python App (127.0.0.1:5000)
    • In-Memory Caching (300s)   • In-Memory Caching (300s)
    • /api/health Endpoint       • /api/health Endpoint
             │                           │
             └─────────────┬─────────────┘
                           ▼
              [ openFDA Government API ]
```

### Security & Port Isolation
* **Port Isolation:** The Python application binds strictly to internal `127.0.0.1:5000`. Port 5000 is blocked from external access and is only reachable through Nginx.
* **Backend Proxy:** The frontend never exposes secret keys or calls the external API directly; all requests pass through the cached backend proxy to prevent rate-limiting.

---

## 4. How to Run Locally

### Prerequisites
* Python 3 installed
* Git

### Steps
1. Clone the repository:
   ```bash
   git clone https://github.com/vkampiire-cloud/Summative---Building-Responsive-UI.git
   cd Summative---Building-Responsive-UI
   ```
2. Start the local server:
   ```bash
   python server.py
   # Or on Mac/Linux:
   python3 server.py
   ```
3. Open your browser and visit:  
   👉 **http://127.0.0.1:5000**

---

## 5. Verification & Testing Commands

Run these commands in terminal to verify production deployment:

```bash
# 1. Verify Load Balancer alternates traffic between web-01 and web-02:
for i in {1..4}; do curl -sI https://www.vkampiire.tech/ | grep -i x-served-by; done

# Output will alternate:
# x-served-by: 7314-web-01
# x-served-by: 7314-web-02
# x-served-by: 7314-web-01
# x-served-by: 7314-web-02

# 2. Verify Health Check Endpoint:
curl -s https://www.vkampiire.tech/api/health

# 3. Verify Internal Port Isolation (Must fail/timeout from outside):
curl -m 3 http://18.130.99.55:5000/api/health
```

---

## 6. Challenges Overcome
1. **Handling Upstream Rate Limits (HTTP 429):** Implemented an in-memory TTL cache (300 seconds) in `server.py` so repeated queries load instantly without hammering the FDA servers.
2. **Empty Search Handling:** The openFDA API returns HTTP 404 when no records match a search query. The backend was designed to intercept 404s and return a clean empty list `[]` so the frontend displays an intuitive *"No recalls found"* message.
3. **Multi-Server Synchronization:** Automated background management with `systemd` (`mediguard.service`) on both `web-01` and `web-02` to ensure zero downtime when servers reboot.

---

## 7. CodeVibe Authorship 

### CodeVibe Report Files
* **Root Verification Report:** [`code.vibe.json`](code.vibe.json)
* **Submissions Folder Archive:** [`codevibe-reports/v.kampiire.report.json`](codevibe-reports/v.kampiire.report.json)


