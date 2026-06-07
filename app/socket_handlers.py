from flask_socketio import Namespace, emit, join_room, leave_room
from flask_login import current_user
from app import socketio, db, login_manager
from app.models import Post, PostImage, PostLike, PostReaction, PostNotification, PostComment, Follow, User
from flask import request, session
from datetime import datetime


class PostsNamespace(Namespace):
    """SocketIO namespace for real-time posts functionality"""
    
    def __init__(self, namespace=None):
        super(PostsNamespace, self).__init__(namespace)
        # Store user sessions: sid -> user_id
        self.user_sessions = {}
    
    def on_connect(self, auth=None):
        """Handle client connection"""
        user_id = None
        if auth and 'user_id' in auth:
            user_id = int(auth['user_id'])
        if not user_id:
            user_id = self.get_current_user_id()
        sid = request.sid
        if user_id:
            self.user_sessions[sid] = user_id
            join_room(f'user_{user_id}')
            print(f'User {user_id} connected to posts namespace (sid: {sid})')
        else:
            print(f'Anonymous connection to posts namespace (sid: {sid})')
        # Always join global posts room so anonymous users see public posts
        join_room('posts_global')
    
    def on_disconnect(self):
        """Handle client disconnection"""
        sid = request.sid
        user_id = self.user_sessions.pop(sid, None)
        if user_id:
            print(f'User {user_id} disconnected from posts namespace (sid: {sid})')
        else:
            print(f'Anonymous disconnection from posts namespace (sid: {sid})')
    
    def on_join_post(self, data):
        """Join a specific post room to receive updates"""
        user_id = self.get_current_user_id()
        if user_id:
            post_id = data.get('post_id')
            if post_id:
                join_room(f'post_{post_id}')
    
    def on_leave_post(self, data):
        """Leave a specific post room"""
        user_id = self.get_current_user_id()
        if user_id:
            post_id = data.get('post_id')
            if post_id:
                leave_room(f'post_{post_id}')
    
    def get_current_user_id(self):
        """Get current user ID from session or auth data"""
        # First, check if we already have this connection mapped
        sid = request.sid if hasattr(request, 'sid') else None
        if sid and sid in self.user_sessions:
            return self.user_sessions[sid]
        
        # Try Flask-Login session (most reliable method)
        try:
            for key in ['_user_id', 'user_id', 'userId']:
                user_id = session.get(key)
                if user_id:
                    # Cache it for this connection
                    if sid:
                        self.user_sessions[sid] = int(user_id)
                    return int(user_id)
        except (TypeError, ValueError):
            pass
        
        return None
    
    def get_current_user(self):
        """Get current user object"""
        user_id = self.get_current_user_id()
        if user_id:
            return User.query.get(user_id)
        return None
    
    # ---- Real-time Post Actions via SocketIO ----
    
    def on_create_post(self, data, callback=None):
        """Create a new post via SocketIO"""
        try:
            user = self.get_current_user()
            if not user:
                if callback: callback({'success': False, 'error': 'Not authenticated'})
                return

            content = data.get('content', '').strip()
            image_urls = data.get('image_urls', [])
            visibility = data.get('visibility', 'public')

            if not content:
                if callback: callback({'success': False, 'error': 'Content required'})
                return

            if isinstance(image_urls, str):
                image_urls = [u.strip() for u in image_urls.split(',') if u.strip()]

            post = Post(
                content=content,
                image_url=image_urls[0] if image_urls else None,
                visibility=visibility,
                post_type='image' if image_urls else 'text',
                user_id=user.id
            )
            db.session.add(post)
            db.session.flush()

            for url in image_urls:
                if url:
                    db.session.add(PostImage(post_id=post.id, image_url=url))

            db.session.commit()

            post_data = {
                'post_id': post.uuid, 'content': post.content,
                'image_url': image_urls[0] if image_urls else None,
                'image_urls': image_urls,
                'author': {'id': user.id, 'username': user.username, 'full_name': user.full_name, 'avatar_url': user.avatar_url or ''},
                'created_at': post.created_at.strftime('%B %d, %Y at %H:%M'),
                'likes_count': 0, 'comments_count': 0
            }

            try:
                emit('new_post', post_data, room='posts_global')
            except Exception:
                pass

            if callback:
                callback({'success': True, 'post': post_data})
        except Exception as e:
            db.session.rollback()
            print(f'[on_create_post] Error: {e}')
            if callback:
                callback({'success': False, 'error': str(e)})
    
    def on_like_post(self, data, callback=None):
        """Like/unlike a post via SocketIO (creates 'like' reaction)"""
        try:
            user = self.get_current_user()
            if not user:
                if callback: callback({'success': False, 'error': 'Not authenticated'})
                return

            post_uuid = data.get('post_id')
            if not post_uuid:
                if callback: callback({'success': False, 'error': 'Post ID required'})
                return

            post = Post.query.filter_by(uuid=post_uuid).first()
            if not post:
                if callback: callback({'success': False, 'error': 'Post not found'})
                return

            pid = post.id
            existing = PostReaction.query.filter_by(post_id=pid, user_id=user.id, reaction='like').first()
            existing_like = PostLike.query.filter_by(post_id=pid, user_id=user.id).first()

            if existing:
                db.session.delete(existing)
                if existing_like:
                    db.session.delete(existing_like)
                liked = False
            else:
                PostReaction.query.filter_by(post_id=pid, user_id=user.id).delete()
                db.session.add(PostReaction(post_id=pid, user_id=user.id, reaction='like'))
                if not existing_like:
                    db.session.add(PostLike(post_id=pid, user_id=user.id))
                liked = True

            db.session.commit()
            like_count = PostReaction.query.filter_by(post_id=pid).count()

            rows = db.session.query(PostReaction.reaction, db.func.count(PostReaction.id)).filter_by(post_id=pid).group_by(PostReaction.reaction).all()
            counts = {r: c for r, c in rows}

            if liked and post.user_id != user.id:
                notif = PostNotification(
                    user_id=post.user_id,
                    actor_id=user.id,
                    post_id=pid,
                    type='like',
                    message=f'{user.username} liked your post'
                )
                db.session.add(notif)
                db.session.commit()
                try:
                    emit('new_notification', {
                        'id': notif.id, 'message': notif.message,
                        'type': notif.type, 'actor': user.username, 'post_id': post_uuid
                    }, room=f'user_{post.user_id}')
                except Exception:
                    pass

            like_data = {
                'post_id': post_uuid, 'liked': liked, 'like_count': like_count,
                'user': {'id': user.id, 'username': user.username}, 'counts': counts,
                'user_id': user.id
            }

            try:
                emit('post_liked', like_data, room='posts_global')
            except Exception:
                pass

            if callback:
                callback({'success': True, 'liked': liked, 'like_count': like_count, 'counts': counts})
        except Exception as e:
            db.session.rollback()
            print(f'[on_like_post] Error: {e}')
            if callback:
                callback({'success': False, 'error': str(e)})
    
    def on_react_to_post(self, data, callback=None):
        """Set a reaction on a post (love, haha, wow, sad, angry) via SocketIO"""
        try:
            user = self.get_current_user()
            if not user:
                if callback: callback({'success': False, 'error': 'Not authenticated'})
                return

            post_uuid = data.get('post_id')
            reaction = data.get('reaction', '').strip().lower()
            valid = {'like', 'love', 'haha', 'wow', 'sad', 'angry'}
            if not post_uuid or reaction not in valid:
                if callback: callback({'success': False, 'error': 'Invalid post ID or reaction'})
                return

            post = Post.query.filter_by(uuid=post_uuid).first()
            if not post:
                if callback: callback({'success': False, 'error': 'Post not found'})
                return

            pid = post.id
            existing = PostReaction.query.filter_by(post_id=pid, user_id=user.id).first()
            removed = False
            if existing and existing.reaction == reaction:
                db.session.delete(existing)
                removed = True
            else:
                if existing:
                    db.session.delete(existing)
                db.session.add(PostReaction(post_id=pid, user_id=user.id, reaction=reaction))
                existing_like = PostLike.query.filter_by(post_id=pid, user_id=user.id).first()
                if reaction == 'like':
                    if not existing_like:
                        db.session.add(PostLike(post_id=pid, user_id=user.id))
                else:
                    if existing_like:
                        db.session.delete(existing_like)

            db.session.commit()

            rows = db.session.query(PostReaction.reaction, db.func.count(PostReaction.id)).filter_by(post_id=pid).group_by(PostReaction.reaction).all()
            counts = {r: c for r, c in rows}

            if not removed and post.user_id != user.id:
                emoji_map = {'like': '👍', 'love': '❤️', 'haha': '😂', 'wow': '😮', 'sad': '😢', 'angry': '😡'}
                notif = PostNotification(
                    user_id=post.user_id, actor_id=user.id, post_id=pid,
                    type='react', message=f'{user.username} reacted with {emoji_map.get(reaction, reaction)}'
                )
                db.session.add(notif)
                db.session.commit()
                try:
                    emit('new_notification', {
                        'id': notif.id, 'message': notif.message, 'type': notif.type,
                        'actor': user.username, 'post_id': post_uuid
                    }, room=f'user_{post.user_id}')
                except Exception:
                    pass

            reacted_data = {
                'post_id': post_uuid, 'reaction': reaction if not removed else None,
                'removed': removed, 'user': {'id': user.id, 'username': user.username},
                'counts': counts, 'user_id': user.id
            }

            try:
                emit('post_reacted', reacted_data, room='posts_global')
            except Exception:
                pass

            if callback:
                callback({'success': True, 'reaction': reaction if not removed else None, 'removed': removed, 'counts': counts})
        except Exception as e:
            db.session.rollback()
            print(f'[on_react_to_post] Error: {e}')
            if callback:
                callback({'success': False, 'error': str(e)})

    def on_add_comment(self, data, callback=None):
        """Add a comment via SocketIO"""
        try:
            user = self.get_current_user()
            if not user:
                if callback: callback({'success': False, 'error': 'Not authenticated'})
                return

            post_uuid = data.get('post_id')
            content = data.get('content', '').strip()
            raw_parent_id = data.get('parent_id')

            if not post_uuid or not content:
                if callback: callback({'success': False, 'error': 'Post ID and content required'})
                return

            post = Post.query.filter_by(uuid=post_uuid).first()
            if not post:
                if callback: callback({'success': False, 'error': 'Post not found'})
                return

            pid = post.id
            parent_id = raw_parent_id
            if raw_parent_id:
                parent_comment = PostComment.query.get(raw_parent_id)
                if parent_comment and parent_comment.parent_id:
                    parent_id = parent_comment.parent_id

            comment = PostComment(
                content=content, post_id=pid, user_id=user.id,
                parent_id=parent_id if parent_id else None
            )
            db.session.add(comment)
            db.session.flush()

            if raw_parent_id:
                replied_to = PostComment.query.get(raw_parent_id)
                if replied_to and replied_to.user_id != user.id:
                    reply_notif = PostNotification(
                        user_id=replied_to.user_id, actor_id=user.id, post_id=pid,
                        type='comment', message=f'{user.username} replied to your comment'
                    )
                    db.session.add(reply_notif)
                    db.session.flush()
                    try:
                        emit('new_notification', {
                            'id': reply_notif.id, 'message': reply_notif.message,
                            'type': reply_notif.type, 'actor': user.username, 'post_id': post_uuid
                        }, room=f'user_{replied_to.user_id}')
                    except Exception:
                        pass

            if not raw_parent_id and post.user_id != user.id:
                notif = PostNotification(
                    user_id=post.user_id, actor_id=user.id, post_id=pid,
                    type='comment', message=f'{user.username} commented on your post'
                )
                db.session.add(notif)

            db.session.commit()

            if not raw_parent_id and post.user_id != user.id:
                try:
                    emit('new_notification', {
                        'id': notif.id, 'message': notif.message,
                        'type': notif.type, 'actor': user.username, 'post_id': post_uuid
                    }, room=f'user_{post.user_id}')
                except Exception:
                    pass

            comment_data = {
                'post_id': post_uuid, 'comment_id': comment.id, 'content': comment.content,
                'author': {'id': user.id, 'username': user.username, 'avatar_url': user.avatar_url or ''},
                'created_at': comment.created_at.strftime('%H:%M'), 'parent_id': parent_id
            }

            try:
                emit('new_comment', comment_data, room='posts_global')
            except Exception:
                pass

            if callback:
                callback({'success': True, 'comment': comment_data})
        except Exception as e:
            db.session.rollback()
            print(f'[on_add_comment] Error: {e}')
            if callback:
                callback({'success': False, 'error': str(e)})
    
    def on_delete_post(self, data, callback=None):
        """Delete a post via SocketIO"""
        try:
            user = self.get_current_user()
            if not user:
                if callback: callback({'success': False, 'error': 'Not authenticated'})
                return

            post_uuid = data.get('post_id')
            if not post_uuid:
                if callback: callback({'success': False, 'error': 'Post ID required'})
                return

            post = Post.query.filter_by(uuid=post_uuid).first()
            if not post:
                if callback: callback({'success': False, 'error': 'Post not found'})
                return

            if post.user_id != user.id:
                if callback: callback({'success': False, 'error': 'Not authorized'})
                return

            db.session.delete(post)
            db.session.commit()

            try:
                emit('post_deleted', {'post_id': post_uuid}, room='posts_global')
            except Exception:
                pass

            if callback:
                callback({'success': True})
        except Exception as e:
            db.session.rollback()
            print(f'[on_delete_post] Error: {e}')
            if callback:
                callback({'success': False, 'error': str(e)})
    
    def on_edit_post(self, data, callback=None):
        """Edit a post via SocketIO"""
        try:
            user = self.get_current_user()
            if not user:
                if callback: callback({'success': False, 'error': 'Not authenticated'})
                return

            post_uuid = data.get('post_id')
            content = data.get('content', '').strip()

            if not post_uuid or not content:
                if callback: callback({'success': False, 'error': 'Post ID and content required'})
                return

            post = Post.query.filter_by(uuid=post_uuid).first()
            if not post or post.user_id != user.id:
                if callback: callback({'success': False, 'error': 'Not authorized'})
                return

            post.content = content
            post.updated_at = datetime.utcnow()
            db.session.commit()

            post_images = PostImage.query.filter_by(post_id=post.id).order_by(PostImage.created_at).all()
            image_urls = [img.image_url for img in post_images]

            edit_data = {
                'post_id': post_uuid, 'content': post.content,
                'updated_at': post.updated_at.strftime('%B %d, %Y at %H:%M'),
                'image_url': post.image_url, 'image_urls': image_urls
            }

            try:
                emit('post_edited', edit_data, room='posts_global')
            except Exception:
                pass

            if callback:
                callback({'success': True, 'post': edit_data})
        except Exception as e:
            db.session.rollback()
            print(f'[on_edit_post] Error: {e}')
            if callback:
                callback({'success': False, 'error': str(e)})
    
    def on_delete_comment(self, data, callback=None):
        """Delete a comment via SocketIO"""
        user = self.get_current_user()
        if not user:
            if callback: callback({'success': False, 'error': 'Not authenticated'})
            return
        
        comment_id = data.get('comment_id')
        post_uuid = data.get('post_id')
        
        if not comment_id:
            if callback: callback({'success': False, 'error': 'Comment ID required'})
            return
        
        comment = PostComment.query.get(comment_id)
        post = Post.query.filter_by(uuid=post_uuid).first() if post_uuid else None
        
        if not comment:
            if callback: callback({'success': False, 'error': 'Comment not found'})
            return
        
        # Check authorization
        is_author = comment.user_id == user.id
        is_post_owner = post and post.user_id == user.id
        
        if not is_author and not is_post_owner:
            if callback: callback({'success': False, 'error': 'Not authorized'})
            return
        
        db.session.delete(comment)
        db.session.commit()
        
        emit('comment_deleted', {'comment_id': comment_id, 'post_id': post_uuid}, room='posts_global')
        
        if callback:
            callback({'success': True})


# Initialize the namespace
posts_ns = PostsNamespace('/posts')
socketio.on_namespace(posts_ns)
