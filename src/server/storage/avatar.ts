import { randomUUID } from "node:crypto";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import sharp from "sharp";

export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

/** Decode the actual image rather than trusting its filename or MIME type. */
export async function avatarToWebp(input: Buffer): Promise<Buffer> {
  const image = sharp(input, { limitInputPixels: 40_000_000, failOn: "error" });
  const metadata = await image.metadata();
  if (!metadata.format || !["jpeg", "png", "webp", "gif", "heif", "tiff"].includes(metadata.format)) {
    throw new Error("Unsupported image format");
  }
  return image.rotate().resize(1024, 1024, { fit: "inside", withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
}

function storage() {
  const { LIARA_ENDPOINT, LIARA_BUCKET_NAME, LIARA_ACCESS_KEY, LIARA_SECRET_KEY, LIARA_PUBLIC_URL } = process.env;
  if (!LIARA_ENDPOINT || !LIARA_BUCKET_NAME || !LIARA_ACCESS_KEY || !LIARA_SECRET_KEY || !LIARA_PUBLIC_URL) {
    throw new Error("Object storage is not configured");
  }
  const publicUrl = new URL(LIARA_PUBLIC_URL);
  if (!["https:", "http:"].includes(publicUrl.protocol) || publicUrl.search || publicUrl.hash || publicUrl.username || publicUrl.password) {
    throw new Error("Invalid object storage public URL");
  }
  return {
    bucket: LIARA_BUCKET_NAME,
    publicUrl: publicUrl.toString().replace(/\/$/, ""),
    client: new S3Client({
      region: "default", endpoint: LIARA_ENDPOINT, forcePathStyle: true,
      requestChecksumCalculation: "WHEN_REQUIRED", responseChecksumValidation: "WHEN_REQUIRED",
      credentials: { accessKeyId: LIARA_ACCESS_KEY, secretAccessKey: LIARA_SECRET_KEY },
    }),
  };
}

export async function uploadAvatar(userId: number, body: Buffer) {
  const { client, bucket, publicUrl } = storage();
  const key = `avatars/${userId}/${randomUUID()}.webp`;
  await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: "image/webp" }));
  return { url: `${publicUrl}/${key}`, async rollback() { await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })); } };
}

/** Only delete keys created for this user under the currently configured public bucket URL. */
export async function deleteAvatar(userId: number, avatarUrl: string): Promise<void> {
  const { client, bucket, publicUrl } = storage();
  const prefix = `${publicUrl}/avatars/${userId}/`;
  if (!avatarUrl.startsWith(prefix)) return;
  const filename = avatarUrl.slice(prefix.length);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$/i.test(filename)) return;
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: `avatars/${userId}/${filename}` }));
}
