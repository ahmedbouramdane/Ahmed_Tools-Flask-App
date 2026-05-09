from app import create_app, socketio
import os
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass
app = create_app()

if __name__ == "__main__":
    import migrate_db
    migrate_db.migrate()

    with app.app_context():
        from app.models import db
        db.create_all()
    socketio.run(app, debug=True, allow_unsafe_werkzeug=True)