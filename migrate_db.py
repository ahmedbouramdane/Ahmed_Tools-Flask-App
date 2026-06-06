"""
Database migration script — adds new columns/tables without data loss.
Run this after pulling model changes:
    python migrate_db.py

Detects existing columns vs new ones, adds only what's missing,
creates brand-new tables, and preserves all existing data.
"""

import sqlite3, os, sys

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(ROOT_DIR, "site.db")

# ── Schema defined by current models ──────────────────────────────────────────

TABLES = {
    "user": {
        "columns": [
            ("id", "INTEGER PRIMARY KEY AUTOINCREMENT"),
            ("username", "VARCHAR(80) NOT NULL UNIQUE"),
            ("email", "VARCHAR(120) NOT NULL UNIQUE"),
            ("password_hash", "VARCHAR(256)"),
            ("avatar_url", "VARCHAR(200) DEFAULT ''"),
            ("bio", "TEXT DEFAULT ''"),
            ("cover_url", "VARCHAR(500) DEFAULT ''"),
            ("skills", "TEXT DEFAULT ''"),
            ("linkedin_url", "VARCHAR(300) DEFAULT ''"),
            ("github_url", "VARCHAR(300) DEFAULT ''"),
            ("twitter_url", "VARCHAR(300) DEFAULT ''"),
            ("website_url", "VARCHAR(300) DEFAULT ''"),
            ("theme", "VARCHAR(10) DEFAULT 'light'"),
            ("font_family", "VARCHAR(30) DEFAULT 'Inter'"),
            ("verification_code", "VARCHAR(6)"),
            ("verification_code_expires", "DATETIME"),
            ("email_verified", "BOOLEAN DEFAULT 0"),
            ("notification_sound_url", "VARCHAR(500) DEFAULT 'https://www.soundjay.com/buttons/sounds/button-09.mp3'"),
            ("notifications_enabled", "BOOLEAN DEFAULT 1"),
            ("unread_badge_enabled", "BOOLEAN DEFAULT 1"),
            ("notification_sound_enabled", "BOOLEAN DEFAULT 1"),
            ("default_reminder_minutes", "INTEGER DEFAULT 30"),
        ]
    },
    "note": {
        "columns": [
            ("id", "INTEGER PRIMARY KEY AUTOINCREMENT"),
            ("title", "VARCHAR(200) NOT NULL"),
            ("content", "TEXT"),
            ("color", "VARCHAR(7) DEFAULT '#ffffff'"),
            ("created_at", "DATETIME"),
            ("updated_at", "DATETIME"),
            ("user_id", "INTEGER NOT NULL REFERENCES user(id)"),
        ]
    },
    "task": {
        "columns": [
            ("id", "INTEGER PRIMARY KEY AUTOINCREMENT"),
            ("title", "VARCHAR(200) NOT NULL"),
            ("description", "TEXT"),
            ("completed", "BOOLEAN DEFAULT 0"),
            ("priority", "VARCHAR(10) DEFAULT 'medium'"),
            ("due_date", "DATETIME"),
            ("category", "VARCHAR(50) DEFAULT ''"),
            ("tags", "TEXT DEFAULT ''"),
            ("is_my_day", "BOOLEAN DEFAULT 0"),
            ("is_important", "BOOLEAN DEFAULT 0"),
            ("created_at", "DATETIME"),
            ("updated_at", "DATETIME"),
            ("user_id", "INTEGER NOT NULL REFERENCES user(id)"),
        ]
    },
    "task_share": {
        "columns": [
            ("id", "INTEGER PRIMARY KEY AUTOINCREMENT"),
            ("task_id", "INTEGER NOT NULL REFERENCES task(id)"),
            ("shared_by_id", "INTEGER NOT NULL REFERENCES user(id)"),
            ("shared_with_id", "INTEGER NOT NULL REFERENCES user(id)"),
            ("permission", "VARCHAR(20) DEFAULT 'view'"),
            ("shared_at", "DATETIME"),
        ],
        "unique": [("task_id", "shared_with_id")],
    },
    "event": {
        "columns": [
            ("id", "INTEGER PRIMARY KEY AUTOINCREMENT"),
            ("title", "VARCHAR(200) NOT NULL"),
            ("description", "TEXT"),
            ("start", "DATETIME NOT NULL"),
            ("end", "DATETIME NOT NULL"),
            ("all_day", "BOOLEAN DEFAULT 0"),
            ("color", "VARCHAR(7) DEFAULT '#3788d8'"),
            ("location", "VARCHAR(200) DEFAULT ''"),
            ("repeat_type", "VARCHAR(20) DEFAULT 'none'"),
            ("reminder_minutes", "INTEGER DEFAULT 30"),
            ("created_at", "DATETIME"),
            ("user_id", "INTEGER NOT NULL REFERENCES user(id)"),
        ]
    },
    "event_attachment": {
        "columns": [
            ("id", "INTEGER PRIMARY KEY AUTOINCREMENT"),
            ("event_id", "INTEGER NOT NULL REFERENCES event(id)"),
            ("filename", "VARCHAR(255) NOT NULL"),
            ("original_filename", "VARCHAR(255) NOT NULL"),
            ("created_at", "DATETIME"),
        ]
    },
    "chat": {
        "columns": [
            ("id", "INTEGER PRIMARY KEY AUTOINCREMENT"),
            ("title", "VARCHAR(200) DEFAULT 'New Chat'"),
            ("created_at", "DATETIME"),
            ("user_id", "INTEGER NOT NULL REFERENCES user(id)"),
        ]
    },
    "chat_message": {
        "columns": [
            ("id", "INTEGER PRIMARY KEY AUTOINCREMENT"),
            ("role", "VARCHAR(20) NOT NULL"),
            ("content", "TEXT NOT NULL"),
            ("created_at", "DATETIME"),
            ("chat_id", "INTEGER NOT NULL REFERENCES chat(id)"),
        ]
    },
    "user_message": {
        "columns": [
            ("id", "INTEGER PRIMARY KEY AUTOINCREMENT"),
            ("sender_id", "INTEGER NOT NULL REFERENCES user(id)"),
            ("receiver_id", "INTEGER NOT NULL REFERENCES user(id)"),
            ("content", "TEXT NOT NULL"),
            ("attachment_url", "VARCHAR(500)"),
            ("attachment_type", "VARCHAR(50)"),
            ("created_at", "DATETIME"),
            ("is_read", "BOOLEAN DEFAULT 0"),
        ]
    },
    "chat_group": {
        "columns": [
            ("id", "INTEGER PRIMARY KEY AUTOINCREMENT"),
            ("name", "VARCHAR(200) NOT NULL"),
            ("description", "TEXT DEFAULT ''"),
            ("avatar_url", "VARCHAR(500) DEFAULT ''"),
            ("created_at", "DATETIME"),
            ("owner_id", "INTEGER NOT NULL REFERENCES user(id)"),
        ]
    },
    "group_member": {
        "columns": [
            ("id", "INTEGER PRIMARY KEY AUTOINCREMENT"),
            ("group_id", "INTEGER NOT NULL REFERENCES chat_group(id)"),
            ("user_id", "INTEGER NOT NULL REFERENCES user(id)"),
            ("role", "VARCHAR(20) DEFAULT 'member'"),
            ("joined_at", "DATETIME"),
        ],
        "unique": [("group_id", "user_id")],
    },
    "group_message": {
        "columns": [
            ("id", "INTEGER PRIMARY KEY AUTOINCREMENT"),
            ("group_id", "INTEGER NOT NULL REFERENCES chat_group(id)"),
            ("sender_id", "INTEGER NOT NULL REFERENCES user(id)"),
            ("content", "TEXT NOT NULL"),
            ("attachment_url", "VARCHAR(500)"),
            ("attachment_type", "VARCHAR(50)"),
            ("created_at", "DATETIME"),
        ]
    },
}


