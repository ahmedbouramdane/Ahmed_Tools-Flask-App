import os
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager
from flask_migrate import Migrate

import warnings
warnings.filterwarnings("ignore", message="authlib.jose module is deprecated")

from authlib.integrations.flask_client import OAuth
from flask_socketio import SocketIO
from .config import Config

from flask_mail import Mail

db = SQLAlchemy()
login_manager = LoginManager()
mail = Mail()          # ← This must be there
socketio = SocketIO()

login_manager.login_view = "auth.login"

def create_app():
    # Set the template and static folders to the project root
    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    app = Flask(__name__,
                template_folder=os.path.join(root_dir, 'templates'),
                static_folder=os.path.join(root_dir, 'static'))
    app.config.from_object(Config)
    mail.init_app(app)

    db.init_app(app)
    login_manager.init_app(app)
    migrate = Migrate(app, db)
    oauth = OAuth(app)
    socketio.init_app(app, cors_allowed_origins="*", async_mode='threading')
    app.socketio = socketio

    google = None
    if app.config.get('GOOGLE_CLIENT_ID') and app.config.get('GOOGLE_CLIENT_SECRET'):
        google = oauth.register(
            name='google',
            client_id=app.config['GOOGLE_CLIENT_ID'],
            client_secret=app.config['GOOGLE_CLIENT_SECRET'],
            server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
            client_kwargs={
                'scope': 'openid email profile'
            }
        )
    app.google = google

    # Import models (needed for create_all)
    from . import models

    # Register SocketIO namespaces
    from .terminal_handler import TerminalNamespace
    socketio.on_namespace(TerminalNamespace('/terminal'))
    
    # Register posts socket handlers (must be after socketio.init_app)
    from .socket_handlers import posts_ns

    # Register blueprints
    from .routes.auth import auth_bp
    from .routes.dashboard import dashboard_bp
    from .routes.notes import notes_bp
    from .routes.tasks import tasks_bp
    from .routes.calendar import calendar_bp
    from .routes.chat import chat_bp
    from .routes.profile import profile_bp
    from .routes.settings import settings_bp
    from .routes.user_chat import user_chat_bp
    from .routes.group_chat import group_chat_bp
    from .routes.tools import tools_bp
    from .routes.posts import posts_bp
    from .routes.ide import ide_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(notes_bp)
    app.register_blueprint(tasks_bp)
    app.register_blueprint(calendar_bp)
    app.register_blueprint(chat_bp)
    app.register_blueprint(profile_bp)
    app.register_blueprint(settings_bp)
    app.register_blueprint(user_chat_bp)
    app.register_blueprint(group_chat_bp)
    app.register_blueprint(tools_bp)
    app.register_blueprint(posts_bp)
    app.register_blueprint(ide_bp)

    # User loader
    @login_manager.user_loader
    def load_user(user_id):
        return models.User.query.get(int(user_id))
        # Create tables if they don't exist

    with app.app_context():
        db.create_all()
    return app