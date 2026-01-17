# 📒 Secure Ledger API (Azure SQL + SQLite)

A high-security financial ledger API built with **FastAPI**, **SQLAlchemy**, and **Azure SQL Database Ledger**.

This application features a **"Dual-Mode" Database Architecture**:
1.  **Local Development:** Uses **SQLite** for fast, offline testing.
2.  **Production:** Uses **Azure SQL Database** with **Ledger Mode enabled** (Tamper-Proof History).

---

## 🚀 Features
* **Tamper-Proof Transactions:** In Azure, the `Transactions` table is cryptographically protected. Any change (update/delete) is permanently recorded in a read-only History table.
* **Dual-Database Support:** Single codebase runs on both SQLite (standard) and MSSQL (Ledger-enhanced).
* **Secure Authentication:** Uses **Argon2** (Winner of the Password Hashing Competition) for admin security.
* **Automated Migrations:** Hybrid Alembic scripts automatically detect the database type and apply the correct security policies.

---

## 🛠️ Installation

1.  **Clone the repository:**
    ```bash
    git clone <your-repo-url>
    cd ledger_api
    ```

2.  **Create and activate virtual environment:**
    ```bash
    python -m venv venv
    source venv/bin/activate  # Linux/Mac
    # venv\Scripts\activate   # Windows
    ```

3.  **Install dependencies:**
    ```bash
    pip install -r requirements.txt
    ```
    *(Note: Includes `fastapi`, `sqlalchemy`, `alembic`, `pyodbc`, `argon2-cffi`)*

---

## ⚙️ Configuration

Create a `.env` file in the root directory. You can toggle between Local and Production by commenting/uncommenting the `DATABASE_URL`.

**`.env` File:**
```ini
# OPTION 1: Local Development (SQLite)
# DATABASE_URL="sqlite:///./ledger.db"

# OPTION 2: Azure Production (MSSQL with Ledger)
# Replace with your actual Azure Connection String
DATABASE_URL="Driver={ODBC Driver 18 for SQL Server};Server=tcp:your-server.database.windows.net,1433;Database=LedgerDB;Uid=ledgeradmin;Pwd=YourPassword;Encrypt=yes;TrustServerCertificate=no;Connection Timeout=30;"
```

---

## 🗄️ Database Management (Migrations)

This project uses **Alembic** for migrations. The migration script contains "Hybrid Logic" that automatically applies **Ledger Security** if it detects Azure, or **Standard Tables** if it detects SQLite.

### 1. Initial Setup (Run this first)
Regardless of which database you are using, run:
```bash
alembic upgrade head
```

### 2. Resetting the Database (The "Nuclear" Wipe)
If you need to restart from scratch, the process differs by environment.

#### 🟢 For Local (SQLite)
Simply delete the file:
```bash
rm ledger.db
alembic upgrade head
```

#### 🔵 For Azure (Production)
**WARNING:** You cannot simply drop Ledger tables. You must use the Azure Portal.

1.  Log in to the **[Azure Portal](https://portal.azure.com)**.
2.  Go to your SQL Database -> **Query Editor**.
3.  Run this "Nuclear" SQL script to safely unlock and remove all tables:

```sql
/* 1. DROP MIGRATION HISTORY */
DROP TABLE IF EXISTS [dbo].[alembic_version];

/* 2. UNLOCK & DROP TRANSACTIONS (Child) */
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'Transactions' AND temporal_type = 2)
BEGIN
    ALTER TABLE [dbo].[Transactions] SET (SYSTEM_VERSIONING = OFF);
END

DECLARE @sql NVARCHAR(MAX) = N'';
SELECT @sql += N'ALTER TABLE [dbo].[Transactions] DROP CONSTRAINT ' + name + N'; '
FROM sys.default_constraints
WHERE parent_object_id = OBJECT_ID('[dbo].[Transactions]');
EXEC sp_executesql @sql;

DROP TABLE IF EXISTS [dbo].[Transactions];
DROP TABLE IF EXISTS [dbo].[TransactionsHistory];
DROP TABLE IF EXISTS [Ledger].[Transactions];

/* 3. DROP PARENTS */
DROP TABLE IF EXISTS [dbo].[Customers];
DROP TABLE IF EXISTS [dbo].[users];
DROP SCHEMA IF EXISTS [Ledger];
```
4.  After the database is empty, run `alembic upgrade head` locally to rebuild it.

---

## 👤 User Management

We use **Argon2** hashing. Do not manually insert users into the database. Use the helper script.

**Create a new Admin:**
```bash
python create_user.py
```
* Prompts for Email and Password.
* Hashes password securely using Argon2.
* Saves user to the connected database (SQLite or Azure depending on `.env`).

---

## 🏃‍♂️ Running the API

Start the server:
```bash
uvicorn main:app --reload
```

* **API Root:** `http://127.0.0.1:8000`
* **Swagger Docs:** `http://127.0.0.1:8000/docs`

---

## 🛡️ Security Notes for Production
1.  **Azure Firewall:** Ensure your client IP is allowed in the Azure Portal Networking settings.
2.  **SSL/TLS:** The connection string includes `Encrypt=yes` to ensure data is encrypted in transit.
3.  **Ledger Verification:** You can verify the integrity of the Azure Ledger tables using the "Database Ledger" blade in the Azure Portal.