def get_existing_columns(cursor, table):
    cursor.execute(f'PRAGMA table_info("{table}")')
    return {row[1] for row in cursor.fetchall()}


def get_existing_tables(cursor):
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    return {row[0] for row in cursor.fetchall()}


def add_column(cursor, table, col_name, col_def):
    print(f"  + Adding column `{col_name}` to `{table}` ...")
    cursor.execute(f'ALTER TABLE "{table}" ADD COLUMN "{col_name}" {col_def}')


def create_table(cursor, table, spec):
    cols = ",\n  ".join('"{}" {}'.format(n, d) for n, d in spec["columns"])
    unique_clauses = ""
    if "unique" in spec:
        for pair in spec["unique"]:
            cols_quoted = ", ".join('"{}"'.format(c) for c in pair)
            unique_clauses += ",\n  UNIQUE({})".format(cols_quoted)
    sql = 'CREATE TABLE IF NOT EXISTS "{}" (\n  {}{}\n)'.format(table, cols, unique_clauses)
    cursor.execute(sql)
    print("  + Created table `{}`".format(table))


def migrate():
    if not os.path.exists(DB_PATH):
        print(f"[!] Database not found at {DB_PATH}")
        print("    The app will create it on first run. No migration needed.")
        sys.stdout.flush()
        return

    print(f"[*] Opening database: {DB_PATH}")
    print("[*] Migration in progress...")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    existing_tables = get_existing_tables(cursor)
    changes = 0

    for table, spec in TABLES.items():
        if table in existing_tables:
            existing = get_existing_columns(cursor, table)
            for col_name, col_def in spec["columns"]:
                if col_name not in existing and col_name != "id":
                    add_column(cursor, table, col_name, col_def)
                    changes += 1
            if changes > 0:
                pass  # message already printed per column
        else:
            create_table(cursor, table, spec)
            changes += 1

    conn.commit()
    conn.close()

    if changes == 0:
        print("[OK] Database schema is up to date. No changes made.")
    else:
        print(f"[OK] Migration complete -- {changes} change(s) applied. All data preserved.")


if __name__ == "__main__":
    migrate()
