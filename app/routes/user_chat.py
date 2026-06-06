from flask import Blueprint, render_template, request, jsonify, abort
from flask_login import login_required, current_user
from flask_socketio import emit, join_room, leave_room
from app.models import User, UserMessage, ChatGroup, GroupMember, GroupMessage, db
from app import socketio
from sqlalchemy import text as sql_text
import os, uuid
from werkzeug.utils import secure_filename
from app.config import Config

user_chat_bp = Blueprint('user_chat', __name__)

# Track online users: { user_id: set_of_sids }
online_users = {}

# ─── Page ───────────────────────────────────────────────────────────────────

@user_chat_bp.route("/user_chat")
@login_required
def user_chat():
    return render_template("user_chat.html")


@user_chat_bp.route("/chat/start/<int:user_id>")
@login_required
def start_chat(user_id):
    """Start a chat with a specific user"""
    if user_id == current_user.id:
        return redirect(url_for('user_chat.user_chat'))
    
    # Check if user exists
    other_user = User.query.get(user_id)
    if not other_user:
        abort(404)
    
    # Redirect to user chat with that user selected
    return redirect(url_for('user_chat.user_chat') + f'?chat={user_id}')

# ─── Conversations (unified: users + groups) ────────────────────────────────

@user_chat_bp.route("/user_chat/conversations")
@login_required
def get_conversations():
    uid = current_user.id

    # DM conversations
    rows = db.session.execute(sql_text("""
        SELECT DISTINCT
            CASE WHEN sender_id = :uid THEN receiver_id ELSE sender_id END AS other_id
        FROM user_message
        WHERE sender_id = :uid OR receiver_id = :uid
    """), {"uid": uid}).fetchall()

    other_ids = [row[0] for row in rows]

    # Batch-load all DM users in one query
    users_map = {}
    if other_ids:
        for u in User.query.filter(User.id.in_(other_ids)).all():
            users_map[u.id] = u

    # Batch-load unread counts per sender
    unread_counts = dict(db.session.query(
        UserMessage.sender_id, db.func.count(UserMessage.id)
    ).filter(
        UserMessage.receiver_id == uid,
        UserMessage.is_read == False
    ).group_by(UserMessage.sender_id).all())

    dm_list = []
    for other_id in other_ids:
        other = users_map.get(other_id)
        if not other:
            continue
        last_msg = UserMessage.query.filter(
            ((UserMessage.sender_id == uid) & (UserMessage.receiver_id == other_id)) |
            ((UserMessage.sender_id == other_id) & (UserMessage.receiver_id == uid))
        ).order_by(UserMessage.created_at.desc()).first()

        last_content = last_msg.content[:80] + "..." if last_msg and len(last_msg.content) > 80 else (last_msg.content if last_msg else "")

        dm_list.append({
            "type": "user",
            "id": other_id,
            "name": other.username,
            "avatar_url": other.avatar_url or "",
            "last_message": last_content,
            "last_message_time": last_msg.created_at.isoformat() if last_msg else "",
            "last_message_sender": "You" if last_msg and last_msg.sender_id == uid else (other.username if last_msg else ""),
            "unread": unread_counts.get(other_id, 0),
            "is_online": other_id in online_users
        })

    # Group conversations
    memberships = GroupMember.query.filter_by(user_id=uid).all()
    group_ids = [m.group_id for m in memberships]
    group_list = []
    if group_ids:
        groups = ChatGroup.query.filter(ChatGroup.id.in_(group_ids)).all()

        # Batch-load member counts for all groups (avoids lazy `len(g.members)`)
        member_counts = dict(db.session.query(
            GroupMember.group_id, db.func.count(GroupMember.id)
        ).filter(GroupMember.group_id.in_(group_ids)).group_by(GroupMember.group_id).all())

        for g in groups:
            last_msg = GroupMessage.query.filter_by(group_id=g.id).order_by(GroupMessage.created_at.desc()).first()
            last_content = last_msg.content[:80] + "..." if last_msg and len(last_msg.content) > 80 else (last_msg.content if last_msg else "")
            sender_name = ""
            if last_msg and last_msg.sender:
                sender_name = "You" if last_msg.sender_id == uid else last_msg.sender.username

            group_list.append({
                "type": "group",
                "id": g.id,
                "name": g.name,
                "avatar_url": g.avatar_url or "",
                "last_message": last_content,
                "last_message_time": last_msg.created_at.isoformat() if last_msg else g.created_at.isoformat(),
                "last_message_sender": sender_name,
                "unread": 0,
                "member_count": member_counts.get(g.id, 0)
            })

    conversations = dm_list + group_list
    conversations.sort(key=lambda c: c.get("last_message_time", ""), reverse=True)
    return jsonify(conversations)

