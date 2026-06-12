# Finance Copilot 💰

> AI-powered personal finance and portfolio management platform for Indian investors.

[![CI](https://github.com/your-org/finance-copilot/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/finance-copilot/actions)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, TailwindCSS v3, React Query v5, Recharts |
| Backend | FastAPI, SQLAlchemy 2.0 (async), Pydantic v2, Alembic |
| Database | PostgreSQL 16 (Neon serverless) |
| AI | Google Gemini API |
| Deploy | Vercel (FE) + Render (BE) |

---

## Quick Start (Local)

### Prerequisites
- Docker & Docker Compose
- Node.js 20+
- Python 3.12+

### 1. Clone & configure

```bash
git clone https://github.com/your-org/finance-copilot.git
cd finance-copilot

# Backend env
cp backend/.env.example backend/.env
# Edit backend/.env — set SECRET_KEY and GEMINI_API_KEY

# Frontend env
cp frontend/.env.example frontend/.env
```

### 2. Start the database

```bash
docker-compose up -d db
```

### 3. Run migrations + seed

```bash
cd backend
pip install uv
uv pip install -e ".[dev]"
alembic upgrade head
python scripts/seed_categories.py
```

### 4. Start the backend

```bash
uvicorn app.main:app --reload --port 8000
```

Or with Docker:
```bash
docker-compose up backend
```

### 5. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Open → **http://localhost:5173**

---

## Project Structure

```
finance-copilot/
├── backend/                # FastAPI application
│   ├── app/
│   │   ├── main.py         # App factory
│   │   ├── config.py       # Settings
│   │   ├── database.py     # SQLAlchemy engine
│   │   ├── models/         # ORM models
│   │   ├── schemas/        # Pydantic schemas
│   │   ├── modules/auth/   # Auth module (router, service, repo)
│   │   ├── core/           # Security, exceptions, rate limiter
│   │   └── utils/          # Helpers
│   ├── alembic/            # DB migrations
│   ├── scripts/            # Seed scripts
│   └── tests/              # pytest suite
│
└── frontend/               # React application
    └── src/
        ├── App.tsx          # Routes + AuthContext
        ├── pages/           # LoginPage, SignupPage, DashboardPage, ProfilePage
        ├── components/      # layout/, ui/ atoms
        ├── api/             # Axios client + endpoint functions
        ├── hooks/           # useAuth
        ├── store/           # Zustand UI store
        ├── types/           # TypeScript interfaces
        └── utils/           # cn, formatCurrency, formatDate
```

---

## API Docs

With backend running → **http://localhost:8000/docs** (Swagger UI)

### Auth Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/v1/auth/register` | — | Create account |
| POST | `/api/v1/auth/login` | — | Login, get JWT tokens |
| POST | `/api/v1/auth/refresh` | Cookie | Refresh access token |
| POST | `/api/v1/auth/logout` | — | Clear refresh cookie |
| GET | `/api/v1/auth/me` | 🔒 | Get current user |
| PATCH | `/api/v1/auth/me` | 🔒 | Update profile |
| POST | `/api/v1/auth/change-password` | 🔒 | Change password |

---

## Development Roadmap

- [x] **Phase 1** — Auth, profile, project structure *(current)*
- [ ] **Phase 2** — Transactions + CSV import
- [ ] **Phase 3** — Portfolio + Net Worth + Goals
- [ ] **Phase 4** — Analytics dashboard
- [ ] **Phase 5** — AI features (Gemini)
- [ ] **Phase 6** — Production deployment

---

## Running Tests

```bash
# Backend tests
cd backend
pytest -v

# Frontend type check
cd frontend
npm run type-check
npm run lint
```

---

## License

MIT © Finance Copilot
