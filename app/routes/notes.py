from flask import Blueprint, render_template, redirect, url_for, request, flash, abort, jsonify
from flask_login import login_required, current_user
from werkzeug.utils import secure_filename
from app.models import Note, NoteShare, User, UserMessage
from app import db, socketio
from app.config import Config
import os, uuid

notes_bp = Blueprint('notes', __name__)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in Config.ALLOWED_EXTENSIONS

@notes_bp.route("/notes")
@login_required
def notes():
    uid = current_user.id
    search = request.args.get("search", "")
    query = Note.query.filter_by(user_id=uid)
    if search:
        query = query.filter(Note.title.ilike(f"%{search}%"))
    notes_list = query.order_by(Note.updated_at.desc()).all()

    shared_share_rows = NoteShare.query.filter_by(shared_with_id=uid).all()
    shared_note_ids = [s.note_id for s in shared_share_rows]
    shared_notes = Note.query.filter(Note.id.in_(shared_note_ids)).all() if shared_note_ids else []

    return render_template("notes.html", notes=notes_list, shared_notes=shared_notes, search=search)

@notes_bp.route("/notes/add", methods=["POST"])
@login_required
def add_note():
    title = request.form.get("title")
    if not title:
        flash("Title required.", "danger")
        return redirect(url_for("notes.notes"))
    note = Note(title=title, content='', user_id=current_user.id)
    db.session.add(note)
    db.session.commit()
    flash("Note created. Click Edit to design it.", "success")
    return redirect(url_for("notes.edit_note", note_id=note.id))

@notes_bp.route("/notes/edit/<int:note_id>", methods=["GET", "POST"])
@login_required
def edit_note(note_id):
    note = Note.query.get_or_404(note_id)
    if note.user_id != current_user.id:
        abort(403)
    if request.method == "POST":
        title = request.form.get("title")
        content = request.form.get("content")
        if not title:
            flash("Title required.", "danger")
            return redirect(url_for("notes.edit_note", note_id=note.id))
        note.title = title
        note.content = content if content else ''
        db.session.commit()
        flash("Note updated.", "success")
        return redirect(url_for("notes.notes"))
    return render_template("edit_note.html", note=note)

@notes_bp.route("/notes/delete/<int:note_id>", methods=["POST"])
@login_required
def delete_note(note_id):
    note = Note.query.get_or_404(note_id)
    if note.user_id != current_user.id:
        abort(403)
    db.session.delete(note)
    db.session.commit()
    flash("Note deleted.", "info")
    return redirect(url_for("notes.notes"))

@notes_bp.route("/notes/upload-image", methods=["POST"])
@login_required
def upload_note_image():
    if 'file' not in request.files:
        return jsonify({'error': 'No file'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'Empty file'}), 400
    if file and allowed_file(file.filename):
        original = secure_filename(file.filename)
        ext = original.rsplit('.', 1)[1].lower()
        unique_name = f"note_{uuid.uuid4().hex}.{ext}"
        os.makedirs(Config.UPLOAD_FOLDER, exist_ok=True)
        file.save(os.path.join(Config.UPLOAD_FOLDER, unique_name))
        from flask import url_for as flask_url_for
        return jsonify({'url': flask_url_for('static', filename=f'uploads/{unique_name}')})
    return jsonify({'error': 'Invalid file type'}), 400

@notes_bp.route("/notes/share/<int:note_id>", methods=["POST"])
@login_required
def share_note(note_id):
    note = Note.query.get_or_404(note_id)
    if note.user_id != current_user.id:
        abort(403)
    data = request.json
    user_id = data.get("user_id")
    permission = data.get("permission", "view")
    if not user_id:
        return jsonify({"error": "User ID required"}), 400
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    if user_id == current_user.id:
        return jsonify({"error": "Cannot share with yourself"}), 400
    existing = NoteShare.query.filter_by(note_id=note_id, shared_with_id=user_id).first()
    if existing:
        existing.permission = permission
        db.session.commit()
        return jsonify({"success": True, "message": f"Permissions updated for {user.username}"})
    share = NoteShare(note_id=note_id, shared_by_id=current_user.id,
                      shared_with_id=user_id, permission=permission)
    db.session.add(share)
    db.session.commit()
    msg = f"📝 *Note shared with you:* {note.title}\n"
    message = UserMessage(sender_id=current_user.id, receiver_id=user_id, content=msg)
    db.session.add(message)
    db.session.commit()
    socketio.emit('receive_message', {
        'id': message.id, 'content': msg,
        'sender_id': current_user.id, 'sender_name': current_user.username,
        'sender_avatar': current_user.avatar_url or '',
        'receiver_id': user_id, 'created_at': message.created_at.isoformat(), 'is_read': False
    }, room=f"user_{user_id}")
    socketio.emit('unread_update', {'user_id': user_id}, room=f"user_{user_id}")
    socketio.emit('note_shared', {
        'note': serialize_note(note),
        'shared_by': current_user.username,
        'shared_by_id': current_user.id
    }, room=f"user_{user_id}")
    return jsonify({"success": True, "message": f"Shared with {user.username}"})

@notes_bp.route("/notes/share/<int:share_id>", methods=["DELETE"])
@login_required
def remove_note_share(share_id):
    share = NoteShare.query.get_or_404(share_id)
    note = Note.query.get(share.note_id)
    if not note or note.user_id != current_user.id:
        abort(403)
    db.session.delete(share)
    db.session.commit()
    socketio.emit('note_share_removed', {
        'note_id': share.note_id,
        'removed_by': current_user.id
    }, room=f"user_{share.shared_with_id}")
    return jsonify({"success": True})

@notes_bp.route("/notes/<int:note_id>/shares")
@login_required
def get_note_shares(note_id):
    note = Note.query.get_or_404(note_id)
    if note.user_id != current_user.id:
        abort(403)
    shares = NoteShare.query.filter_by(note_id=note_id).all()
    return jsonify([{
        "id": s.id, "user_id": s.shared_with_id,
        "username": s.shared_with.username,
        "avatar_url": s.shared_with.avatar_url or "",
        "permission": s.permission,
        "shared_at": s.shared_at.isoformat() if s.shared_at else ""
    } for s in shares])

def serialize_note(note):
    return {
        "id": note.id,
        "title": note.title,
        "content": note.content[:200] if note.content else "",
        "created_at": note.created_at.isoformat() if note.created_at else "",
        "updated_at": note.updated_at.isoformat() if note.updated_at else ""
    }