# ─── DM Messages ────────────────────────────────────────────────────────────

@user_chat_bp.route("/user_chat/messages/<int:user_id>")
@login_required
def get_messages(user_id):
    if user_id == current_user.id:
        return jsonify([])
    offset = request.args.get('offset', 0, type=int)
    limit = request.args.get('limit', 30, type=int)

    total = UserMessage.query.filter(
        ((UserMessage.sender_id == current_user.id) & (UserMessage.receiver_id == user_id)) |
        ((UserMessage.sender_id == user_id) & (UserMessage.receiver_id == current_user.id))
    ).count()

    messages = UserMessage.query.filter(
        ((UserMessage.sender_id == current_user.id) & (UserMessage.receiver_id == user_id)) |
        ((UserMessage.sender_id == user_id) & (UserMessage.receiver_id == current_user.id))
    ).order_by(UserMessage.created_at.desc()).offset(offset).limit(limit).all()
    messages.reverse()

    # Mark unread as read
    unread = UserMessage.query.filter(
        UserMessage.sender_id == user_id,
        UserMessage.receiver_id == current_user.id,
        UserMessage.is_read == False
    ).update({UserMessage.is_read: True})
    if unread:
        db.session.commit()
        socketio.emit('unread_update', {'user_id': current_user.id}, room=f"user_{current_user.id}")

    data = [{
        "id": m.id,
        "content": m.content,
        "attachment_url": m.attachment_url,
        "attachment_type": m.attachment_type,
        "sender_id": m.sender_id,
        "created_at": m.created_at.isoformat()
    } for m in messages]
    return jsonify({"messages": data, "total": total, "has_more": offset + limit < total})

# ─── Group Messages ─────────────────────────────────────────────────────────

@user_chat_bp.route("/user_chat/group/<int:group_id>/messages")
@login_required
def get_group_messages(group_id):
    role = GroupMember.query.filter_by(group_id=group_id, user_id=current_user.id).first()
    if not role:
        abort(403)
    offset = request.args.get('offset', 0, type=int)
    limit = request.args.get('limit', 30, type=int)

    total = GroupMessage.query.filter_by(group_id=group_id).count()
    messages = GroupMessage.query.filter_by(group_id=group_id).order_by(
        GroupMessage.created_at.desc()
    ).offset(offset).limit(limit).all()
    messages.reverse()

    data = []
    for m in messages:
        s = User.query.get(m.sender_id)
        data.append({
            "id": m.id,
            "sender_id": m.sender_id,
            "sender_name": s.username if s else "Unknown",
            "sender_avatar": s.avatar_url if s else "",
            "content": m.content,
            "attachment_url": m.attachment_url,
            "attachment_type": m.attachment_type,
            "created_at": m.created_at.isoformat()
        })
    return jsonify({"messages": data, "total": total, "has_more": offset + limit < total})

# ─── Group Details ──────────────────────────────────────────────────────────

@user_chat_bp.route("/user_chat/group/<int:group_id>")
@login_required
def get_group_detail(group_id):
    g = ChatGroup.query.get_or_404(group_id)
    role = GroupMember.query.filter_by(group_id=group_id, user_id=current_user.id).first()
    if not role:
        abort(403)
    members = GroupMember.query.filter_by(group_id=group_id).order_by(GroupMember.joined_at).all()
    member_list = []
    for m in members:
        u = User.query.get(m.user_id)
        if u:
            member_list.append({
                "id": u.id,
                "username": u.username,
                "avatar_url": u.avatar_url or "",
                "role": m.role,
                "joined_at": m.joined_at.isoformat()
            })
    return jsonify({
        "group": {
            "id": g.id,
            "name": g.name,
            "description": g.description,
            "avatar_url": g.avatar_url or "",
            "owner_id": g.owner_id,
            "member_count": len(g.members),
            "created_at": g.created_at.isoformat()
        },
        "members": member_list,
        "my_role": role.role
    })

