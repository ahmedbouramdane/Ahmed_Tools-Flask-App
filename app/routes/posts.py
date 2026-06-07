import os
import uuid
from flask import Blueprint, render_template, request, redirect, url_for, flash, jsonify, abort
from flask_login import login_required, current_user
from flask_socketio import emit
from werkzeug.utils import secure_filename
from sqlalchemy.orm import subqueryload
from app.models import Post, PostImage, PostLike, PostReaction, PostNotification, PostComment, Follow, User
from app import db, socketio
from datetime import datetime
from functools import wraps

def emit_to_followers(event_name, data, user_id):
    """Emit an event to all followers of a user AND to the global posts room"""
    # Get all followers of the user
    followers = Follow.query.filter_by(followed_id=user_id).all()
    follower_ids = [f.follower_id for f in followers]
    
    # Emit to the room for each follower
    for fid in follower_ids:
        socketio.emit(event_name, data, room=f'user_{fid}', namespace='/posts')
    
    # Also emit to the global posts room for instant updates
    socketio.emit(event_name, data, room='posts_global', namespace='/posts')

# Allowed extensions for image upload
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

posts_bp = Blueprint('posts', __name__)


@posts_bp.route("/posts")
@login_required
def posts_feed():
    """Main posts feed - shows posts from followed users, or all if not following anyone"""
    page = request.args.get('page', 1, type=int)
    
    # Get users that current user is following
    following_ids = [f.followed_id for f in Follow.query.filter_by(follower_id=current_user.id).all()]
    
    if following_ids:
        following_ids.append(current_user.id)
        posts = Post.query.options(
            subqueryload(Post.images)
        ).filter(
            Post.user_id.in_(following_ids),
            Post.visibility == 'public'
        ).order_by(Post.created_at.desc()).paginate(
            page=page, per_page=6, error_out=False
        )
    else:
        posts = Post.query.options(
            subqueryload(Post.images)
        ).filter_by(visibility='public').order_by(
            Post.created_at.desc()
        ).paginate(page=page, per_page=6, error_out=False)
    
    if request.headers.get('X-Requested-With') == 'XMLHttpRequest' and 'application/json' in request.headers.get('Accept', ''):
        emoji_map = {'like': '👍', 'love': '❤️', 'haha': '😂', 'wow': '😮', 'sad': '😢', 'angry': '😡'}
        items = []
        for post in posts.items:
            post_images = post.images if post.images else []
            image_urls = [img.image_url for img in post_images]
            if not image_urls and post.image_url:
                image_urls = [post.image_url]
            user_reaction = post.user_reaction(current_user.id)
            react_counts = post.reaction_counts
            total_reacts = post.total_reactions
            items.append({
                'post_id': post.uuid,
                'content': post.content,
                'image_urls': image_urls,
                'author': {
                    'id': post.author.id,
                    'username': post.author.username,
                    'full_name': post.author.full_name,
                    'avatar_url': post.author.avatar_url or ''
                },
                'created_at': post.created_at.strftime('%B %d, %Y at %H:%M'),
                'updated_at': post.updated_at.strftime('%B %d, %Y at %H:%M') if post.updated_at else None,
                'visibility': post.visibility,
                'likes_count': total_reacts,
                'comments_count': len(post.comments),
                'react_counts': react_counts,
                'user_reaction': user_reaction,
                'is_owner': post.user_id == current_user.id
            })
        return jsonify({
            'items': items,
            'has_next': posts.has_next,
            'has_prev': posts.has_prev,
            'page': posts.page,
            'pages': posts.pages,
            'total': posts.total
        })
    
    return render_template('posts/feed.html', posts=posts)


