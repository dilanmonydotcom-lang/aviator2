# DroidVault Firestore Security Specification (Phase 0)

## 1. Data Invariants
1. **Public Catalog Integrity (`/apps/{appId}`):** Only verified administrators (`dilanaviator13@gmail.com` or `dilanytwon@gmail.com` with `email_verified == true`, or a document in `/admins/{uid}`) may create, edit, feature, or delete Android app releases. Public storefront visitors may only read releases where `published == true`.
2. **Download Counter Integrity:** Verified signed-in users may only increment `downloads` by exactly `+1` on an existing published app via a strict `affectedKeys().hasOnly(['downloads'])` gate without altering any other field.
3. **PII Isolation (`/users/{userId}`):** User email addresses and profiles are strictly readable only by the document owner (`request.auth.uid == userId`) or a verified admin. Users cannot self-assign `role: "admin"` — `role` is locked to `"user"`.
4. **Master Gate & Relational Integrity (`/users/{userId}/downloads/{downloadId}`):** A download record can only be created if the parent `/users/{userId}` exists, the referenced `/apps/{appId}` exists, and `userId == request.auth.uid`.
5. **Temporal Integrity & Immutability:** `createdAt`, `downloadedAt`, and `grantedAt` must equal `request.time` on creation and remain immutable on update. `updatedAt` must equal `request.time` on create and admin updates.
6. **Size & Array Bounds:** Every string enforces `.size()` limits matching `firebase-blueprint.json`; `screenshots` is strictly bounded to `<= 4` strings; `storageProvider` is locked to `['github-releases', 'cloudinary', 'cloud-link', 'google-drive']`; all document IDs match `^[a-zA-Z0-9_\-]+$` and `<= 128` characters.

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Unverified Admin Email Spoof:** Auth token has `email: "dilanaviator13@gmail.com"` with `email_verified: false` attempting to create `/apps/spoof-app`.
2. **Self-Assigned Admin Role:** Regular user creates `/users/{uid}` with `{ "role": "admin" }`.
3. **Shadow Ghost Field on App Create:** Admin creates `/apps/app-1` with extra field `{ "isVerified": true }`.
4. **Shadow Ghost Field on User Update:** User updates `/users/{uid}` adding `{ "role": "admin" }` or `{ "credits": 999 }`.
5. **PII Blanket Read / Cross-User Snooping:** User A attempts `get` on `/users/userB` or `list` on `/users`.
6. **ID Poisoning:** Attempting to create `/apps/` with a 500-character or `$bad/id!` document ID.
7. **Unbounded Screenshots Array:** Admin attempts to write `/apps/app-1` with 10 screenshot entries (`screenshots.size() == 10`).
8. **Value Poisoning on Download Increment:** User updates `/apps/app-1` setting `downloads: 999999` (not `existing().downloads + 1`) or `downloads: "1000"`.
9. **Immutable Timestamp Tampering:** Admin updates `/apps/app-1` modifying `createdAt` or `ownerUid`.
10. **Client-Spoofed Timestamp:** Creating `/apps/app-1` with a past/future `createdAt` not equal to `request.time`.
11. **Orphaned Download Record:** User creates `/users/{uid}/downloads/dl-1` referencing a non-existent `appId: "fake-app-id"`.
12. **Privilege Escalation on `/admins`:** Non-owner authenticated user attempts to write `/admins/{theirUid}`.