# ─── Send Group Message ────────────────────────────────────────────────────

@user_chat_bp.route("/user_chat/group/<int:group_id>/send", methods=["POST"])
@login_required
def send_group_message(group_id):
    role = GroupMember.query.filter_by(group_id=group_id, user_id=current_user.id).first()
    if not role:
        abort(403)
    data = request.json
    content = (data.get("content") or "").strip()
    if not content:
        return jsonify({"error": "Message empty"}), 400
    msg = GroupMessage(group_id=group_id, sender_id=current_user.id, content=content)
    db.session.add(msg)
    db.session.commit()

    payload = {
        "id": msg.id,
        "group_id": group_id,
        "sender_id": current_user.id,
        "sender_name": current_user.username,
        "sender_avatar": current_user.avatar_url or "",
        "content": content,
        "created_at": msg.created_at.isoformat()
    }
    socketio.emit("group_message", payload, room=f"group_{group_id}")
    return jsonify(payload)

# ─── Group management ──────────────────────────────────────────────────────

@user_chat_bp.route("/user_chat/group/create", methods=["POST"])
@login_required
def create_group():
    data = request.json
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Group name required"}), 400
    g = ChatGroup(name=name, description=data.get("description", ""), owner_id=current_user.id)
    db.session.add(g)
    db.session.flush()
    m = GroupMember(group_id=g.id, user_id=current_user.id, role="owner")
    db.session.add(m)
    db.session.commit()
    return jsonify({
        "id": g.id, "name": g.name, "description": g.description,
        "avatar_url": g.avatar_url or "", "owner_id": g.owner_id,
        "member_count": 1, "created_at": g.created_at.isoformat()
    })

@user_chat_bp.route("/user_chat/group/<int:group_id>/members", methods=["POST"])
@login_required
def add_group_member(group_id):
    membership = GroupMember.query.filter_by(group_id=group_id, user_id=current_user.id).first()
    if not membership or membership.role not in ("owner", "admin"):
        abort(403)
    data = request.json
    user_id = data.get("user_id")
    if not user_id:
        return jsonify({"error": "user_id required"}), 400
    existing = GroupMember.query.filter_by(group_id=group_id, user_id=user_id).first()
    if existing:
        return jsonify({"error": "Already a member"}), 400
    m = GroupMember(group_id=group_id, user_id=user_id, role="member")
    db.session.add(m)
    db.session.commit()
    u = User.query.get(user_id)
    return jsonify({"id": u.id, "username": u.username, "avatar_url": u.avatar_url or "", "role": "member"})

@user_chat_bp.route("/user_chat/group/<int:group_id>/members/<int:user_id>", methods=["DELETE"])
@login_required
def remove_group_member(group_id, user_id):
    membership = GroupMember.query.filter_by(group_id=group_id, user_id=current_user.id).first()
    if not membership or membership.role not in ("owner", "admin"):
        abort(403)
    target = GroupMember.query.filter_by(group_id=group_id, user_id=user_id).first()
    if not target:
        return jsonify({"error": "Not a member"}), 404
    if target.role == "owner":
        return jsonify({"error": "Cannot remove owner"}), 403
    db.session.delete(target)
    db.session.commit()
    return jsonify({"success": True})

@user_chat_bp.route("/user_chat/group/<int:group_id>/leave", methods=["POST"])
@login_required
def leave_group(group_id):
    m = GroupMember.query.filter_by(group_id=group_id, user_id=current_user.id).first()
    if not m:
        abort(404)
    if m.role == "owner":
        return jsonify({"error": "Owner cannot leave"}), 403
    db.session.delete(m)
    db.session.commit()
    return jsonify({"success": True})

@user_chat_bp.route("/user_chat/group/<int:group_id>", methods=["DELETE"])
@login_required
def delete_group(group_id):
    g = ChatGroup.query.get_or_404(group_id)
    if g.owner_id != current_user.id:
        abort(403)
    db.session.delete(g)
    db.session.commit()
    return jsonify({"success": True})

