# 🚀 GST Recon — Intelligent GST Reconciliation Platform

A production-grade full-stack MERN application for automated GST reconciliation. Upload your Purchase Register (Books) and GSTR-2B/GSTR-1 data, and the platform automatically detects mismatches, tracks ITC at risk, and helps you manage follow-ups — all from a premium fintech-style dashboard.

![Stack](https://img.shields.io/badge/Stack-MERN-blue)
![License](https://img.shields.io/badge/License-MIT-green)

---

## ✨ Features

| Feature | Description |
|---|---|
| **JWT Authentication** | Secure signup/login with bcrypt password hashing |
| **Drag & Drop Upload** | Upload Excel files (.xlsx, .xls, .csv) with progress tracking |
| **Data Normalization** | Auto-normalizes GSTINs, invoice numbers, dates & amounts |
| **Matching Engine** | Multi-criteria matching: GSTIN → Invoice → Date (±3 days) → Amount (±1%) |
| **Visual Dashboard** | Pie charts, bar charts, summary cards with ITC at risk |
| **Party-wise View** | GSTIN-level aggregation with risk indicators (Low/Medium/High) |
| **Follow-up Engine** | Auto-generated email templates with copy-to-clipboard |
| **Issue Tracking** | Workflow management: Open → Followed Up → Resolved / Ignored |
| **Animated UI** | Framer Motion transitions, loading skeletons, toast notifications |

---

## 🏗️ Architecture

```
backend/
├── controllers/     # Request handlers
├── middleware/       # Auth & error handling
├── models/          # Mongoose schemas (User, Upload, Invoice, ReconciliationResult, Issue)
├── routes/          # Express route definitions
├── utils/           # Normalization utilities
├── uploads/         # Uploaded files storage
└── server.js        # App entry point

frontend/
├── src/
│   ├── components/  # Reusable UI (Layout, StatCard, Badge, Modal, Skeleton, EmptyState)
│   ├── context/     # AuthContext (React Context API)
│   ├── pages/       # Login, Signup, Dashboard, Upload, Reconciliation, Party, Issues
│   └── services/    # Axios API client
└── index.html

samples/
├── sample_books.xlsx      # Sample Purchase Register (15 invoices)
└── sample_gstr2b.xlsx     # Sample GSTR-2B data (13 entries with mismatches)
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** v18+
- **MongoDB** (local or [MongoDB Atlas](https://www.mongodb.com/atlas))

### 1. Clone & Install

```bash
# Backend
cd backend
cp .env.example .env     # Edit with your MongoDB URI & JWT secret
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Configure Environment

Edit `backend/.env`:

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/gst_recon
JWT_SECRET=your_secure_secret_here
JWT_EXPIRES_IN=7d
```

For **MongoDB Atlas**, use:
```env
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/gst_recon
```

### 3. Start Development Servers

```bash
# Terminal 1 — Backend
cd backend
npm run dev

# Terminal 2 — Frontend
cd frontend
npm run dev
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

---

## 📊 Using the Platform

1. **Sign up** for a new account
2. **Upload** your Purchase Register (Books) as an Excel file
3. **Upload** your GSTR-2B data as an Excel file
4. **Run Reconciliation** — the engine matches invoices and identifies:
   - ✅ **Matched** — Perfect match across all criteria
   - ❌ **Mismatch** — Amounts or dates don't align
   - ⚠️ **Missing in 2B** — In your books but not in GST portal (ITC at risk!)
   - ⚠️ **Missing in Books** — In GST portal but not in your records
5. **View Dashboard** for visual summary with charts
6. **Party View** — See GSTIN-wise breakdown with risk levels
7. **Follow Up** — Copy auto-generated email templates
8. **Track Issues** — Update status: Open → Followed Up → Resolved

### Sample Files

Use the pre-generated sample files in the `samples/` directory:
- `sample_books.xlsx` — 15 invoices from various vendors
- `sample_gstr2b.xlsx` — 13 entries with intentional mismatches and gaps

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/signup` | Create account |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Get current user |
| POST | `/api/upload` | Upload Excel file |
| GET | `/api/upload` | List uploads |
| DELETE | `/api/upload/:id` | Delete upload |
| POST | `/api/reconciliation/run` | Run matching engine |
| GET | `/api/reconciliation/results` | Get results (paginated) |
| GET | `/api/dashboard/stats` | Dashboard statistics |
| GET | `/api/party` | Party-wise summary |
| GET | `/api/party/:gstin` | Party detail + email template |
| GET | `/api/issues` | List issues |
| GET | `/api/issues/summary` | Issue summary |
| PATCH | `/api/issues/:id/status` | Update issue status |

---

## 🎨 Tech Stack

- **Frontend**: React 19 + Vite, Tailwind CSS v4, Framer Motion, Recharts, Lucide Icons
- **Backend**: Node.js, Express, MongoDB, Mongoose
- **Auth**: JWT + bcrypt
- **File Parsing**: SheetJS (xlsx)

---

## 📝 License

MIT License — free for personal and commercial use.
