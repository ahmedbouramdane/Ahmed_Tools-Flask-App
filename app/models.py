import secrets
from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from . import db

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    full_name = db.Column(db.String(120), default='')
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256))
    avatar_url = db.Column(db.String(200), default="")
    bio = db.Column(db.Text, default="")
    cover_url = db.Column(db.String(500), default="")           # cover image URL
    skills = db.Column(db.Text, default="")                     # comma‑separated skills
    linkedin_url = db.Column(db.String(300), default="")
    github_url = db.Column(db.String(300), default="")
    twitter_url = db.Column(db.String(300), default="")
    website_url = db.Column(db.String(300), default="")
    theme = db.Column(db.String(10), default="light")
    font_family = db.Column(db.String(30), default="Inter")
    verification_code = db.Column(db.String(6), nullable=True)
    verification_code_expires = db.Column(db.DateTime, nullable=True)
    email_verified = db.Column(db.Boolean, default=False)
    notification_sound_url = db.Column(db.String(500),
                                       default="https://www.soundjay.com/buttons/sounds/button-09.mp3")
    notifications_enabled = db.Column(db.Boolean, default=True)
    unread_badge_enabled = db.Column(db.Boolean, default=True)
    notification_sound_enabled = db.Column(db.Boolean, default=True)
    default_reminder_minutes = db.Column(db.Integer, default=30)
    notes = db.relationship("Note", backref="author", lazy=True, cascade="all, delete-orphan")
    tasks = db.relationship("Task", backref="author", lazy=True, cascade="all, delete-orphan")
    events = db.relationship("Event", backref="author", lazy=True, cascade="all, delete-orphan")
    chats = db.relationship("Chat", backref="author", lazy=True, cascade="all, delete-orphan")
    owned_groups = db.relationship("ChatGroup", backref="owner", lazy=True, cascade="all, delete-orphan",
                                   foreign_keys="ChatGroup.owner_id")
    group_memberships = db.relationship("GroupMember", backref="user", lazy=True, cascade="all, delete-orphan")


    def set_password(self, password):
        from werkzeug.security import generate_password_hash
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        from werkzeug.security import check_password_hash
        return check_password_hash(self.password_hash, password)

class Note(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text)
    color = db.Column(db.String(7), default="#ffffff")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    shares = db.relationship("NoteShare", backref="note", lazy=True, cascade="all, delete-orphan",
                             foreign_keys="NoteShare.note_id")

class NoteShare(db.Model):
    __tablename__ = "note_share"
    id = db.Column(db.Integer, primary_key=True)
    note_id = db.Column(db.Integer, db.ForeignKey("note.id"), nullable=False)
    shared_by_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    shared_with_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    permission = db.Column(db.String(20), default="view")
    shared_at = db.Column(db.DateTime, default=datetime.utcnow)
    shared_by = db.relationship("User", backref="note_shares_given", foreign_keys=[shared_by_id])
    shared_with = db.relationship("User", backref="note_shares_received", foreign_keys=[shared_with_id])