@user_chat_bp.route("/user_chat/group/<int:group_id>/rename", methods=["PUT"])
@login_required
def rename_group(group_id):
    membership = GroupMember.query.filter_by(group_id=group_id, user_id=current_user.id).first()
    if not membership or membership.role not in ("owner", "admin"):
        abort(403)
    data = request.json
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Name required"}), 400
    g = ChatGroup.query.get_or_404(group_id)
    g.name = name
    db.session.commit()
    return jsonify({"success": True, "name": name})

@user_chat_bp.route("/user_chat/group/<int:group_id>/avatar", methods=["POST"])
@login_required
def upload_group_avatar(group_id):
    membership = GroupMember.query.filter_by(group_id=group_id, user_id=current_user.id).first()
    if not membership or membership.role not in ("owner", "admin"):
        abort(403)
    if 'file' not in request.files:
        return jsonify({"error": "No file"}), 400
    file = request.files['file']
    if not file.filename:
        return jsonify({"error": "Empty file"}), 400
    filename = secure_filename(file.filename)
    ext = filename.rsplit('.', 1)[1].lower() if '.' in filename else ''
    unique_name = f"group_avatar_{uuid.uuid4().hex}.{ext}"
    os.makedirs(Config.UPLOAD_FOLDER, exist_ok=True)
    file.save(os.path.join(Config.UPLOAD_FOLDER, unique_name))
    url = f"/static/uploads/{unique_name}"
    g = ChatGroup.query.get_or_404(group_id)
    g.avatar_url = url
    db.session.commit()
    return jsonify({"success": True, "avatar_url": url})

@user_chat_bp.route("/user_chat/group/<int:group_id>/members/<int:user_id>/role", methods=["PUT"])
@login_required
def update_member_role(group_id, user_id):
    g = ChatGroup.query.get_or_404(group_id)
    if g.owner_id != current_user.id:
        abort(403)
    data = request.json
    new_role = data.get("role")
    if new_role not in ("admin", "member"):
        return jsonify({"error": "Invalid role"}), 400
    target = GroupMember.query.filter_by(group_id=group_id, user_id=user_id).first()
    if not target:
        return jsonify({"error": "Not a member"}), 404
    if target.role == "owner":
        return jsonify({"error": "Cannot change owner"}), 403
    target.role = new_role
    db.session.commit()
    return jsonify({"success": True, "role": new_role})

@user_chat_bp.route("/user_chat/group/<int:group_id>/transfer/<int:user_id>", methods=["POST"])
@login_required
def transfer_ownership(group_id, user_id):
    g = ChatGroup.query.get_or_404(group_id)
    if g.owner_id != current_user.id:
        abort(403)
    target = GroupMember.query.filter_by(group_id=group_id, user_id=user_id).first()
    if not target:
        return jsonify({"error": "Not a member"}), 404
    if target.user_id == current_user.id:
        return jsonify({"error": "Already the owner"}), 400
    current_member = GroupMember.query.filter_by(group_id=group_id, user_id=current_user.id).first()
    if current_member:
        current_member.role = "admin"
    g.owner_id = user_id
    target.role = "owner"
    db.session.commit()
    return jsonify({"success": True, "new_owner_id": user_id})

@user_chat_bp.route("/user_chat/group/<int:group_id>/candidates")
@login_required
def member_candidates(group_id):
    membership = GroupMember.query.filter_by(group_id=group_id, user_id=current_user.id).first()
    if not membership or membership.role not in ("owner", "admin"):
        abort(403)
    q = request.args.get("q", "")
    existing = [m.user_id for m in GroupMember.query.filter_by(group_id=group_id).all()]
    users = User.query.filter(
        User.id != current_user.id,
        ~User.id.in_(existing),
        User.email_verified == True
    )
    if q:
        users = users.filter(User.username.ilike(f"%{q}%"))
    users = users.limit(20).all()
    return jsonify([{"id": u.id, "username": u.username, "avatar_url": u.avatar_url or ""} for u in users])

# ─── Unread ─────────────────────────────────────────────────────────────────

