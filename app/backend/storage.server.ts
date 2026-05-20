import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

let _s3: S3Client | null = null;

function getS3Client() {
  if (!_s3) {
    const endpoint = process.env.R2_ENDPOINT;
    const accessKeyId = process.env.R2_ACCESS_KEY;
    const secretAccessKey = process.env.R2_SECRET_KEY;

    if (!endpoint || !accessKeyId || !secretAccessKey) {
      console.warn("[Storage] Cloudflare R2 / AWS S3 credentials are not fully configured in environment variables.");
    }

    _s3 = new S3Client({
      region: "auto",
      endpoint: endpoint || "https://placeholder-endpoint.r2.cloudflarestorage.com",
      credentials: {
        accessKeyId: accessKeyId || "placeholder-key",
        secretAccessKey: secretAccessKey || "placeholder-secret",
      },
    });
  }
  return _s3;
}

export async function uploadFile(fileName: string, body: Buffer, contentType: string) {
  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY;
  const secretAccessKey = process.env.R2_SECRET_KEY;
  const bucketName = process.env.R2_BUCKET_NAME;

  if (!endpoint || !accessKeyId || !secretAccessKey || !bucketName) {
    throw new Error("Cannot upload: S3/R2 storage is not configured. Check env variables.");
  }

  const s3Client = getS3Client();
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: fileName,
    Body: body,
    ContentType: contentType,
  });

  try {
    await s3Client.send(command);
    return `${process.env.R2_PUBLIC_DOMAIN || ""}/${fileName}`;
  } catch (error) {
    console.error("R2 Upload Error:", error);
    throw error;
  }
}

