from flask import Blueprint, render_template, request, jsonify, abort, redirect, url_for
from flask_login import login_required, current_user
from app.models import db, ChatGroup, GroupMember, GroupMessage, User
from app import socketio
from flask_socketio import emit, join_room, leave_room

group_chat_bp = Blueprint('group_chat', __name__)

# ─── Helper ────────────────────────────────────────────────────────────────────

def get_user_role(group_id, user_id):
    m = GroupMember.query.filter_by(group_id=group_id, user_id=user_id).first()
    return m.role if m else None

def group_to_json(g):
    return {
        "id": g.id,
        "name": g.name,
        "description": g.description,
        "avatar_url": g.avatar_url,
        "created_at": g.created_at.isoformat(),
        "owner_id": g.owner_id,
        "member_count": len(g.members),
        "last_message": (g.messages[-1].content[:80] + '...') if g.messages else ""
    }

# ─── HTML page ─────────────────────────────────────────────────────────────────

@group_chat_bp.route("/groups")
@login_required
def groups_page():
    return redirect(url_for('user_chat.user_chat'))

# ─── API: list user's groups ───────────────────────────────────────────────────

@group_chat_bp.route("/api/groups")
@login_required
def list_groups():
    memberships = GroupMember.query.filter_by(user_id=current_user.id).all()
    group_ids = [m.group_id for m in memberships]
    groups = ChatGroup.query.filter(ChatGroup.id.in_(group_ids)).order_by(ChatGroup.created_at.desc()).all()
    return jsonify([group_to_json(g) for g in groups])

# ─── API: create group ─────────────────────────────────────────────────────────

@group_chat_bp.route("/api/groups/create", methods=["POST"])
@login_required
def create_group():
    data = request.json
    name = data.get("name", "").strip()
    if not name:
        return jsonify({"error": "Group name required"}), 400
    g = ChatGroup(name=name, description=data.get("description", ""), owner_id=current_user.id)
    db.session.add(g)
    db.session.flush()
    m = GroupMember(group_id=g.id, user_id=current_user.id, role="owner")
    db.session.add(m)
    db.session.commit()
    return jsonify(group_to_json(g))

# ─── API: get group details + messages ─────────────────────────────────────────

@group_chat_bp.route("/api/groups/<int:group_id>")
@login_required
def get_group(group_id):
    g = ChatGroup.query.get_or_404(group_id)
    role = get_user_role(group_id, current_user.id)
    if not role:
        abort(403)
    messages = GroupMessage.query.filter_by(group_id=group_id).order_by(GroupMessage.created_at).all()
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
    msg_list = []
    for m in messages:
        s = User.query.get(m.sender_id)
        msg_list.append({
            "id": m.id,
            "sender_id": m.sender_id,
            "sender_name": s.username if s else "Unknown",
            "sender_avatar": s.avatar_url if s else "",
            "content": m.content,
            "attachment_url": m.attachment_url,
            "attachment_type": m.attachment_type,
            "created_at": m.created_at.isoformat()
        })
    return jsonify({
        "group": group_to_json(g),
        "messages": msg_list,
        "members": member_list,
        "my_role": role
    })

# ─── API: send message ─────────────────────────────────────────────────────────

@group_chat_bp.route("/api/groups/<int:group_id>/send", methods=["POST"])
@login_required
def send_message(group_id):
    role = get_user_role(group_id, current_user.id)
    if not role:
        abort(403)
    data = request.json
    content = data.get("content", "").strip()
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

# ─── API: add member ───────────────────────────────────────────────────────────

@group_chat_bp.route("/api/groups/<int:group_id>/members", methods=["POST"])
@login_required
def add_member(group_id):
    role = get_user_role(group_id, current_user.id)
    if role not in ("owner", "admin"):
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

# ─── API: remove member ────────────────────────────────────────────────────────

@group_chat_bp.route("/api/groups/<int:group_id>/members/<int:user_id>", methods=["DELETE"])
@login_required
def remove_member(group_id, user_id):
    role = get_user_role(group_id, current_user.id)
    if role not in ("owner", "admin"):
        abort(403)
    target = GroupMember.query.filter_by(group_id=group_id, user_id=user_id).first()
    if not target:
        return jsonify({"error": "Not a member"}), 404
    if target.role == "owner":
        return jsonify({"error": "Cannot remove the owner"}), 403
    db.session.delete(target)
    db.session.commit()
    return jsonify({"success": True})

# ─── API: update member role ───────────────────────────────────────────────────

@group_chat_bp.route("/api/groups/<int:group_id>/members/<int:user_id>/role", methods=["PUT"])
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
        return jsonify({"error": "Cannot change owner role"}), 403
    target.role = new_role
    db.session.commit()
    return jsonify({"role": new_role, "success": True})

# ─── API: leave group ──────────────────────────────────────────────────────────

@group_chat_bp.route("/api/groups/<int:group_id>/leave", methods=["POST"])
@login_required
def leave_group(group_id):
    m = GroupMember.query.filter_by(group_id=group_id, user_id=current_user.id).first()
    if not m:
        abort(404)
    if m.role == "owner":
        return jsonify({"error": "Owner cannot leave. Transfer ownership or delete the group."}), 403
    db.session.delete(m)
    db.session.commit()
    return jsonify({"success": True})

# ─── API: delete group ─────────────────────────────────────────────────────────

@group_chat_bp.route("/api/groups/<int:group_id>", methods=["DELETE"])
@login_required
def delete_group(group_id):
    g = ChatGroup.query.get_or_404(group_id)
    if g.owner_id != current_user.id:
        abort(403)
    db.session.delete(g)
    db.session.commit()
    return jsonify({"success": True})

# ─── API: search users to invite ───────────────────────────────────────────────

@group_chat_bp.route("/api/groups/<int:group_id>/candidates")
@login_required
def member_candidates(group_id):
    role = get_user_role(group_id, current_user.id)
    if role not in ("owner", "admin"):
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

# ─── Socket.IO events ──────────────────────────────────────────────────────────

@socketio.on("group_join")
def handle_group_join(data):
    group_id = data.get("group_id")
    if group_id:
        join_room(f"group_{group_id}")

@socketio.on("group_leave")
def handle_group_leave(data):
    group_id = data.get("group_id")
    if group_id:
        leave_room(f"group_{group_id}")
