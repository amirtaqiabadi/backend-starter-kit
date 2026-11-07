-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('owner', 'admin', 'member', 'viewer');

-- CreateEnum
CREATE TYPE "TeamMemberStatus" AS ENUM ('pending_owner_approval', 'active', 'revoked', 'left');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('deposit', 'bonus_deposit', 'gift_card_credit', 'gift_credit', 'direct_bank_deposit', 'wallet_transfer_in', 'gateway_credit', 'anonymous_gateway_credit', 'service_credit', 'refund_cancellation', 'service_cancel_credit', 'refund', 'bonus_expiration', 'service_debit', 'accommodation_renewal', 'user_verification', 'reverse');

-- CreateEnum
CREATE TYPE "GatewayType" AS ENUM ('zarinpal', 'zibal', 'sep');

-- CreateEnum
CREATE TYPE "GatewayAttemptStatus" AS ENUM ('10-pending', '50-successful', '70-reverse_pending', '80-failed', '90-reversed');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('10-pending', '30-processing', '50-paid', '80-rejected', '90-failed');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "phone_number" CHAR(11) NOT NULL,
    "name" TEXT,
    "password_hash" TEXT,
    "password_set_at" TIMESTAMP(3),
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_events" (
    "id" TEXT NOT NULL,
    "user_id" INTEGER,
    "phone_masked" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "user_agent" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" SERIAL NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_members" (
    "id" SERIAL NOT NULL,
    "team_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "display_name" TEXT,
    "role" "MemberRole" NOT NULL DEFAULT 'member',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "status" "TeamMemberStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gateway_attempts" (
    "id" SERIAL NOT NULL,
    "merchant_correlation_key" VARCHAR(64) NOT NULL,
    "initiator_id" INTEGER NOT NULL,
    "team_id" INTEGER NOT NULL,
    "accommodation_id" INTEGER,
    "type" "GatewayType" NOT NULL,
    "transaction_type" VARCHAR(64) NOT NULL DEFAULT 'gateway_credit',
    "status" "GatewayAttemptStatus" NOT NULL DEFAULT '10-pending',
    "callback_url" TEXT,
    "session_token" TEXT,
    "reference_id" TEXT,
    "tracking_number" TEXT,
    "masked_pan" TEXT,
    "hashed_pan" TEXT,
    "salt" TEXT,
    "amount" BIGINT NOT NULL,
    "fee" BIGINT NOT NULL,
    "metadata" JSONB,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gateway_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" SERIAL NOT NULL,
    "initiator_id" INTEGER NOT NULL,
    "team_id" INTEGER NOT NULL,
    "gateway_attempt_id" INTEGER,
    "accommodation_id" INTEGER,
    "booking_id" INTEGER,
    "type" "TransactionType" NOT NULL,
    "amount" BIGINT NOT NULL,
    "available_balance_after" BIGINT NOT NULL,
    "restricted_balance_after" BIGINT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refund_requests" (
    "id" SERIAL NOT NULL,
    "initiator_id" INTEGER NOT NULL,
    "team_id" INTEGER NOT NULL,
    "transaction_id" INTEGER NOT NULL,
    "card_number" CHAR(16) NOT NULL,
    "amount" BIGINT NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT '10-pending',
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refund_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_number_key" ON "users"("phone_number");

-- CreateIndex
CREATE INDEX "teams_updated_at_idx" ON "teams"("updated_at");

-- CreateIndex
CREATE INDEX "team_members_team_id_idx" ON "team_members"("team_id");

-- CreateIndex
CREATE INDEX "team_members_user_id_idx" ON "team_members"("user_id");

-- CreateIndex
CREATE INDEX "team_members_status_idx" ON "team_members"("status");

-- CreateIndex
CREATE UNIQUE INDEX "team_members_team_id_user_id_key" ON "team_members"("team_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "gateway_attempts_merchant_correlation_key_key" ON "gateway_attempts"("merchant_correlation_key");

-- CreateIndex
CREATE INDEX "gateway_attempts_type_idx" ON "gateway_attempts"("type");

-- CreateIndex
CREATE INDEX "gateway_attempts_transaction_type_idx" ON "gateway_attempts"("transaction_type");

-- CreateIndex
CREATE INDEX "gateway_attempts_status_idx" ON "gateway_attempts"("status");

-- CreateIndex
CREATE INDEX "gateway_attempts_reference_id_idx" ON "gateway_attempts"("reference_id");

-- CreateIndex
CREATE INDEX "gateway_attempts_created_at_idx" ON "gateway_attempts"("created_at");

-- CreateIndex
CREATE INDEX "gateway_attempts_updated_at_idx" ON "gateway_attempts"("updated_at");

-- CreateIndex
CREATE INDEX "gateway_attempts_initiator_id_team_id_status_idx" ON "gateway_attempts"("initiator_id", "team_id", "status");

-- CreateIndex
CREATE INDEX "gateway_attempts_accommodation_id_idx" ON "gateway_attempts"("accommodation_id");

-- CreateIndex
CREATE INDEX "transactions_initiator_id_idx" ON "transactions"("initiator_id");

-- CreateIndex
CREATE INDEX "transactions_team_id_idx" ON "transactions"("team_id");

-- CreateIndex
CREATE INDEX "transactions_gateway_attempt_id_idx" ON "transactions"("gateway_attempt_id");

-- CreateIndex
CREATE INDEX "transactions_accommodation_id_idx" ON "transactions"("accommodation_id");

-- CreateIndex
CREATE INDEX "transactions_booking_id_idx" ON "transactions"("booking_id");

-- CreateIndex
CREATE INDEX "transactions_type_idx" ON "transactions"("type");

-- CreateIndex
CREATE INDEX "transactions_created_at_idx" ON "transactions"("created_at");

-- CreateIndex
CREATE INDEX "transactions_updated_at_idx" ON "transactions"("updated_at");

-- CreateIndex
CREATE INDEX "transactions_team_id_created_at_idx" ON "transactions"("team_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "transactions_type_gateway_attempt_id_key" ON "transactions"("type", "gateway_attempt_id");

-- CreateIndex
CREATE UNIQUE INDEX "refund_requests_transaction_id_key" ON "refund_requests"("transaction_id");

-- CreateIndex
CREATE INDEX "refund_requests_team_id_idx" ON "refund_requests"("team_id");

-- CreateIndex
CREATE INDEX "refund_requests_initiator_id_idx" ON "refund_requests"("initiator_id");

-- CreateIndex
CREATE INDEX "refund_requests_status_idx" ON "refund_requests"("status");

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gateway_attempts" ADD CONSTRAINT "gateway_attempts_initiator_id_fkey" FOREIGN KEY ("initiator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gateway_attempts" ADD CONSTRAINT "gateway_attempts_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_initiator_id_fkey" FOREIGN KEY ("initiator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_gateway_attempt_id_fkey" FOREIGN KEY ("gateway_attempt_id") REFERENCES "gateway_attempts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_initiator_id_fkey" FOREIGN KEY ("initiator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Stored numbers stay in the only accepted local Iranian format.
ALTER TABLE "users" ADD CONSTRAINT "users_phone_number_format" CHECK ("phone_number" ~ '^09[0-9]{9}$');

-- A refund destination is the 16 digits themselves.
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_card_number_format" CHECK ("card_number" ~ '^[0-9]{16}$');

