# create_readme.py

# We use variables for backticks to ensure the file writes correctly
# without breaking the Python script formatting.
code_block_bash = "```bash"
code_block_ini = "```ini"
code_block_sql = "```sql"
code_block_end = "```"

readme_content = f"""# 📒 Secure Ledger API (Azure SQL + SQLite)

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
    {code_block_bash}
    git clone <your-repo-url>
    cd ledger_api
    {code_block_end}

2.  **Create and activate virtual environment:**
    {code_block_bash}
    python -m venv venv
    source venv/bin/activate  # Linux/Mac
    # venv\\Scripts\\activate   # Windows
    {code_block_end}

3.  **Install dependencies:**
    {code_block_bash}
    pip install -r requirements.txt
    {code_block_end}
    *(Note: Includes `fastapi`, `sqlalchemy`, `alembic`, `pyodbc`, `argon2-cffi`)*

---

## ⚙️ Configuration

Create a `.env` file in the root directory. You can toggle between Local and Production by commenting/uncommenting the `DATABASE_URL`.

**`.env` File:**
{code_block_ini}
# OPTION 1: Local Development (SQLite)
# DATABASE_URL="sqlite:///./ledger.db"

# OPTION 2: Azure Production (MSSQL with Ledger)
# Replace with your actual Azure Connection String
DATABASE_URL="Driver={{ODBC Driver 18 for SQL Server}};Server=tcp:your-server.database.windows.net,1433;Database=LedgerDB;Uid=ledgeradmin;Pwd=YourPassword;Encrypt=yes;TrustServerCertificate=no;Connection Timeout=30;"
{code_block_end}

---

## 🗄️ Database Management (Migrations)

This project uses **Alembic** for migrations. The migration script contains "Hybrid Logic" that automatically applies **Ledger Security** if it detects Azure, or **Standard Tables** if it detects SQLite.

### 1. Initial Setup (Run this first)
Regardless of which database you are using, run:
{code_block_bash}
alembic upgrade head
{code_block_end}

### 2. Resetting the Database (The "Nuclear" Wipe)
If you need to restart from scratch, the process differs by environment.

#### 🟢 For Local (SQLite)
Simply delete the file:
{code_block_bash}
rm ledger.db
alembic upgrade head
{code_block_end}

#### 🔵 For Azure (Production)
**WARNING:** You cannot simply drop Ledger tables. You must use the Azure Portal.

1.  Log in to the **[Azure Portal](https://portal.azure.com)**.
2.  Go to your SQL Database -> **Query Editor**.
3.  Run this "Nuclear" SQL script to safely unlock and remove all tables:

{code_block_sql}
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
{code_block_end}
4.  After the database is empty, run `alembic upgrade head` locally to rebuild it.

---

## 👤 User Management

We use **Argon2** hashing. Do not manually insert users into the database. Use the helper script.

**Create a new Admin:**
{code_block_bash}
python create_user.py
{code_block_end}
* Prompts for Email and Password.
* Hashes password securely using Argon2.
* Saves user to the connected database (SQLite or Azure depending on `.env`).

---

## 🏃‍♂️ Running the API

Start the server:
{code_block_bash}
uvicorn main:app --reload
{code_block_end}

* **API Root:** `http://127.0.0.1:8000`
* **Swagger Docs:** `http://127.0.0.1:8000/docs`

---

## 🛡️ Security Notes for Production
1.  **Azure Firewall:** Ensure your client IP is allowed in the Azure Portal Networking settings.
2.  **SSL/TLS:** The connection string includes `Encrypt=yes` to ensure data is encrypted in transit.
3.  **Ledger Verification:** You can verify the integrity of the Azure Ledger tables using the "Database Ledger" blade in the Azure Portal.
"""

# Write the file
with open("README.md", "w", encoding="utf-8") as f:
    f.write(readme_content)

print("✅ README.md has been successfully generated!")