@user_chat_bp.route("/user_chat/unread")
@login_required
def unread_count():
    total = UserMessage.query.filter_by(receiver_id=current_user.id, is_read=False).count()
    by_user = db.session.query(
        UserMessage.sender_id, db.func.count(UserMessage.id)
    ).filter(
        UserMessage.receiver_id == current_user.id,
        UserMessage.is_read == False
    ).group_by(UserMessage.sender_id).all()
    return jsonify({"total": total, "by_user": {str(uid): count for uid, count in by_user}})

# ─── Upload ─────────────────────────────────────────────────────────────────

@user_chat_bp.route('/user_chat/upload', methods=['POST'])
@login_required
def upload_chat_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'Empty file'}), 400
    filename = secure_filename(file.filename)
    ext = filename.rsplit('.', 1)[1].lower() if '.' in filename else ''
    unique_name = f"{uuid.uuid4().hex}.{ext}"
    os.makedirs(Config.UPLOAD_FOLDER, exist_ok=True)
    file.save(os.path.join(Config.UPLOAD_FOLDER, unique_name))
    url = f"/static/uploads/{unique_name}"
    file_type = 'image' if ext in ['jpg', 'jpeg', 'png', 'gif', 'webp'] else 'file'
    return jsonify({'url': url, 'type': file_type, 'original_name': filename})

# ─── Users list ─────────────────────────────────────────────────────────────

@user_chat_bp.route('/user_chat/users')
@login_required
def get_users():
    search = request.args.get('search', '')
    users = User.query.filter(
        User.id != current_user.id, User.email_verified == True,
        User.username.ilike(f'%{search}%')
    ).all()
    return jsonify([{
        'id': u.id, 'username': u.username, 'email': u.email,
        'avatar_url': u.avatar_url or ''
    } for u in users])

@user_chat_bp.route('/user_chat/online')
@login_required
def get_online_users():
    return jsonify(list(online_users.keys()))

# ─── Socket.IO Events ──────────────────────────────────────────────────────

@socketio.on('join')
def on_join(data):
    try:
        room = data.get('room')
        if not room:
            return {'success': False, 'error': 'Room required'}
        join_room(room)
        return {'success': True, 'message': 'Joined room successfully'}
    except Exception as e:
        return {'success': False, 'error': str(e)}

@socketio.on('go_online')
def handle_go_online():
    try:
        uid = current_user.id
        sid = request.sid
        if uid not in online_users:
            online_users[uid] = set()
        online_users[uid].add(sid)
        # Broadcast user is online
        emit('user_online', {
            'user_id': uid,
            'username': current_user.username,
            'avatar_url': current_user.avatar_url or '',
            'timestamp': __import__('datetime').datetime.utcnow().isoformat()
        }, broadcast=True, skip_sid=sid)
        # Notify user of current online users count
        return {'success': True, 'online_count': len(online_users)}
    except Exception as e:
        return {'success': False, 'error': str(e)}

@socketio.on('disconnect')
def handle_disconnect():
    try:
        uid = current_user.id
        sid = request.sid
        if uid in online_users:
            online_users[uid].discard(sid)
            if not online_users[uid]:
                del online_users[uid]
                # Broadcast user is offline
                emit('user_offline', {
                    'user_id': uid,
                    'username': current_user.username,
                    'timestamp': __import__('datetime').datetime.utcnow().isoformat()
                }, broadcast=True)
    except Exception:
        pass