@posts_bp.route("/posts/create", methods=["POST"])
@login_required
def create_post():
    """Create a new post"""
    content = request.form.get('content', '').strip()
    image_url = request.form.get('image_url', '').strip()
    visibility = request.form.get('visibility', 'public')
    post_type = request.form.get('post_type', 'text')
    
    if not content:
        flash('Post content cannot be empty.', 'danger')
        return redirect(url_for('posts.posts_feed'))
    
    image_urls = request.form.getlist('image_urls')
    if not image_urls:
        image_urls_str = request.form.get('image_urls', '')
        if image_urls_str:
            import json
            try:
                image_urls = json.loads(image_urls_str)
            except json.JSONDecodeError:
                image_urls = [u.strip() for u in image_urls_str.split(',') if u.strip()]

    post = Post(
        content=content,
        image_url=image_urls[0] if image_urls else None,
        visibility=visibility,
        post_type='image' if image_urls else post_type,
        user_id=current_user.id
    )
    db.session.add(post)
    db.session.flush()

    for url in image_urls:
        if url:
            pi = PostImage(post_id=post.id, image_url=url)
            db.session.add(pi)

    db.session.commit()
    
    post_data = {
        'post_id': post.uuid,
        'content': post.content,
        'image_url': image_urls[0] if image_urls else None,
        'image_urls': image_urls,
        'author': {
            'id': current_user.id,
            'username': current_user.username,
            'avatar_url': current_user.avatar_url,
            'full_name': current_user.full_name
        },
        'created_at': post.created_at.strftime('%B %d, %Y at %H:%M'),
        'likes_count': 0,
        'comments_count': 0
    }
    emit_to_followers('new_post', post_data, current_user.id)

    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        return jsonify({
            'success': True,
            'post_id': post.uuid,
            'url': url_for('posts.view_post', post_id=post.uuid),
            'post': post_data
        })

    return redirect(url_for('posts.posts_feed'))


@posts_bp.route("/posts/<string:post_id>")
@login_required
def view_post(post_id):
    """View a single post with comments"""
    post = Post.query.options(subqueryload(Post.images)).filter_by(uuid=post_id).first_or_404()
    user_reaction = post.user_reaction(current_user.id)
    return render_template('posts/view.html', post=post, user_reaction=user_reaction)


@posts_bp.route("/posts/<string:post_id>/like", methods=["POST"])
@login_required
def toggle_like(post_id):
    """Toggle like on a post"""
    post = Post.query.filter_by(uuid=post_id).first_or_404()
    pid = post.id
    
    existing = PostReaction.query.filter_by(post_id=pid, user_id=current_user.id, reaction='like').first()
    existing_like = PostLike.query.filter_by(post_id=pid, user_id=current_user.id).first()
    
    if existing:
        db.session.delete(existing)
        if existing_like:
            db.session.delete(existing_like)
        liked = False
    else:
        PostReaction.query.filter_by(post_id=pid, user_id=current_user.id).delete()
        db.session.add(PostReaction(post_id=pid, user_id=current_user.id, reaction='like'))
        if not existing_like:
            db.session.add(PostLike(post_id=pid, user_id=current_user.id))
        liked = True
    
    db.session.commit()
    
    like_count = PostReaction.query.filter_by(post_id=pid).count()
    
    rows = db.session.query(PostReaction.reaction, db.func.count(PostReaction.id)).filter_by(post_id=pid).group_by(PostReaction.reaction).all()
    counts = {r: c for r, c in rows}
    
    # Create notification for post owner
    if liked and post.user_id != current_user.id:
        notif = PostNotification(
            user_id=post.user_id,
            actor_id=current_user.id,
            post_id=pid,
            type='like',
            message=f'{current_user.username} liked your post'
        )
        db.session.add(notif)
        db.session.commit()
    
    # Emit real-time event to all users
    like_data = {
        'post_id': post.uuid,
        'liked': liked,
        'like_count': like_count,
        'counts': counts,
        'user': {
            'id': current_user.id,
            'username': current_user.username
        },
        'user_id': current_user.id
    }
    socketio.emit('post_liked', like_data, room='posts_global', namespace='/posts')
    
    # Return JSON for AJAX requests
    if request.is_xhr or request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        return jsonify({
            'success': True,
            'liked': liked,
            'like_count': like_count,
            'counts': counts
        })
    
    return redirect(url_for('posts.view_post', post_id=post.uuid))


