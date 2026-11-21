# Security Specification & Payload-First TDD

## 1. Data Invariants
1. Every document under `/users/{userId}/...` belongs strictly to `userId` (`ownerId == request.auth.uid == userId`), and `isValidId(userId)` is enforced.
2. PII (`email`, `displayName`) resides exclusively in `/users/{userId}/private/{docId}` and is readable/writable only by the verified owner (`request.auth.uid == userId`).
3. Every write enforces strict schema validation (`isValid[Entity]`), `ownerId` immutability, server-verified `createdAt`/`updatedAt` (`request.time`), string length limits, and bounded arrays (`<= 25` items).
4. `allow list` never relies on client-side query trust alone and enforces `resource.data.ownerId == request.auth.uid` without `get()`/`exists()`.

## 2. Dirty Dozen Attack Payloads (Expected: PERMISSION_DENIED)
1. **Unauthenticated Task Read**: `GET /users/alice/tasks/t1` with `auth == null`.
2. **Cross-Tenant Task Read**: `GET /users/alice/tasks/t1` with `auth.uid == "bob"`.
3. **Cross-Tenant List Scraping**: `LIST /users/alice/tasks` with `auth.uid == "bob"`.
4. **Shadow Field Injection on Create**: `CREATE /users/alice/tasks/t2` including `"isAdmin": true`.
5. **Owner Spoofing on Create**: `CREATE /users/alice/tasks/t2` with `ownerId: "bob"` while signed in as `"alice"`.
6. **Owner Hijack on Update**: `UPDATE /users/alice/tasks/t1` mutating `ownerId` to `"bob"`.
7. **Immutable Timestamp Backdating**: `CREATE /users/alice/tasks/t2` with client-forged `createdAt` not equal to `request.time`.
8. **Path Variable Poisoning**: `CREATE /users/alice/tasks/bad$id!@#` violating `^[a-zA-Z0-9_-]+$`.
9. **Denial-of-Wallet String Overflow**: `CREATE /users/alice/tasks/t2` with `title` of 5,000 characters (`> 200`).
10. **Unverified Email Write**: `CREATE /users/alice/tasks/t2` with `auth.token.email_verified == false`.
11. **PII Cross-User Access**: `GET /users/alice/private/profile` as `"bob"`.
12. **Unbounded Array Injection**: `CREATE /users/alice/workoutPlans/w1` with `exercises.size() == 50` (`> 25`).
