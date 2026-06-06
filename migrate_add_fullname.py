"""Migration: add full_name column to user table and populate it"""
import sqlite3
import os

db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'site.db')

if not os.path.exists(db_path):
    print("Database not found at", db_path)
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Check if full_name column exists
cursor.execute("PRAGMA table_info(user)")
columns = [col[1] for col in cursor.fetchall()]

if 'full_name' not in columns:
    print("Adding full_name column to user table...")
    cursor.execute("ALTER TABLE user ADD COLUMN full_name VARCHAR(120) DEFAULT ''")
    # Populate full_name with current username for existing users
    cursor.execute("UPDATE user SET full_name = username WHERE full_name IS NULL OR full_name = ''")
    conn.commit()
    print("Migration completed successfully.")
else:
    print("full_name column already exists.")

conn.close()
