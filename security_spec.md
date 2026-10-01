# PAGRA Furniture — Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants

1. **Public Read / Admin-Only Write Invariant (`/items/{itemId}` & `/categories/{categoryId}`)**:
   - Unauthenticated visitors and standard customer accounts can only perform `get` and `list` operations on `/items` and `/categories`.
   - Only authenticated users with `email_verified == true` who are either the bootstrapped administrator (`nicholasnjau22@gmail.com`) or have an existing document at `/admins/$(request.auth.uid)` may `create`, `update`, or `delete` items and categories.
2. **Identity Integrity Invariant**:
   - Every created document in `/items`, `/categories`, and `/admins` must record `createdBy == request.auth.uid` (or `addedBy == request.auth.uid` for `/admins`).
   - Ownership fields (`createdBy`, `addedBy`, `uid`) and creation timestamps (`createdAt`) are strictly immutable after creation.
3. **Temporal Integrity Invariant**:
   - `createdAt` and `updatedAt` must equal `request.time` on `create`.
   - `updatedAt` must equal `request.time` on `update`, and `createdAt` must equal `existing().createdAt`.
4. **PII Isolation Invariant (`/admins/{adminId}`)**:
   - The `/admins/{adminId}` collection stores administrator email addresses (PII). Public and blanket signed-in reads are strictly forbidden.
   - `get` is restricted to the document owner (`request.auth.uid == adminId`) or a verified admin.
   - `list` is restricted to verified admins querying records where `resource.data.addedBy == request.auth.uid || resource.data.uid == request.auth.uid` or the bootstrap admin, with zero `get()`/`exists()` calls inside `allow list`.
5. **Path Variable & Volumetric Guard Invariant**:
   - All document IDs (`itemId`, `categoryId`, `adminId`) must match `^[a-zA-Z0-9_\-]+$` and have length `1..128`.
   - All strings have explicit `.size()` bounds synchronized verbatim with `firebase-blueprint.json`.

---

## 2. Example Payloads for the Eight Pillars of Hardened Rules

1. **Pillar 1 — Master Gate / Relational Role Sync**:
   - Non-admin user attempts to create a furniture item without `/admins/$(request.auth.uid)` existing:
     `{ "name": "Cloud Sofa", "price": 145000, ... }` -> `PERMISSION_DENIED`.
2. **Pillar 2 — Validation Blueprints (Anti-Update-Gap)**:
   - Admin attempts partial update with shadow field `isFeatured: true`:
     `{ ...existingItem, "isFeatured": true }` -> `PERMISSION_DENIED` via `hasOnly()`.
3. **Pillar 3 — Path Variable Hardening (ID Poisoning Guard)**:
   - Request targeting `/items/invalid$id!with*spaces` -> `PERMISSION_DENIED` via `isValidId()`.
4. **Pillar 4 — Tiered Identity Logic**:
   - Customer account (`role: customer`) attempts `update` on `/items/sofa_1` sale fields -> `PERMISSION_DENIED`.
5. **Pillar 5 — Total Array / Key Guarding**:
   - `data.keys().hasAll(...) && data.keys().hasOnly(...)` blocks any unapproved keys on create/update.
6. **Pillar 6 — PII Isolation**:
   - Signed-in non-admin customer attempts `get` on `/admins/other_admin_uid` -> `PERMISSION_DENIED`.
7. **Pillar 7 — Atomicity & Timestamp Guarantee**:
   - Admin sends forged client timestamp `createdAt: Timestamp(2020, 1, 1)` -> `PERMISSION_DENIED` because `incoming().createdAt == request.time` fails.
8. **Pillar 8 — Secure List Queries (Query Enforcer)**:
   - Unfiltered `list` on `/admins` by a regular signed-in user -> `PERMISSION_DENIED`.

---

## 3. The "Dirty Dozen" Adversarial Payloads

1. **Payload 01 (Unauthenticated Item Write)**: `auth: null`, `create /items/item_1` with valid schema -> `PERMISSION_DENIED`.
2. **Payload 02 (Customer Privilege Escalation)**: `auth: { uid: 'cust_1', email: 'cust@example.com', email_verified: true }`, `create /admins/cust_1` with `{ uid: 'cust_1', email: 'cust@example.com', role: 'admin', addedBy: 'cust_1' }` -> `PERMISSION_DENIED`.
3. **Payload 03 (Email Spoofing Attack)**: `auth: { uid: 'spoof_1', email: 'nicholasnjau22@gmail.com', email_verified: false }`, `create /categories/cat_1` -> `PERMISSION_DENIED`.
4. **Payload 04 (Shadow Field Injection on Item Create)**: Admin sends valid item payload plus `"discountHack": 99` -> `PERMISSION_DENIED`.
5. **Payload 05 (Identity Spoofing on Item Create)**: Admin `'admin_1'` sends item with `createdBy: 'other_user'` -> `PERMISSION_DENIED`.
6. **Payload 06 (Immutable Field Mutation on Item Update)**: Admin updates `/items/item_1` changing `createdBy` or `createdAt` -> `PERMISSION_DENIED`.
7. **Payload 07 (Value Poisoning on Sale Update)**: Admin updates `salePrice` with string `"free"` or negative number `-500` -> `PERMISSION_DENIED`.
8. **Payload 08 (ID Poisoning Attack)**: Admin creates `/items/bad..id$$` -> `PERMISSION_DENIED`.
9. **Payload 09 (Denial-of-Wallet Oversized String)**: Admin creates category with `description` of 5,000 characters (limit 300) -> `PERMISSION_DENIED`.
10. **Payload 10 (PII Leakage via Admin Get)**: Customer `'cust_1'` reads `/admins/admin_2` -> `PERMISSION_DENIED`.
11. **Payload 11 (PII Scraping via Admin List)**: Customer `'cust_1'` lists `/admins` collection -> `PERMISSION_DENIED`.
12. **Payload 12 (Forged Timestamp Attack)**: Admin updates `/items/item_1` with stale `updatedAt` != `request.time` -> `PERMISSION_DENIED`.
