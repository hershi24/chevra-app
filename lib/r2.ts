import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

export function isR2Enabled() {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET &&
      process.env.R2_PUBLIC_URL
  );
}

function client() {
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

export async function uploadToR2(opts: {
  key: string;
  body: Buffer;
  contentType: string;
}) {
  const bucket = process.env.R2_BUCKET!;
  await client().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: opts.key,
      Body: opts.body,
      ContentType: opts.contentType || "application/octet-stream",
    })
  );
  const base = process.env.R2_PUBLIC_URL!.replace(/\/$/, "");
  return `${base}/${opts.key}`;
}