@posts_bp.route("/posts/<string:post_id>/react", methods=["POST"])
@login_required
def react_to_post(post_id):
    """Set any reaction on a post (like, love, haha, wow, sad, angry)"""
    post = Post.query.filter_by(uuid=post_id).first_or_404()
    pid = post.id
    reaction = request.form.get('reaction', '').strip().lower()
    valid = {'like', 'love', 'haha', 'wow', 'sad', 'angry'}
    if reaction not in valid:
        return jsonify({'success': False, 'error': 'Invalid reaction'}), 400

    existing = PostReaction.query.filter_by(post_id=pid, user_id=current_user.id).first()
    removed = False
    if existing and existing.reaction == reaction:
        db.session.delete(existing)
        removed = True
    else:
        if existing:
            db.session.delete(existing)
        db.session.add(PostReaction(post_id=pid, user_id=current_user.id, reaction=reaction))
        existing_like = PostLike.query.filter_by(post_id=pid, user_id=current_user.id).first()
        if reaction == 'like':
            if not existing_like:
                db.session.add(PostLike(post_id=pid, user_id=current_user.id))
        else:
            if existing_like:
                db.session.delete(existing_like)

    db.session.commit()

    rows = db.session.query(PostReaction.reaction, db.func.count(PostReaction.id)).filter_by(post_id=pid).group_by(PostReaction.reaction).all()
    counts = {r: c for r, c in rows}

    if not removed and post.user_id != current_user.id:
        emoji_map = {'like': '👍', 'love': '❤️', 'haha': '😂', 'wow': '😮', 'sad': '😢', 'angry': '😡'}
        notif = PostNotification(
            user_id=post.user_id, actor_id=current_user.id, post_id=pid,
            type='react', message=f'{current_user.username} reacted with {emoji_map.get(reaction, reaction)}'
        )
        db.session.add(notif)
        db.session.commit()

    socketio.emit('post_reacted', {
        'post_id': post.uuid, 'reaction': reaction if not removed else None,
        'removed': removed, 'user': {'id': current_user.id, 'username': current_user.username},
        'counts': counts, 'user_id': current_user.id
    }, room='posts_global', namespace='/posts')

    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        return jsonify({
            'success': True, 'reaction': reaction if not removed else None,
            'removed': removed, 'counts': counts
        })
    return redirect(url_for('posts.view_post', post_id=post.uuid))


@posts_bp.route("/posts/<string:post_id>/comment", methods=["POST"])
@login_required
def add_comment(post_id):
    """Add a comment to a post"""
    post = Post.query.filter_by(uuid=post_id).first_or_404()
    pid = post.id
    content = request.form.get('content', '').strip()
    parent_id = request.form.get('parent_id', type=int)
    
    if not content:
        flash('Comment cannot be empty.', 'danger')
        return redirect(url_for('posts.view_post', post_id=post.uuid))
    
    comment = PostComment(
        content=content,
        post_id=pid,
        user_id=current_user.id,
        parent_id=parent_id if parent_id else None
    )
    db.session.add(comment)
    db.session.flush()
    
    # Create notification for post owner
    if post.user_id != current_user.id:
        notif = PostNotification(
            user_id=post.user_id,
            actor_id=current_user.id,
            post_id=pid,
            type='comment',
            message=f'{current_user.username} commented on your post'
        )
        db.session.add(notif)
    
    # Create notification for parent comment author (reply)
    if parent_id:
        parent_comment = PostComment.query.get(parent_id)
        if parent_comment and parent_comment.user_id != current_user.id:
            reply_notif = PostNotification(
                user_id=parent_comment.user_id,
                actor_id=current_user.id,
                post_id=pid,
                type='comment',
                message=f'{current_user.username} replied to your comment'
            )
            db.session.add(reply_notif)
    
    db.session.commit()
    
    # Emit real-time event for new comment
    comment_data = {
        'post_id': post.uuid,
        'comment_id': comment.id,
        'content': comment.content,
        'author': {
            'id': current_user.id,
            'username': current_user.username,
            'avatar_url': current_user.avatar_url,
            'full_name': current_user.full_name
        },
        'created_at': comment.created_at.strftime('%Y-%m-%d %H:%M'),
        'parent_id': parent_id
    }
    socketio.emit('new_comment', comment_data, room=f'user_{post.user_id}', namespace='/posts')
    if parent_id and parent_comment:
        socketio.emit('new_comment', comment_data, room=f'user_{parent_comment.user_id}', namespace='/posts')
    socketio.emit('new_comment', comment_data, room=f'post_{post.uuid}', namespace='/posts')
    socketio.emit('new_comment', comment_data, room='posts_global', namespace='/posts')
    
    flash('Comment added successfully!', 'success')
    
    # If AJAX, return the comment HTML
    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        return jsonify({
            'success': True,
            'comment_id': comment.id,
            'comment': comment_data
        })
    
    return redirect(url_for('posts.view_post', post_id=post.uuid))