class Task(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    completed = db.Column(db.Boolean, default=False)
    priority = db.Column(db.String(10), default="medium")
    due_date = db.Column(db.DateTime, nullable=True)
    category = db.Column(db.String(50), default="")
    tags = db.Column(db.Text, default="")
    is_my_day = db.Column(db.Boolean, default=False)
    is_important = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    shares = db.relationship("TaskShare", backref="task", lazy=True, cascade="all, delete-orphan",
                             foreign_keys="TaskShare.task_id")

class TaskShare(db.Model):
    __tablename__ = "task_share"
    id = db.Column(db.Integer, primary_key=True)
    task_id = db.Column(db.Integer, db.ForeignKey("task.id"), nullable=False)
    shared_by_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    shared_with_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    permission = db.Column(db.String(20), default="view")
    shared_at = db.Column(db.DateTime, default=datetime.utcnow)
    shared_by = db.relationship("User", backref="task_shares_given", foreign_keys=[shared_by_id])
    shared_with = db.relationship("User", backref="task_shares_received", foreign_keys=[shared_with_id])

class Event(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    start = db.Column(db.DateTime, nullable=False)
    end = db.Column(db.DateTime, nullable=False)
    all_day = db.Column(db.Boolean, default=False)
    color = db.Column(db.String(7), default="#3788d8")
    location = db.Column(db.String(200), default="")
    repeat_type = db.Column(db.String(20), default="none")  # none, daily, weekly, monthly
    reminder_minutes = db.Column(db.Integer, default=30)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    attachments = db.relationship("EventAttachment", backref="event", lazy=True, cascade="all, delete-orphan")

class EventAttachment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    event_id = db.Column(db.Integer, db.ForeignKey("event.id"), nullable=False)
    filename = db.Column(db.String(255), nullable=False)
    original_filename = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Chat(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), default="New Chat")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    messages = db.relationship("ChatMessage", backref="chat", lazy=True, cascade="all, delete-orphan",
                               order_by="ChatMessage.created_at")

class ChatMessage(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    role = db.Column(db.String(20), nullable=False)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    chat_id = db.Column(db.Integer, db.ForeignKey("chat.id"), nullable=False)

class UserMessage(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    sender_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    receiver_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    content = db.Column(db.Text, nullable=False)
    attachment_url = db.Column(db.String(500), nullable=True)
    attachment_type = db.Column(db.String(50), nullable=True) # e.g. "image", "file"
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_read = db.Column(db.Boolean, default=False)

class ChatGroup(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, default="")
    avatar_url = db.Column(db.String(500), default="")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    owner_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    members = db.relationship("GroupMember", backref="group", lazy=True, cascade="all, delete-orphan")
    messages = db.relationship("GroupMessage", backref="group", lazy=True, cascade="all, delete-orphan",
                               order_by="GroupMessage.created_at")

class GroupMember(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey("chat_group.id"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    role = db.Column(db.String(20), default="member")  # "owner", "admin", "member"
    joined_at = db.Column(db.DateTime, default=datetime.utcnow)
    __table_args__ = (db.UniqueConstraint("group_id", "user_id"),)

class GroupMessage(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey("chat_group.id"), nullable=False)
    sender_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    content = db.Column(db.Text, nullable=False)
    attachment_url = db.Column(db.String(500), nullable=True)
    attachment_type = db.Column(db.String(50), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    sender = db.relationship("User", backref="group_messages")


class Post(db.Model):
    """Social media posts - like Facebook/Instagram posts"""
    __tablename__ = 'posts'
    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.Text, nullable=False)
    image_url = db.Column(db.String(500), nullable=True)  # Main post image
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    visibility = db.Column(db.String(20), default='public')  # public, friends, private
    post_type = db.Column(db.String(20), default='text')  # text, image, video, link
    
    # Relationships
    author = db.relationship('User', backref=db.backref('posts', lazy=True, order_by='Post.created_at.desc()'))
    likes = db.relationship('PostLike', backref='post', lazy=True, cascade='all, delete-orphan')
    comments = db.relationship('PostComment', backref='post', lazy=True, cascade='all, delete-orphan',
                               order_by='PostComment.created_at')
    
    @property
    def reaction_counts(self):
        """Return reaction counts grouped by type"""
        counts = db.session.query(PostReaction.reaction, db.func.count(PostReaction.id)).filter_by(
            post_id=self.id).group_by(PostReaction.reaction).all()
        return {r: c for r, c in counts}
    
    @property
    def total_reactions(self):
        """Return total reaction count"""
        return PostReaction.query.filter_by(post_id=self.id).count()
    
    def user_reaction(self, user_id):
        """Return the reaction type for a given user, or None"""
        r = PostReaction.query.filter_by(post_id=self.id, user_id=user_id).first()
        return r.reaction if r else None


class PostLike(db.Model):
    """Likes on posts"""
    __tablename__ = 'post_likes'
    id = db.Column(db.Integer, primary_key=True)
    post_id = db.Column(db.Integer, db.ForeignKey('posts.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    __table_args__ = (db.UniqueConstraint('post_id', 'user_id'),)
    
    user = db.relationship('User', backref='post_likes')


class PostComment(db.Model):
    """Comments on posts"""
    __tablename__ = 'post_comments'
    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    post_id = db.Column(db.Integer, db.ForeignKey('posts.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    parent_id = db.Column(db.Integer, db.ForeignKey('post_comments.id'), nullable=True)  # For nested replies
    
    author = db.relationship('User', backref='post_comments')
    replies = db.relationship('PostComment', backref=db.backref('parent', remote_side=[id]),
                              cascade='all, delete-orphan')


class PostImage(db.Model):
    __tablename__ = 'post_images'
    id = db.Column(db.Integer, primary_key=True)
    post_id = db.Column(db.Integer, db.ForeignKey('posts.id'), nullable=False)
    image_url = db.Column(db.String(500), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    post = db.relationship('Post', backref=db.backref('images', lazy=True, cascade='all, delete-orphan', order_by='PostImage.created_at'))


class PostReaction(db.Model):
    """Multi-reaction support for posts (like, love, haha, wow, sad, angry)"""
    __tablename__ = 'post_reactions'
    id = db.Column(db.Integer, primary_key=True)
    post_id = db.Column(db.Integer, db.ForeignKey('posts.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    reaction = db.Column(db.String(20), nullable=False)  # like, love, haha, wow, sad, angry
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (db.UniqueConstraint('post_id', 'user_id'),)

    user = db.relationship('User', backref='post_reactions')
    post = db.relationship('Post', backref=db.backref('reactions', lazy=True, cascade='all, delete-orphan'))


class PostNotification(db.Model):
    """Notifications for post actions (like, comment, react, follow)"""
    __tablename__ = 'post_notifications'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)  # recipient
    actor_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)  # who did the action
    post_id = db.Column(db.Integer, db.ForeignKey('posts.id'), nullable=True)
    type = db.Column(db.String(30), nullable=False)  # like, comment, react, follow
    message = db.Column(db.Text, default='')
    is_read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', foreign_keys=[user_id], backref='notifications')
    actor = db.relationship('User', foreign_keys=[actor_id], backref='actions')
    post = db.relationship('Post', backref='notifications')


class Follow(db.Model):
    """Follow relationships between users"""
    __tablename__ = 'follows'
    id = db.Column(db.Integer, primary_key=True)
    follower_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    followed_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    __table_args__ = (db.UniqueConstraint('follower_id', 'followed_id'),)
    
    follower = db.relationship('User', foreign_keys=[follower_id], backref='following')
    followed = db.relationship('User', foreign_keys=[followed_id], backref='followers')
