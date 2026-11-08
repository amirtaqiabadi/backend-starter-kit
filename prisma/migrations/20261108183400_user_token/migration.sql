-- AlterTable
ALTER TABLE "users" ADD COLUMN "token" CHAR(5);
ALTER TABLE "users" ADD COLUMN "referred_by_id" INTEGER;

-- Multiple NULLs are allowed, so this index can exist before tokens are filled in.
CREATE UNIQUE INDEX "users_token_key" ON "users"("token");

-- Existing accounts need a public token before the column can be required.
DO $$
DECLARE
  alphabet CONSTANT text := 'ACDEFGHJKMNPQRTVWXYZ234679';
  uid integer;
  candidate char(5);
BEGIN
  FOR uid IN SELECT id FROM users WHERE token IS NULL LOOP
    LOOP
      candidate := '';
      FOR i IN 1..5 LOOP
        candidate := candidate || substr(alphabet, 1 + floor(random() * char_length(alphabet))::int, 1);
      END LOOP;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM users WHERE token = candidate);
    END LOOP;
    UPDATE users SET token = candidate WHERE id = uid;
  END LOOP;
END $$;

ALTER TABLE "users" ALTER COLUMN "token" SET NOT NULL;

-- CreateIndex
CREATE INDEX "users_referred_by_id_idx" ON "users"("referred_by_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_referred_by_id_fkey" FOREIGN KEY ("referred_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