@socketio.on('send_message')
def handle_send_message(data, callback=None):
    try:
        receiver_id = data.get('receiver_id')
        content = (data.get('content') or '').strip()
        attachment_url = data.get('attachment_url')
        attachment_type = data.get('attachment_type')

        if not receiver_id or (not content and not attachment_url):
            if callback:
                callback({'success': False, 'error': 'Content or attachment required'})
            return

        # Prevent self-messaging
        if receiver_id == current_user.id:
            if callback:
                callback({'success': False, 'error': 'Cannot message yourself'})
            return

        receiver = User.query.get(receiver_id)
        if not receiver:
            if callback:
                callback({'success': False, 'error': 'Receiver not found'})
            return

        message = UserMessage(
            sender_id=current_user.id, 
            receiver_id=receiver_id,
            content=content, 
            attachment_url=attachment_url,
            attachment_type=attachment_type
        )
        db.session.add(message)
        db.session.commit()

        payload = {
            'id': message.id, 
            'content': content,
            'attachment_url': attachment_url, 
            'attachment_type': attachment_type,
            'sender_id': current_user.id, 
            'sender_name': current_user.username,
            'sender_avatar': current_user.avatar_url or '',
            'receiver_id': receiver_id,
            'created_at': message.created_at.isoformat(),
            'is_read': False
        }

        # Send to both parties
        emit('receive_message', payload, room=f"user_{receiver_id}")
        emit('receive_message', payload, room=f"user_{current_user.id}")
        
        # Trigger unread update
        emit('unread_update', {'user_id': receiver_id}, room=f"user_{receiver_id}")
        
        # Send notification if receiver has notifications enabled
        if receiver.notifications_enabled and receiver_id in online_users:
            emit('notification', {
                'type': 'message',
                'title': f"New message from {current_user.username}",
                'body': content[:100] if content else 'Sent an attachment',
                'from_user_id': current_user.id,
                'from_user_name': current_user.username,
                'from_user_avatar': current_user.avatar_url or '',
                'sound_url': receiver.notification_sound_url if receiver.notification_sound_enabled else None
            }, room=f"user_{receiver_id}")
        
        # Acknowledge success
        if callback:
            callback({'success': True, 'message_id': message.id})
    
    except Exception as e:
        if callback:
            callback({'success': False, 'error': str(e)})

@socketio.on('typing')
def handle_typing(data):
    try:
        receiver_id = data.get('receiver_id')
        if not receiver_id:
            return
        
        emit('user_typing', {
            'sender_id': current_user.id,
            'sender_name': current_user.username,
            'timestamp': __import__('datetime').datetime.utcnow().isoformat()
        }, room=f"user_{receiver_id}", skip_sid=request.sid)
        
        return {'success': True}
    except Exception as e:
        return {'success': False, 'error': str(e)}

@socketio.on('stop_typing')
def handle_stop_typing(data):
    try:
        receiver_id = data.get('receiver_id')
        if not receiver_id:
            return
        
        emit('user_stop_typing', {
            'sender_id': current_user.id,
            'timestamp': __import__('datetime').datetime.utcnow().isoformat()
        }, room=f"user_{receiver_id}", skip_sid=request.sid)
        
        return {'success': True}
    except Exception as e:
        return {'success': False, 'error': str(e)}

@socketio.on('mark_as_read')
def handle_mark_as_read(data):
    try:
        sender_id = data.get('sender_id')
        if not sender_id:
            return {'success': False, 'error': 'Sender ID required'}
        
        # Mark all messages from sender as read
        unread = UserMessage.query.filter(
            UserMessage.sender_id == sender_id,
            UserMessage.receiver_id == current_user.id,
            UserMessage.is_read == False
        ).update({UserMessage.is_read: True})
        
        if unread:
            db.session.commit()
            # Notify sender that messages were read
            emit('messages_read', {
                'reader_id': current_user.id,
                'reader_name': current_user.username
            }, room=f"user_{sender_id}")
        
        return {'success': True, 'marked': unread}
    except Exception as e:
        return {'success': False, 'error': str(e)}

@socketio.on('edit_message')
def handle_edit_message(data):
    try:
        msg_id = data.get('id')
        new_content = (data.get('content') or '').strip()
        
        if not msg_id or not new_content:
            return {'success': False, 'error': 'Message ID and content required'}
        
        message = UserMessage.query.get(msg_id)
        if not message:
            return {'success': False, 'error': 'Message not found'}
        
        if message.sender_id != current_user.id:
            return {'success': False, 'error': 'Unauthorized'}
        
        message.content = new_content
        message.edited_at = __import__('datetime').datetime.utcnow()
        db.session.commit()
        
        payload = {
            'id': message.id,
            'content': new_content,
            'edited_at': message.edited_at.isoformat() if hasattr(message, 'edited_at') else None
        }
        
        emit('message_edited', payload, room=f"user_{message.receiver_id}")
        emit('message_edited', payload, room=f"user_{current_user.id}")
        
        return {'success': True}
    except Exception as e:
        return {'success': False, 'error': str(e)}

