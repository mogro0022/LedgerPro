# LedgerPro

LedgerPro is a secure, responsive financial management application designed for small businesses. It features a modern React frontend and a high-performance FastAPI backend. Testing is done through Cypress.

**Key Feature:** This application supports **Dual Database Mode** (SQLite / Azure SQL) and uses **Alembic** for robust database version control.

## 🚀 Tech Stack

**Frontend:**
* **Framework:** React (Vite)
* **UI Library:** Mantine UI
* **State:** React Hooks & LocalStorage

**Backend:**
* **API:** Python FastAPI
* **Database:** SQLite (Local) OR Azure SQL (Cloud)
* **ORM:** SQLAlchemy
* **Migrations:** Alembic
* **Auth:** JWT + Argon2

---

## 🛠️ Setup & Installation

### 1. Prerequisites
* [Python 3.10+](https://www.python.org/)
* [Node.js 18+](https://nodejs.org/)
* **(For Azure Only):** [ODBC Driver 18 for SQL Server](https://learn.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server)
* **(Optional):** [Azure CLI](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli) for cloud deployment.

### 2. Backend Setup (Python)

**Windows (PowerShell):**
```powershell
cd ledger_api
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
```

**Mac / Linux:**
```bash
cd ledger_api
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 3. Frontend Setup (React)

```bash
cd ../ledger_ui
npm install
```

---

## ⚙️ Database Configuration

Control your database connection using the `.env` file in `ledger_api/`.

**How to Switch:**
1. Open `ledger_api/.env`.
2. To use **SQLite**, uncomment Option 1 and comment out Option 2.
3. To use **Azure**, comment out Option 1 and uncomment Option 2.

**Copy this into your `.env` file:**

```ini
# ==============================
# 💽 DATABASE CONNECTION
# ==============================

# OPTION 1: SQLite (Local Development)
# Uses a local file. No internet required.
DATABASE_URL=sqlite:///./ledger.db

# OPTION 2: Azure SQL (Production / Cloud)
# Requires internet and ODBC Driver 18 installed.
# DATABASE_URL="Driver={ODBC Driver 18 for SQL Server};Server=tcp:YOUR_SERVER.database.windows.net,1433;Database=ledgerDB;Uid=YOUR_USER;Pwd=YOUR_PASSWORD;Encrypt=yes;TrustServerCertificate=no;Connection Timeout=30;"

# ==============================
# 🔐 SECURITY
# ==============================
SECRET_KEY=change_this_to_a_secure_random_string
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=4320
```

---

## 🏗️ Database Migrations (Alembic)

This project uses Alembic to manage database tables. You must run migrations to create the tables before starting the app.

**1. Initialize/Update Database**
Run this command whenever you pull new code or change `models.py`:

```bash
cd ledger_api
# Activate venv first!
alembic upgrade head
```

**2. Creating a New Migration (For Developers)**
If you modify `models.py` (e.g., add a column), run:

```bash
alembic revision --autogenerate -m "Description of change"
alembic upgrade head
```

---

## ▶️ Running the App (Development)

Run these in two separate terminals.

**Terminal 1: Backend**

*Windows:*
```powershell
cd ledger_api
.\venv\Scripts\activate
alembic upgrade head   # <--- Run migrations first!
uvicorn main:app --reload --port 8000
```

*Mac/Linux:*
```bash
cd ledger_api
source venv/bin/activate
alembic upgrade head   # <--- Run migrations first!
uvicorn main:app --reload --port 8000
```

**Terminal 2: Frontend**
```bash
cd ledger_ui
npm run dev
```
*App will run at: `http://localhost:5173`*

---

## 📦 Building for Production

This bundles the React frontend so it can be served directly by Python.

1.  **Build Frontend:**
    ```bash
    cd ledger_ui
    npm run build
    ```

2.  **Move Files:**
    * **Delete** the old `dist` folder inside `ledger_api` (if it exists).
    * **Copy** the new `dist` folder from `ledger_ui` and paste it inside `ledger_api`.

3.  **Run Production Server:**
    *Windows:*
    ```powershell
    cd ..\ledger_api
    uvicorn main:app --host 0.0.0.0 --port 8000 --ssl-keyfile key.pem --ssl-certfile cert.pem
    ```
    *Mac/Linux:*
    ```bash
    cd ../ledger_api
    uvicorn main:app --host 0.0.0.0 --port 8000 --ssl-keyfile key.pem --ssl-certfile cert.pem
    ```

---

## ⚠️ Troubleshooting

**1. "Login Timeout Expired" (Azure)**
* **Cause:** Azure Firewall is blocking your IP.
* **Fix:** Go to Azure Portal -> SQL Server -> Networking -> "Add client IPv4 address".

**2. "Table already exists" (Alembic)**
* **Cause:** You switched to Alembic on an existing database.
* **Fix:** Run `alembic stamp head` to mark the database as up-to-date without running SQL.

**3. "Driver not found" (Azure)**
* **Cause:** Missing ODBC Driver.
* **Fix:** Download "ODBC Driver 18 for SQL Server" from Microsoft.

**4. App loads but data is missing on Phone**
* **Cause:** Frontend built with `localhost` URLs.
* **Fix:** Ensure `App.jsx` uses relative URLs (e.g., `/token`) and rebuild (`npm run build`).
