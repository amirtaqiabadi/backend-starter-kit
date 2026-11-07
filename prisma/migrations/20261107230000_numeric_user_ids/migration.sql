-- Existing databases already applied the text-id init migration, so the ids change in place.

ALTER TABLE "users" ADD COLUMN "name" TEXT;

CREATE SEQUENCE "users_id_seq";

ALTER TABLE "users" ADD COLUMN "id_new" INTEGER;
UPDATE "users" SET "id_new" = nextval('users_id_seq');
ALTER TABLE "users" ALTER COLUMN "id_new" SET NOT NULL;
ALTER TABLE "users" ALTER COLUMN "id_new" SET DEFAULT nextval('users_id_seq');
ALTER SEQUENCE "users_id_seq" OWNED BY "users"."id_new";

ALTER TABLE "team_members" DROP CONSTRAINT "team_members_user_id_fkey";
ALTER TABLE "gateway_attempts" DROP CONSTRAINT "gateway_attempts_initiator_id_fkey";
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_initiator_id_fkey";
ALTER TABLE "refund_requests" DROP CONSTRAINT "refund_requests_initiator_id_fkey";

ALTER TABLE "auth_events" ADD COLUMN "user_id_new" INTEGER;
UPDATE "auth_events" AS event
SET "user_id_new" = users."id_new"
FROM "users" AS users
WHERE event."user_id" = users."id";
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "auth_events"
    WHERE "user_id" IS NOT NULL AND "user_id_new" IS NULL
  ) THEN
    RAISE EXCEPTION 'auth_events.user_id does not match a user';
  END IF;
END $$;
ALTER TABLE "auth_events" DROP COLUMN "user_id";
ALTER TABLE "auth_events" RENAME COLUMN "user_id_new" TO "user_id";

DROP INDEX "team_members_user_id_idx";
DROP INDEX "team_members_team_id_user_id_key";
ALTER TABLE "team_members" ADD COLUMN "user_id_new" INTEGER;
UPDATE "team_members" AS member
SET "user_id_new" = users."id_new"
FROM "users" AS users
WHERE member."user_id" = users."id";
ALTER TABLE "team_members" DROP COLUMN "user_id";
ALTER TABLE "team_members" RENAME COLUMN "user_id_new" TO "user_id";
ALTER TABLE "team_members" ALTER COLUMN "user_id" SET NOT NULL;
CREATE INDEX "team_members_user_id_idx" ON "team_members"("user_id");
CREATE UNIQUE INDEX "team_members_team_id_user_id_key" ON "team_members"("team_id", "user_id");

DROP INDEX "gateway_attempts_initiator_id_team_id_status_idx";
ALTER TABLE "gateway_attempts" ADD COLUMN "initiator_id_new" INTEGER;
UPDATE "gateway_attempts" AS attempt
SET "initiator_id_new" = users."id_new"
FROM "users" AS users
WHERE attempt."initiator_id" = users."id";
ALTER TABLE "gateway_attempts" DROP COLUMN "initiator_id";
ALTER TABLE "gateway_attempts" RENAME COLUMN "initiator_id_new" TO "initiator_id";
ALTER TABLE "gateway_attempts" ALTER COLUMN "initiator_id" SET NOT NULL;
CREATE INDEX "gateway_attempts_initiator_id_team_id_status_idx" ON "gateway_attempts"("initiator_id", "team_id", "status");

DROP INDEX "transactions_initiator_id_idx";
ALTER TABLE "transactions" ADD COLUMN "initiator_id_new" INTEGER;
UPDATE "transactions" AS entry
SET "initiator_id_new" = users."id_new"
FROM "users" AS users
WHERE entry."initiator_id" = users."id";
ALTER TABLE "transactions" DROP COLUMN "initiator_id";
ALTER TABLE "transactions" RENAME COLUMN "initiator_id_new" TO "initiator_id";
ALTER TABLE "transactions" ALTER COLUMN "initiator_id" SET NOT NULL;
CREATE INDEX "transactions_initiator_id_idx" ON "transactions"("initiator_id");

DROP INDEX "refund_requests_initiator_id_idx";
ALTER TABLE "refund_requests" ADD COLUMN "initiator_id_new" INTEGER;
UPDATE "refund_requests" AS request
SET "initiator_id_new" = users."id_new"
FROM "users" AS users
WHERE request."initiator_id" = users."id";
ALTER TABLE "refund_requests" DROP COLUMN "initiator_id";
ALTER TABLE "refund_requests" RENAME COLUMN "initiator_id_new" TO "initiator_id";
ALTER TABLE "refund_requests" ALTER COLUMN "initiator_id" SET NOT NULL;
CREATE INDEX "refund_requests_initiator_id_idx" ON "refund_requests"("initiator_id");

ALTER TABLE "users" DROP CONSTRAINT "users_pkey";
ALTER TABLE "users" DROP COLUMN "id";
ALTER TABLE "users" RENAME COLUMN "id_new" TO "id";
ALTER TABLE "users" ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");
ALTER SEQUENCE "users_id_seq" OWNED BY "users"."id";

ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "gateway_attempts" ADD CONSTRAINT "gateway_attempts_initiator_id_fkey" FOREIGN KEY ("initiator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_initiator_id_fkey" FOREIGN KEY ("initiator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_initiator_id_fkey" FOREIGN KEY ("initiator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