@posts_bp.route("/posts/<string:post_id>/edit", methods=["POST"])
@login_required
def edit_post(post_id):
    """Edit a post (owner only)"""
    post = Post.query.filter_by(uuid=post_id).first_or_404()
    
    if post.user_id != current_user.id:
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return jsonify({'error': 'Forbidden'}), 403
        abort(403)
    
    content = request.form.get('content', '').strip()
    image_urls_str = request.form.get('image_urls', '')
    visibility = request.form.get('visibility', post.visibility)
    
    if not content:
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return jsonify({'error': 'Content cannot be empty'}), 400
        flash('Post content cannot be empty.', 'danger')
        return redirect(url_for('posts.view_post', post_id=post_id))
    
    post.content = content
    post.visibility = visibility
    post.updated_at = datetime.utcnow()
    
    if image_urls_str:
        import json
        try:
            new_urls = json.loads(image_urls_str)
            PostImage.query.filter_by(post_id=post.id).delete()
            for url in new_urls:
                if url:
                    db.session.add(PostImage(post_id=post.id, image_url=url))
            post.image_url = new_urls[0] if new_urls else None
        except json.JSONDecodeError:
            pass
    
    # Get all updated image URLs
    post_images = PostImage.query.filter_by(post_id=post.id).order_by(PostImage.created_at).all()
    all_image_urls = [img.image_url for img in post_images]
    
    db.session.commit()
    
    socketio.emit('post_edited', {
        'post_id': post.uuid,
        'content': post.content,
        'updated_at': post.updated_at.strftime('%B %d, %Y at %H:%M'),
        'image_url': post.image_url,
        'image_urls': all_image_urls
    }, room='posts_global', namespace='/posts')
    
    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        return jsonify({
            'success': True,
            'content': post.content,
            'updated_at': post.updated_at.strftime('%B %d, %Y at %H:%M'),
            'image_url': post.image_url,
            'image_urls': all_image_urls
        })
    
    flash('Post updated successfully!', 'success')
    return redirect(url_for('posts.view_post', post_id=post.uuid))


@posts_bp.route("/posts/<string:post_id>/delete", methods=["POST"])
@login_required
def delete_post(post_id):
    """Delete a post"""
    post = Post.query.filter_by(uuid=post_id).first_or_404()
    
    if post.user_id != current_user.id:
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return jsonify({'error': 'Forbidden'}), 403
        abort(403)
    
    db.session.delete(post)
    db.session.commit()
    
    socketio.emit('post_deleted', {'post_id': post.uuid}, room='posts_global', namespace='/posts')
    
    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        return jsonify({'success': True})
    
    flash('Post deleted successfully.', 'info')
    return redirect(url_for('posts.posts_feed'))


@posts_bp.route("/posts/<string:post_id>/comment/<int:comment_id>/edit", methods=["POST"])
@login_required
def edit_comment(comment_id, post_id):
    """Edit a comment (commenter only)"""
    comment = PostComment.query.get_or_404(comment_id)
    
    # Only the comment author can edit
    if comment.user_id != current_user.id:
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return jsonify({'error': 'Forbidden'}), 403
        abort(403)
    
    content = request.form.get('content', '').strip()
    if not content:
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return jsonify({'error': 'Content cannot be empty'}), 400
        flash('Comment content cannot be empty.', 'danger')
        return redirect(url_for('posts.view_post', post_id=post_id))
    
    comment.content = content
    comment.updated_at = datetime.utcnow()
    
    db.session.commit()
    
    socketio.emit('comment_edited', {
        'comment_id': comment.id,
        'post_id': post_id,
        'content': comment.content,
        'updated_at': comment.updated_at.strftime('%B %d, %Y at %H:%M')
    }, room='posts_global', namespace='/posts')
    
    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        return jsonify({
            'success': True,
            'content': comment.content,
            'updated_at': comment.updated_at.strftime('%B %d, %Y at %H:%M')
        })
    
    flash('Comment updated successfully!', 'success')
    return redirect(url_for('posts.view_post', post_id=post_id))


