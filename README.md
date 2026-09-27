# CortexFi 💰

> Your wealth. Under intelligent control.

[![CI](https://github.com/your-org/cortexfi/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/cortexfi/actions)

---

## Features

CortexFi is an AI-powered personal finance management platform designed for Indian investors. Track your spending, grow your investments, and get intelligent insights—all in one place.

### Core Features

- **🤖 AI Assistant (Cortex)** - Natural language interface to ask questions about your finances, get spending insights, and receive personalized recommendations
- **✨ Smart Entry** - Describe transactions naturally (e.g., "Paid ₹540 for lunch at McDonald's") and let AI extract the details
- **🧾 Receipt OCR** - Scan receipts and automatically extract transaction data using optical character recognition
- **💬 SMS Parsing** - Paste bank SMS messages to automatically parse and import transaction details
- **📄 Bank Statement Import** - Import transactions from PDF or CSV bank statements
- **📊 Portfolio Tracking** - Monitor stocks, mutual funds, and other investments with real-time market data
- **💰 Net Worth** - Track your overall financial health with assets vs. liabilities visualization
- **🎯 Goals** - Set and track financial goals with progress tracking
- **📈 Analytics** - Comprehensive spending analysis with category breakdowns and trends
- **📰 Real-Time Market Data** - Get live prices for forex (USD/INR), cryptocurrencies (Bitcoin, Ethereum), commodities (Gold, Silver), and stock indices (Nifty, Sensex) with source attribution
- **🛡️ Hallucination Protection** - AI never invents market data - all prices come from verified external APIs with clear source attribution

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, TailwindCSS v3, React Query v5, Recharts |
| Backend | FastAPI, SQLAlchemy 2.0 (async), Pydantic v2, Alembic |
| Database | PostgreSQL 16 (Neon serverless) |
| AI | Ollama (local), OpenRouter, Gemini, OpenAI, Claude (BYO) |
| Market Data | Frankfurter API (Forex), CoinGecko (Crypto), Twelve Data (Stocks/Commodities) |
| OCR | Tesseract OCR |
| Deploy | Vercel (FE) + Render (BE) |

---

## Architecture Overview

CortexFi follows a modular monolith architecture with clear separation of concerns:

- **Frontend**: React SPA with React Query for data fetching and optimistic updates
- **Backend**: FastAPI with async SQLAlchemy for database operations
- **AI Layer**: Pluggable AI provider system supporting multiple LLM backends
- **Auth**: JWT-based authentication with refresh tokens
- **Database**: PostgreSQL with Alembic migrations

---

## Screenshots

### Dashboard
![Dashboard](docs/screenshots/dashboard.png)
*Overview of your financial health with key metrics and recent transactions*

### AI Assistant
![AI Assistant](docs/screenshots/ai-assistant.png)
*Chat with Cortex to get insights about your finances*

### Portfolio
![Portfolio](docs/screenshots/portfolio.png)
*Track your investments with real-time market data*

### Net Worth
![Net Worth](docs/screenshots/net-worth.png)
*Visualize your assets vs. liabilities over time*

---

## Installation

### Prerequisites
- Docker & Docker Compose
- Node.js 20+
- Python 3.12+
- Ollama (for local AI) or API keys for cloud AI providers

### 1. Clone & Configure

```bash
git clone https://github.com/your-org/cortexfi.git
cd cortexfi

# Backend env
cp backend/.env.example backend/.env
# Edit backend/.env with your configuration

# Frontend env
cp frontend/.env.example frontend/.env
```

### 2. Start the Database

```bash
docker-compose up -d db
```

### 3. Run Migrations & Seed

```bash
cd backend
pip install uv
uv pip install -e ".[dev]"
alembic upgrade head
python scripts/seed_categories.py
```

### 4. Start the Backend

```bash
uvicorn app.main:app --reload --port 8000
```

Or with Docker:
```bash
docker-compose up backend
```

### 5. Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

Open → **http://localhost:5173**

---

## Running Ollama (Local AI)

CortexFi uses Ollama for local AI inference. This keeps your data private and avoids API costs.

### Install Ollama

```bash
# macOS
brew install ollama

# Linux
curl -fsSL https://ollama.com/install.sh | sh

# Windows
# Download from https://ollama.com/download
```

### Pull a Model

```bash
ollama pull llama3.2:3b
```

### Configure in .env

```bash
# backend/.env
AI_PROVIDER=ollama
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:3b
```

---

## Environment Setup

Copy `backend/.env.example` to `backend/.env` and configure:

```bash
# Application
APP_NAME="CortexFi"
APP_ENV=development
DEBUG=true

# Database
DATABASE_URL=postgresql+asyncpg://dev:dev@localhost:5432/cortexfi

# Security
SECRET_KEY=change-me-to-a-random-32-byte-hex-string
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_DAYS=7

# AI Provider
AI_PROVIDER=ollama  # ollama | gemini | openai | claude | openrouter
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:3b

# Optional: Cloud AI Providers
GEMINI_API_KEY=your-gemini-api-key-here
OPENAI_API_KEY=your-openai-api-key-here

# OCR
TESSERACT_CMD=  # Optional: path to tesseract executable

# Google OAuth (for Gmail import)
GOOGLE_CLIENT_ID=your-google-client-id-here
GOOGLE_CLIENT_SECRET=your-google-client-secret-here
GOOGLE_REDIRECT_URI=http://localhost:5173/gmail-callback

# Market Data APIs (for real-time market data)
COINGECKO_API_KEY=          # Optional: for higher rate limits on crypto data
TWELVE_DATA_API_KEY=        # Required for stocks/commodities in production
```

---

## Real-Time Market Data

CortexFi provides live market data with complete source attribution to prevent AI hallucination:

### Supported Data Types

- **Forex**: Currency exchange rates (USD/INR, EUR/INR, GBP/INR, etc.)
- **Crypto**: Bitcoin, Ethereum, and other cryptocurrency prices
- **Commodities**: Gold, Silver, Crude Oil, Natural Gas prices
- **Stock Indices**: Nifty 50, BSE Sensex, and other indices

### Data Sources

- **Frankfurter API** - Free forex rates, no API key required
- **CoinGecko API** - Cryptocurrency prices, free tier available
- **Twelve Data API** - Stocks and commodities, API key required for production

### Usage Examples

Ask Cortex:
- "What is the current USD to INR rate?"
- "What is the price of gold today?"
- "Bitcoin price in INR"
- "Nifty value today"

### Hallucination Protection

The AI never invents market data:
- Intent detection routes market queries to external APIs
- Real data fetched before AI processing
- Every response includes source attribution and timestamp
- API failures return clear error messages, not fabricated data
- Post-validation ensures responses match provided context

---

## Project Structure

```
cortexfi/
├── backend/                # FastAPI application
│   ├── app/
│   │   ├── main.py         # App factory
│   │   ├── config.py       # Settings (pydantic-settings)
│   │   ├── database.py     # SQLAlchemy engine
│   │   ├── models/         # ORM models
│   │   ├── schemas/        # Pydantic schemas
│   │   ├── modules/        # Feature modules
│   │   │   ├── auth/       # Authentication (JWT)
│   │   │   ├── transactions/ # Transaction CRUD
│   │   │   ├── portfolio/  # Portfolio tracking
│   │   │   ├── ai/         # AI assistant & providers
│   │   │   │   └── tools/  # Market data APIs, yfinance integration
│   │   │   ├── ocr/        # Receipt OCR
│   │   │   ├── gmail_import/ # Gmail integration
│   │   │   ├── statement_import/ # Bank statements
│   │   │   └── message_parser/ # SMS parsing
│   │   ├── core/           # Security, exceptions, rate limiter
│   │   └── utils/          # Helpers
│   ├── alembic/            # DB migrations
│   ├── scripts/            # Seed scripts
│   └── tests/              # pytest suite
│
└── frontend/               # React application
    └── src/
        ├── App.tsx          # Routes + AuthContext
        ├── pages/           # Dashboard, Transactions, Portfolio, etc.
        ├── components/      # layout/, ui/, transactions/, portfolio/
        ├── api/             # Axios client + endpoint functions
        ├── hooks/           # useAuth, useCategoryDetector
        ├── store/           # Zustand UI store
        ├── types/           # TypeScript interfaces
        └── utils/           # cn, formatCurrency, formatDate
```

---

## API Documentation

With backend running → **http://localhost:8000/docs** (Swagger UI)

### Key Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/v1/auth/register` | — | Create account |
| POST | `/api/v1/auth/login` | — | Login, get JWT tokens |
| GET | `/api/v1/transactions` | 🔒 | List transactions |
| POST | `/api/v1/transactions` | 🔒 | Create transaction |
| GET | `/api/v1/portfolio/summary` | 🔒 | Portfolio overview |
| POST | `/api/v1/ai/assistant/chat` | 🔒 | Chat with Cortex (includes market data queries) |
| POST | `/api/v1/ocr/parse-receipt` | 🔒 | Parse receipt image |
| POST | `/api/v1/message-parser/parse-sms` | 🔒 | Parse bank SMS |

---

## Recent Updates

### Real-Time Market Data Integration
- Added live market data for forex, crypto, commodities, and stock indices
- Integrated Frankfurter API (forex), CoinGecko API (crypto), and Twelve Data API (stocks/commodities)
- Implemented hallucination protection - AI never invents market data
- Added source attribution and timestamps to all market data responses
- Enhanced UI to display market data metadata with live status indicators
- Added market data suggested prompts in AI assistant

### General Knowledge Query Handling
- AI now politely declines non-financial questions and explains its scope
- Clear distinction between financial assistant and general knowledge AI

---

## Future Roadmap

- [ ] **Multi-currency Support** - Track finances in multiple currencies
- [ ] **Budgeting** - Set and track monthly budgets by category
- [ ] **Recurring Transactions** - Auto-generate recurring expenses/income
- [ ] **Investment Advisor** - AI-powered investment recommendations
- [ ] **Tax Reports** - Generate tax-ready reports
- [ ] **Mobile App** - React Native mobile application
- [ ] **Bank API Integration** - Direct bank connections via open banking APIs
- [ ] **Advanced Market Data** - More commodities, stocks, and global indices

---

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

---

## License

MIT © CortexFi
