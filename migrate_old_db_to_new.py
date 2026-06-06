"""
Migration helper: copy data from an old SQLite DB into a new DB file
that includes the latest models (admin fields, knowledge items, group chat tables).

Usage:
  python migrate_old_db_to_new.py --old site.db --new site_new.db

Notes:
- This does NOT modify the old DB.
- It copies only tables that exist in the old DB.
- New tables will be empty (unless their data can be derived).
"""

from __future__ import annotations

import argparse
import os
import sqlite3
from datetime import datetime


def table_exists(conn: sqlite3.Connection, table: str) -> bool:
    cur = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
        (table,),
    )
    return cur.fetchone() is not None


def columns(conn: sqlite3.Connection, table: str) -> list[str]:
    cur = conn.execute(f"PRAGMA table_info({table})")
    return [r[1] for r in cur.fetchall()]


def copy_table(old: sqlite3.Connection, new: sqlite3.Connection, table: str, extra_defaults: dict[str, object] | None = None):
    extra_defaults = extra_defaults or {}
    old_cols = columns(old, table)
    new_cols = columns(new, table)
    common = [c for c in old_cols if c in new_cols]
    if not common:
        return

    cur = old.execute(f"SELECT {', '.join(common)} FROM {table}")
    rows = cur.fetchall()
    if not rows:
        return

    # Build insert with optional defaults for new-only columns
    insert_cols = common[:]
    for c in new_cols:
        if c not in insert_cols and c in extra_defaults:
            insert_cols.append(c)

    placeholders = ", ".join(["?"] * len(insert_cols))
    sql = f"INSERT INTO {table} ({', '.join(insert_cols)}) VALUES ({placeholders})"

    out_rows = []
    for r in rows:
        r_map = dict(zip(common, r))
        for k, v in extra_defaults.items():
            if k in insert_cols and k not in r_map:
                r_map[k] = v
        out_rows.append(tuple(r_map.get(c) for c in insert_cols))

    new.executemany(sql, out_rows)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--old", default="site.db", help="Old sqlite database path")
    ap.add_argument("--new", default="site_new.db", help="New sqlite database path to create")
    args = ap.parse_args()

    old_path = os.path.abspath(args.old)
    new_path = os.path.abspath(args.new)
    if not os.path.exists(old_path):
        raise SystemExit(f"Old DB not found: {old_path}")
    if os.path.exists(new_path):
        raise SystemExit(f"New DB already exists: {new_path}")

    # Create new DB by importing app + running db.create_all()
    from app import create_app, db  # noqa

    app = create_app()
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///" + new_path
    with app.app_context():
        db.drop_all()
        db.create_all()

    old = sqlite3.connect(old_path)
    new = sqlite3.connect(new_path)
    old.row_factory = sqlite3.Row

    # Copy core tables if they exist
    for table in ["user", "note", "task", "event", "event_attachment", "chat", "chat_message", "user_message"]:
        if table_exists(old, table) and table_exists(new, table):
            # Defaults for new columns that didn't exist previously
            defaults = {}
            if table == "user":
                # new field is_admin may not exist in old DB
                defaults["is_admin"] = 0
            copy_table(old, new, table, defaults)

    new.commit()
    old.close()
    new.close()

    print("Done.")
    print(f"Old: {old_path}")
    print(f"New: {new_path}")
    print("New tables (knowledge/group chat) will be empty and ready to use.")


if __name__ == "__main__":
    main()

