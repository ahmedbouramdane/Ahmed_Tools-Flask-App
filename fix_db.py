"""
Fix database schema: drop old task_share table, add new columns to task.
Run this once: python fix_db.py
"""
import sqlite3, os

ROOT = os.path.dirname(os.path.abspath(__file__))
DB = os.path.join(ROOT, "site.db")

conn = sqlite3.connect(DB)
c = conn.cursor()

# Drop old task_share table (will be recreated by SQLAlchemy's create_all)
c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='task_share'")
if c.fetchone():
    print("[*] Dropping old task_share table...")
    c.execute("DROP TABLE task_share")
    print("[OK] task_share dropped (will be recreated on next app start)")

# Ensure task table has all required columns
existing = {row[1] for row in c.execute("PRAGMA table_info(task)").fetchall()}
needed = [
    ("is_my_day", "BOOLEAN DEFAULT 0"),
    ("is_important", "BOOLEAN DEFAULT 0"),
    ("category", "VARCHAR(50) DEFAULT ''"),
    ("tags", "TEXT DEFAULT ''"),
]
for col_name, col_def in needed:
    if col_name not in existing:
        print(f"[*] Adding column `{col_name}` to `task` ...")
        c.execute(f'ALTER TABLE task ADD COLUMN "{col_name}" {col_def}')

conn.commit()
conn.close()
print("[OK] Database fix complete. Run 'python app.py' to recreate tables.")