@posts_bp.route("/posts/<string:post_id>/comment/<int:comment_id>/delete", methods=["POST"])
@login_required
def delete_comment(post_id, comment_id):
    """Delete a comment (commenter or post owner)"""
    comment = PostComment.query.get_or_404(comment_id)
    post = Post.query.filter_by(uuid=post_id).first_or_404()
    
    # Allow deletion by comment author OR post owner
    is_comment_author = comment.user_id == current_user.id
    is_post_owner = post.user_id == current_user.id
    
    if not is_comment_author and not is_post_owner:
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return jsonify({'error': 'Forbidden'}), 403
        abort(403)
    
    db.session.delete(comment)
    db.session.commit()
    
    socketio.emit('comment_deleted', {'comment_id': comment.id, 'post_id': post.uuid}, room='posts_global', namespace='/posts')
    
    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        return jsonify({'success': True})
    
    flash('Comment deleted.', 'info')
    return redirect(url_for('posts.view_post', post_id=post_id))


@posts_bp.route("/profile/<username>")
@login_required
def user_profile(username):
    """View a user's profile with their posts"""
    user = User.query.filter_by(username=username).first_or_404()
    page = request.args.get('page', 1, type=int)
    posts = Post.query.options(
        subqueryload(Post.images)
    ).filter_by(
        user_id=user.id, visibility='public'
    ).order_by(Post.created_at.desc()).paginate(
        page=page, per_page=10, error_out=False
    )
    
    # Check if current user is following this user
    is_following = Follow.query.filter_by(
        follower_id=current_user.id, followed_id=user.id
    ).first() is not None
    
    return render_template('profile.html', 
                         user=user, posts=posts, 
                         is_following=is_following)


@posts_bp.route("/profile/<username>/posts")
@login_required
def user_posts(username):
    """View a user's posts (redirect to profile)"""
    return redirect(url_for('posts.user_profile', username=username))


@posts_bp.route("/follow/<int:user_id>", methods=["POST"])
@login_required
def toggle_follow(user_id):
    """Follow/Unfollow a user"""
    user = User.query.get_or_404(user_id)
    
    if user.id == current_user.id:
        return jsonify({'error': 'Cannot follow yourself'}), 400
    
    existing_follow = Follow.query.filter_by(
        follower_id=current_user.id, followed_id=user.id
    ).first()
    
    if existing_follow:
        # Unfollow
        db.session.delete(existing_follow)
        following = False
    else:
        # Follow
        follow = Follow(follower_id=current_user.id, followed_id=user.id)
        db.session.add(follow)
        following = True
    
    db.session.commit()
    
    # Create notification when following
    if following:
        notif = PostNotification(
            user_id=user.id,
            actor_id=current_user.id,
            post_id=None,
            type='follow',
            message=f'{current_user.username} started following you'
        )
        db.session.add(notif)
        db.session.commit()
    
    follower_count = Follow.query.filter_by(followed_id=user.id).count()
    following_count = Follow.query.filter_by(follower_id=current_user.id).count()
    
    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        return jsonify({
            'success': True,
            'following': following,
            'follower_count': follower_count,
            'following_count': following_count
        })
    
    return redirect(url_for('profile.profile'))


@posts_bp.route("/upload_post_image", methods=["POST"])
@login_required
def upload_post_image():
    """Upload one or more images for a post and return URLs"""
    files = request.files.getlist('images') if request.files.getlist('images') else (
        [request.files['image']] if 'image' in request.files else []
    )
    
    if not files:
        return jsonify({'success': False, 'error': 'No images provided'}), 400
    
    upload_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'static', 'uploads', 'posts')
    os.makedirs(upload_dir, exist_ok=True)
    
    uploaded = []
    for file in files:
        if file.filename and allowed_file(file.filename):
            ext = file.filename.rsplit('.', 1)[1].lower()
            filename = f"post_{uuid.uuid4().hex}.{ext}"
            filepath = os.path.join(upload_dir, filename)
            file.save(filepath)
            uploaded.append(f"/static/uploads/posts/{filename}")
    
    if not uploaded:
        return jsonify({'success': False, 'error': 'No valid images uploaded'}), 400
    
    return jsonify({'success': True, 'urls': uploaded, 'url': uploaded[0]})


