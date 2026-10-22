# Contract Hub (fully local)

Local version of the Blob Storage → AI extraction → PostgreSQL → web app flow.

```
contracts/inbox/<Client>/*.pdf
        │  watchdog file watcher (replaces "Blob Created" trigger)
        ▼
Agent pipeline:  Reader → Classifier → Extractor → SLA → Validator
        │  structured JSON
        ▼
SQLite (contracts/contracts.db)   ← swap to Postgres with DATABASE_URL
        │  REST API (FastAPI)
        ▼
React UI: status tiles, cards/table, filters, detail drawer with PDF preview
```

## Run it

Backend (Python 3.11+):

```bash
cd backend
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python scripts/make_samples.py                          # 16 sample PDFs covering every status
uvicorn app.main:app --reload --port 8000
```

Frontend (Node 18+), in a second terminal:

```bash
cd frontend
npm install
npm run dev                                             # http://localhost:5173
```

Drop any PDF into `contracts/inbox/` (a subfolder name becomes the client) and it appears in the UI within seconds. You can also use **Upload contract** in the UI.

To serve everything from one process: `npm run build` in `frontend`, then open http://localhost:8000.

## Pages

- **Landing (TCS AgentAssist):** project title and description, then a **Geographical / Size** toggle.
  - Geographical shows the six continents first; click one to see its clients.
  - Size shows Enterprise, Large, Mid-size and Small the same way.
- **Client page:** three tabs.
  - **PTRs:** problem tracking reports with severity, status, age and assignee. A button below reveals the earlier sprint, blockers and board view.
  - **Invoices:** outstanding, overdue and paid totals plus the invoice list.
  - **Contracts:** status tiles, filters, cards or table, detail drawer with PDF preview.
- **Assistant (bottom right):** on the landing and continent pages it answers about all clients; on a client page it answers about that client only.

Routes use the URL hash (`#/geo/Europe`, `#/client/3/invoices`), so pages can be bookmarked and the back button works.

### What is sample data

| Data | Where it comes from now | How to make it real |
|---|---|---|
| Project description | Placeholder | Edit `frontend/src/projectInfo.js` |
| Client region and size | Built-in samples, or a pseudo-random pick for unknown clients | Copy `contracts/client_meta.example.json` to `client_meta.json` and edit it |
| PTRs, invoices | `backend/app/mock_ops.py` | Replace `build_ptrs` / `build_invoices` with calls to your tracker and billing system; keep the returned keys |
| Sprint, blockers, board | `backend/app/mock_projects.py` | Same idea with `build_project` |

Each mock tab shows a banner saying so. Contracts are always real extracted data.

### The assistant

`POST /api/chat` builds a snapshot of the data for the scope (all clients, or one) and answers from it. With `ANTHROPIC_API_KEY` set, Claude answers in natural language, restricted to that snapshot. Without a key, or if the call fails, rule-based answers cover expiring contracts, overdue invoices, PTRs, blockers, project health and per-client or per-region lookups. The snapshot includes text extracted from uploaded documents, so the prompt tells the model to treat it as untrusted data.

## The agents

| Agent | Job | Rules mode (no key) | Claude mode |
|---|---|---|---|
| Reader | PDF to text; OCR if the PDF is a scan | PyMuPDF, Tesseract fallback | same |
| Classifier | Contract type (13 types) | Weighted keyword scoring | Structured tool call |
| Extractor | Parties, value, currency, start/end, renewal, law, payment | Layered regex + keyword proximity | Structured output **with a verbatim evidence quote per field** |
| SLA | Uptime, response/resolution, RPO/RTO, credits | Sentence-level patterns | Structured list with evidence |
| Validator | Grounds every field in the source text, sanity-checks dates and money, scores confidence | Deterministic (always rules) | same |

The Validator is the guard-rail: if Claude returns a value whose supporting quote is not in the document, that field's confidence is cut and a warning is shown in the UI; invented SLAs are dropped. Anything below 60% overall, or missing parties/dates, lands in **Needs review**. If a Claude call fails, that agent falls back to rules automatically, and the trace tab shows which mode ran.

### Turn on Claude

```bash
cp .env.example .env     # then set ANTHROPIC_API_KEY=...
```

Restart the API. The header badge changes to "Claude extraction". Document text is sent to the Anthropic API in this mode, so use rules mode for documents that must not leave your machine.

## Mapping back to Azure later

| Local | Azure |
|---|---|
| `contracts/inbox` + `file_path` | Blob container + `blob_uri` |
| watchdog watcher (`app/watcher.py`) | Blob Created / Event Grid trigger calling `ingest.process_file` |
| Reader agent (PyMuPDF/Tesseract) | Azure AI Document Intelligence (replace `ReaderAgent`, keep the `Context` contract) |
| `GET /api/contracts/{id}/file` | Short-lived SAS URL |
| SQLite | PostgreSQL: set `DATABASE_URL=postgresql+psycopg://...` and `pip install psycopg[binary]` |

The UI only talks to `/api/*`, so it does not change.

## Notes

- Status (Active / Expiring Soon / Expired / Upcoming) is computed at read time from the dates, so badges never go stale. "Expiring soon" is `EXPIRING_SOON_DAYS` (default 60).
- Where only a term length is printed ("a term of 24 months"), the end date is derived and a warning says so.
- `python scripts/make_samples.py --clean` resets the inbox and database.
- Tests worth adding next: golden-file tests per contract template, and a review/edit form that writes corrections back to the row.
