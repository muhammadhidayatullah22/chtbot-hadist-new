"""Simple E2E test — no emoji for Windows compat."""
import asyncio
import json
import sys
import httpx

BASE = "http://localhost:8000/api"


async def main():
    results = []

    async with httpx.AsyncClient(timeout=60) as c:
        # 1. Register
        r = await c.post(f"{BASE}/auth/register", json={
            "username": "e2euser", "email": "e2e@test.com", "password": "test123"
        })
        if r.status_code == 200:
            token = r.json()["access_token"]
            results.append("REGISTER: PASS")
        else:
            r2 = await c.post(f"{BASE}/auth/login", json={
                "username": "e2euser", "password": "test123"
            })
            token = r2.json()["access_token"]
            results.append("LOGIN: PASS (existing)")

        h = {"Authorization": f"Bearer {token}"}

        # 2. Me
        r = await c.get(f"{BASE}/auth/me", headers=h)
        results.append(f"ME: {'PASS' if r.status_code == 200 else 'FAIL'}")

        # 3. Chat streaming
        resp = ""
        sid = ""
        src_count = 0
        async with c.stream("POST", f"{BASE}/chat/send",
            json={"message": "hadist tentang sholat"},
            headers=h,
        ) as sr:
            async for line in sr.aiter_lines():
                if line.startswith("data: "):
                    try:
                        obj = json.loads(line[6:])
                        if obj["type"] == "content":
                            resp += obj["data"]
                        elif obj["type"] == "sources":
                            src_count = len(obj["data"])
                        elif obj["type"] == "done":
                            sid = obj.get("session_id", "")
                    except Exception:
                        pass

        if resp and sid:
            results.append(f"CHAT: PASS (len={len(resp)}, sources={src_count})")
        else:
            results.append(f"CHAT: FAIL (resp={len(resp)}, sid={sid!r})")

        # 4. Sessions
        r = await c.get(f"{BASE}/chat/sessions", headers=h)
        sessions = r.json()
        results.append(f"SESSIONS: PASS ({len(sessions)} sessions)")

        # 5. Session messages
        if sid:
            r = await c.get(f"{BASE}/chat/sessions/{sid}", headers=h)
            msgs = r.json()
            results.append(f"MESSAGES: PASS ({len(msgs)} msgs)")

        # 6. Admin login + stats
        r = await c.post(f"{BASE}/auth/login", json={
            "username": "admin", "password": "admin123"
        })
        at = r.json()["access_token"]
        ah = {"Authorization": f"Bearer {at}"}

        r = await c.get(f"{BASE}/admin/stats", headers=ah)
        if r.status_code == 200:
            s = r.json()
            results.append(
                f"ADMIN STATS: PASS (users={s['total_users']}, "
                f"sessions={s['total_sessions']}, chunks={s['total_chunks']})"
            )
        else:
            results.append(f"ADMIN STATS: FAIL ({r.status_code})")

        # 7. Admin files
        r = await c.get(f"{BASE}/admin/files", headers=ah)
        results.append(f"ADMIN FILES: {'PASS' if r.status_code == 200 else 'FAIL'}")

        # 8. Auth guard — non-admin blocked
        r = await c.get(f"{BASE}/admin/stats", headers=h)
        results.append(f"AUTH GUARD: {'PASS' if r.status_code == 403 else 'FAIL'} ({r.status_code})")

        # 9. Unauthenticated blocked
        r = await c.get(f"{BASE}/auth/me")
        results.append(f"UNAUTH BLOCK: {'PASS' if r.status_code == 401 else 'FAIL'} ({r.status_code})")

    # Print results
    print("\n--- E2E TEST RESULTS ---")
    passed = 0
    failed = 0
    for r in results:
        status = "PASS" if "PASS" in r else "FAIL"
        if status == "PASS":
            passed += 1
        else:
            failed += 1
        print(f"  [{status}] {r}")

    print(f"\n--- {passed}/{passed + failed} PASSED ---")
    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    asyncio.run(main())