@posts_bp.route("/posts/<string:post_id>/image/<int:image_id>/delete", methods=["POST"])
@login_required
def delete_post_image(post_id, image_id):
    """Delete a single image from a post"""
    post = Post.query.filter_by(uuid=post_id).first_or_404()
    if post.user_id != current_user.id:
        return jsonify({'error': 'Forbidden'}), 403
    
    img = PostImage.query.get_or_404(image_id)
    if img.post_id != post.id:
        return jsonify({'error': 'Image not found on this post'}), 404
    
    db.session.delete(img)
    db.session.commit()
    return jsonify({'success': True})


@posts_bp.route("/explore")
@login_required
def explore_redirect():
    return redirect(url_for('posts.explore'))

@posts_bp.route("/posts/explore")
@login_required
def explore():
    """Explore page - discover posts and users"""
    from datetime import datetime, timedelta
    
    # Get trending posts (most liked in last 24 hours)
    yesterday = datetime.utcnow() - timedelta(hours=24)
    trending_posts = Post.query.options(
        subqueryload(Post.images)
    ).filter(Post.created_at >= yesterday).order_by(
        Post.created_at.desc()
    ).limit(20).all()
    
    # Get suggested users to follow (exclude current user)
    suggested_users = User.query.filter(
        User.id != current_user.id
    ).order_by(User.id.desc()).limit(10).all()
    
    # Get set of followed user IDs for quick lookup
    followed_ids = set(f.followed_id for f in Follow.query.filter_by(follower_id=current_user.id).all())
    
    return render_template('posts/explore.html', 
                         trending_posts=trending_posts, 
                         suggested_users=suggested_users,
                         followed_ids=followed_ids)


@posts_bp.route("/notifications")
@login_required
def notifications_page():
    """Notifications page"""
    page = request.args.get('page', 1, type=int)
    notifs = PostNotification.query.filter_by(user_id=current_user.id).order_by(
        PostNotification.created_at.desc()
    ).paginate(page=page, per_page=20, error_out=False)
    unread_count = PostNotification.query.filter_by(user_id=current_user.id, is_read=False).count()
    return render_template('posts/notifications.html', notifications=notifs, unread_count=unread_count)


@posts_bp.route("/api/notifications")
@login_required
def api_notifications():
    """JSON API for notifications (for real-time polling)"""
    page = request.args.get('page', 1, type=int)
    notifs = PostNotification.query.filter_by(user_id=current_user.id).order_by(
        PostNotification.created_at.desc()
    ).paginate(page=page, per_page=20, error_out=False)
    return jsonify({
        'notifications': [{
            'id': n.id,
            'actor': n.actor.username if n.actor else 'Unknown',
            'actor_id': n.actor_id,
            'post_id': n.post.uuid if n.post else None,
            'type': n.type,
            'message': n.message,
            'is_read': n.is_read,
            'created_at': n.created_at.strftime('%Y-%m-%d %H:%M')
        } for n in notifs.items],
        'unread_count': PostNotification.query.filter_by(user_id=current_user.id, is_read=False).count(),
        'has_more': notifs.has_next,
        'page': notifs.page,
        'pages': notifs.pages
    })


@posts_bp.route("/api/notifications/unread-count")
@login_required
def api_unread_notifications_count():
    """Return unread notifications count"""
    count = PostNotification.query.filter_by(user_id=current_user.id, is_read=False).count()
    return jsonify({'unread_count': count})


@posts_bp.route("/notifications/<int:notif_id>/read", methods=["POST"])
@login_required
def mark_notification_read(notif_id):
    """Mark a notification as read"""
    notif = PostNotification.query.get_or_404(notif_id)
    if notif.user_id != current_user.id:
        return jsonify({'error': 'Forbidden'}), 403
    notif.is_read = True
    db.session.commit()
    return jsonify({'success': True})


@posts_bp.route("/notifications/read-all", methods=["POST"])
@login_required
def mark_all_notifications_read():
    """Mark all notifications as read"""
    PostNotification.query.filter_by(user_id=current_user.id, is_read=False).update({'is_read': True})
    db.session.commit()
    return jsonify({'success': True})
