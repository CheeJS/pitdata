from app import app
import json
import sys

def verify():
    client = app.test_client()
    
    print("1. Creating Thread...")
    res = client.post('/api/paddock/threads', json={
        "client_id": "test_user_1",
        "nickname": "TestDriver",
        "title": "Who wins in Monza?",
        "content": "I think Ferrari has the pace.",
        "category": "Predictions"
    })
    print(f"Create Res: {res.json}")
    thread_id = res.json.get("id")
    if not thread_id:
        print("FAILED: No thread ID returned")
        sys.exit(1)

    print("\n2. Casting Vote (Upvote)...")
    res = client.post('/api/paddock/vote', json={
        "client_id": "test_user_2",
        "item_type": "thread",
        "item_id": thread_id,
        "direction": 1
    })
    print(f"Vote Res: {res.json}")
    if res.json.get("new_score") != 1:
        print("FAILED: Score did not update to 1")
        sys.exit(1)

    print("\n3. Posting Comment...")
    res = client.post(f'/api/paddock/threads/{thread_id}/comments', json={
        "client_id": "test_user_2",
        "nickname": "FanBoy",
        "content": "Agreed! Forza Ferrari!"
    })
    print(f"Comment Res: {res.json}")

    print("\n4. Fetching Details...")
    res = client.get(f'/api/paddock/threads/{thread_id}?client_id=test_user_1')
    details = res.json
    print(f"Details: {details}")
    
    if details["score"] != 1:
        print("FAILED: Detail score incorrect")
        sys.exit(1)
    if len(details["comments"]) != 1:
        print("FAILED: Comment not found")
        sys.exit(1)

    print("\nVERIFICATION SUCCESSFUL")

if __name__ == "__main__":
    verify()
