from app import create_app, socketio
import os
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

if __name__ == "__main__":
    import migrate_db
    migrate_db.migrate()
    app = create_app()
    socketio.run(app, debug=True, allow_unsafe_werkzeug=True)
else:
    app = create_app()
