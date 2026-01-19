from sqlalchemy import create_engine, Column, Integer, String, DateTime, Text, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import json
import os
from dotenv import load_dotenv

load_dotenv()

Base = declarative_base()

class Thread(Base):
    __tablename__ = 'paddock_threads'
    id = Column(Integer, primary_key=True)
    client_id = Column(String)
    nickname = Column(String)
    title = Column(String)
    content = Column(Text)
    category = Column(String) # e.g. "General", "Rumour", "Tech"
    score = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    comments = relationship("Comment", back_populates="thread", cascade="all, delete-orphan")

class Comment(Base):
    __tablename__ = 'paddock_comments'
    id = Column(Integer, primary_key=True)
    thread_id = Column(Integer, ForeignKey('paddock_threads.id'))
    client_id = Column(String)
    nickname = Column(String)
    content = Column(Text)
    score = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    thread = relationship("Thread", back_populates="comments")

class Vote(Base):
    __tablename__ = 'paddock_votes'
    id = Column(Integer, primary_key=True)
    client_id = Column(String)
    item_type = Column(String) # "thread" or "comment"
    item_id = Column(Integer)
    direction = Column(Integer) # 1 (up) or -1 (down)

# Database Connection
DB_URL = os.getenv("DATABASE_URL")
if not DB_URL:
    DB_URL = "sqlite:///:memory:"

if "sqlite" in str(DB_URL):
    engine = create_engine(DB_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(DB_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    Base.metadata.create_all(bind=engine)

# --- THREADS ---
def get_threads(sort_by="new", limit=50):
    session = SessionLocal()
    try:
        query = session.query(Thread)
        
        if sort_by == "top":
            query = query.order_by(Thread.score.desc())
        else:
            query = query.order_by(Thread.created_at.desc())
            
        threads = query.limit(limit).all()
        
        # Get comment counts manually or via relationship len
        res = []
        for t in threads:
            res.append({
                "id": t.id,
                "title": t.title,
                "nickname": t.nickname,
                "category": t.category,
                "score": t.score,
                "comment_count": len(t.comments),
                "timestamp": t.created_at.isoformat()
            })
        return res
    finally:
        session.close()

def create_thread(client_id, nickname, title, content, category="General"):
    session = SessionLocal()
    try:
        t = Thread(client_id=client_id, nickname=nickname, title=title, content=content, category=category)
        session.add(t)
        session.commit()
        return {"status": "success", "id": t.id}
    except Exception as e:
        session.rollback()
        return {"error": str(e)}
    finally:
        session.close()

def get_thread_detail(thread_id, viewer_id=None):
    session = SessionLocal()
    try:
        t = session.query(Thread).filter_by(id=thread_id).first()
        if not t: return None
        
        # Determine user vote status on thread
        user_vote = 0
        if viewer_id:
            v = session.query(Vote).filter_by(client_id=viewer_id, item_type="thread", item_id=thread_id).first()
            if v: user_vote = v.direction

        return {
            "id": t.id,
            "title": t.title,
            "content": t.content,
            "nickname": t.nickname,
            "score": t.score,
            "user_vote": user_vote,
            "timestamp": t.created_at.isoformat(),
            "comments": [{
                "id": c.id,
                "nickname": c.nickname,
                "content": c.content,
                "score": c.score,
                "timestamp": c.created_at.isoformat()
            } for c in t.comments]
        }
    finally:
        session.close()

# --- COMMENTS ---
def post_comment(thread_id, client_id, nickname, content):
    session = SessionLocal()
    try:
        c = Comment(thread_id=thread_id, client_id=client_id, nickname=nickname, content=content)
        session.add(c)
        session.commit()
        return {"status": "success", "id": c.id}
    except Exception as e:
        session.rollback()
        return {"error": str(e)}
    finally:
        session.close()

# --- VOTING ---
def cast_vote(client_id, item_type, item_id, direction):
    session = SessionLocal()
    try:
        # Check existing
        existing = session.query(Vote).filter_by(client_id=client_id, item_type=item_type, item_id=item_id).first()
        
        score_delta = 0
        
        if existing:
            if existing.direction == direction:
                # Toggle off (remove vote)
                session.delete(existing)
                score_delta = -direction
            else:
                # Change vote
                score_delta = direction - existing.direction # e.g. -1 -> 1 = +2
                existing.direction = direction
        else:
            # New vote
            vote = Vote(client_id=client_id, item_type=item_type, item_id=item_id, direction=direction)
            session.add(vote)
            score_delta = direction
            
        # Update score on item
        if item_type == "thread":
            item = session.query(Thread).filter_by(id=item_id).first()
        else:
            item = session.query(Comment).filter_by(id=item_id).first()
            
        if item:
            item.score += score_delta
            
        session.commit()
        return {"status": "success", "new_score": item.score if item else 0}
    except Exception as e:
        session.rollback()
        return {"error": str(e)}
    finally:
        session.close()

init_db()
