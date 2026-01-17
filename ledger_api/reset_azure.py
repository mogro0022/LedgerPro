import os
from sqlalchemy import create_engine, text
from sqlalchemy.engine import URL
from dotenv import load_dotenv

# 1. Load Environment Variables
load_dotenv()
raw_url = os.getenv("DATABASE_URL")

if not raw_url:
    print("❌ ERROR: DATABASE_URL is missing from .env")
    exit()

# 2. Safety Check: Protect SQLite
if "sqlite" in raw_url:
    print("❌ ERROR: You are currently pointing to SQLite.")
    print("   This script is for wiping AZURE SQL only.")
    print("   Please switch your .env to Azure before running this script.")
    exit()

# 3. FIX: Convert the raw string into a format SQLAlchemy understands
print(f"🔄 Parsing connection string...")

if "ODBC Driver" in raw_url:
    # If it's the complex Azure string, we must wrap it
    connection_url = URL.create("mssql+pyodbc", query={"odbc_connect": raw_url})
else:
    # If it's a standard URL, use it as is
    connection_url = raw_url

# 4. Connect
print(f"🔥 Connecting to Azure SQL...")
engine = create_engine(connection_url)

with engine.connect() as connection:
    print("⚠️  WARNING: This will DELETE all tables in the Azure database.")
    print("   This is necessary to enable the Ledger Feature.")
    confirm = input("Type 'yes' to confirm: ")

    if confirm != "yes":
        print("Aborted.")
        exit()

    # 5. Drop constraints and tables
    print("🗑️  Dropping tables...")
    try:
        # We use explicit transaction commit
        trans = connection.begin()

        # Order matters! Child tables first.
        connection.execute(text("DROP TABLE IF EXISTS [Ledger].[Transactions]"))
        connection.execute(text("DROP TABLE IF EXISTS [dbo].[Transactions]"))
        connection.execute(
            text("DROP TABLE IF EXISTS [dbo].[TransactionsHistory]")
        )  # Clean up history table too
        connection.execute(text("DROP TABLE IF EXISTS [dbo].[Customers]"))
        connection.execute(text("DROP TABLE IF EXISTS [dbo].[users]"))

        # Drop Alembic memory
        connection.execute(text("DROP TABLE IF EXISTS [dbo].[alembic_version]"))

        # Drop custom schema if empty
        try:
            connection.execute(text("DROP SCHEMA [Ledger]"))
        except:
            pass

        trans.commit()
        print("✅ Azure Database has been wiped clean.")

    except Exception as e:
        print(f"❌ Error during drop: {e}")
        print(
            "   (If this fails, you may need to delete tables manually in the Azure Portal)"
        )