@socketio.on('delete_message')
def handle_delete_message(data):
    try:
        msg_id = data.get('id')
        
        if not msg_id:
            return {'success': False, 'error': 'Message ID required'}
        
        message = UserMessage.query.get(msg_id)
        if not message:
            return {'success': False, 'error': 'Message not found'}
        
        if message.sender_id != current_user.id:
            return {'success': False, 'error': 'Unauthorized'}
        
        receiver_id = message.receiver_id
        db.session.delete(message)
        db.session.commit()
        
        payload = {'id': msg_id}
        emit('message_deleted', payload, room=f"user_{receiver_id}")
        emit('message_deleted', payload, room=f"user_{current_user.id}")
        
        return {'success': True}
    except Exception as e:
        return {'success': False, 'error': str(e)}

@socketio.on('group_join')
def handle_group_join(data):
    try:
        group_id = data.get('group_id')
        if not group_id:
            return {'success': False, 'error': 'Group ID required'}
        
        # Verify membership
        membership = GroupMember.query.filter_by(
            group_id=group_id,
            user_id=current_user.id
        ).first()
        
        if not membership:
            return {'success': False, 'error': 'Not a member of this group'}
        
        join_room(f"group_{group_id}")
        
        # Notify group that user joined
        emit('user_joined_group', {
            'group_id': group_id,
            'user_id': current_user.id,
            'username': current_user.username,
            'timestamp': __import__('datetime').datetime.utcnow().isoformat()
        }, room=f"group_{group_id}", skip_sid=request.sid)
        
        return {'success': True, 'message': 'Joined group'}
    except Exception as e:
        return {'success': False, 'error': str(e)}

@socketio.on('group_leave')
def handle_group_leave(data):
    try:
        group_id = data.get('group_id')
        if not group_id:
            return {'success': False, 'error': 'Group ID required'}
        
        leave_room(f"group_{group_id}")
        
        # Notify group that user left
        emit('user_left_group', {
            'group_id': group_id,
            'user_id': current_user.id,
            'username': current_user.username,
            'timestamp': __import__('datetime').datetime.utcnow().isoformat()
        }, room=f"group_{group_id}")
        
        return {'success': True, 'message': 'Left group'}
    except Exception as e:
        return {'success': False, 'error': str(e)}

@socketio.on('send_group_message')
def handle_send_group_message(data, callback=None):
    try:
        group_id = data.get('group_id')
        content = (data.get('content') or '').strip()
        attachment_url = data.get('attachment_url')
        attachment_type = data.get('attachment_type')
        
        if not group_id or (not content and not attachment_url):
            if callback:
                callback({'success': False, 'error': 'Content or attachment required'})
            return
        
        # Verify membership
        membership = GroupMember.query.filter_by(
            group_id=group_id,
            user_id=current_user.id
        ).first()
        
        if not membership:
            if callback:
                callback({'success': False, 'error': 'Not a member of this group'})
            return
        
        msg = GroupMessage(
            group_id=group_id,
            sender_id=current_user.id,
            content=content,
            attachment_url=attachment_url,
            attachment_type=attachment_type
        )
        db.session.add(msg)
        db.session.commit()
        
        payload = {
            'id': msg.id,
            'group_id': group_id,
            'sender_id': current_user.id,
            'sender_name': current_user.username,
            'sender_avatar': current_user.avatar_url or '',
            'content': content,
            'attachment_url': attachment_url,
            'attachment_type': attachment_type,
            'created_at': msg.created_at.isoformat()
        }
        
        emit('group_message', payload, room=f"group_{group_id}")
        
        # Send notification to group members
        group = ChatGroup.query.get(group_id)
        if group:
            for member in group.members:
                if member.user_id != current_user.id and member.user_id in online_users:
                    user = User.query.get(member.user_id)
                    if user and user.notifications_enabled:
                        emit('notification', {
                            'type': 'group_message',
                            'title': f"{current_user.username} in {group.name}",
                            'body': content[:100] if content else 'Sent an attachment',
                            'from_user_id': current_user.id,
                            'from_group_id': group_id,
                            'sound_url': user.notification_sound_url if user.notification_sound_enabled else None
                        }, room=f"user_{member.user_id}")
        
        if callback:
            callback({'success': True, 'message_id': msg.id})
    except Exception as e:
        if callback:
            callback({'success': False, 'error': str(e)})
