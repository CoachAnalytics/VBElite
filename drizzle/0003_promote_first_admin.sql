-- Accounts created before admin roles existed were all set to "user", leaving sites
-- with no admin. If that's the case, the oldest account becomes the admin.
UPDATE "users" SET "role" = 'admin'
WHERE NOT EXISTS (SELECT 1 FROM "users" WHERE "role" = 'admin')
  AND "id" = (SELECT "id" FROM "users" ORDER BY "created_at", "id" LIMIT 1);
