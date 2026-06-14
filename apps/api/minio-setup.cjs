/* One-off: create local MinIO buckets and make stream/art buckets public + CORS. */
const {
  S3Client,
  CreateBucketCommand,
  PutBucketPolicyCommand,
} = require('@aws-sdk/client-s3');

const s3 = new S3Client({
  endpoint: 'http://127.0.0.1:9000',
  region: 'us-east-1',
  forcePathStyle: true,
  credentials: { accessKeyId: 'minioadmin', secretAccessKey: 'minioadmin' },
});

const BUCKETS = ['harmony-raw', 'harmony-stream', 'harmony-public-art'];
const PUBLIC = ['harmony-stream', 'harmony-public-art'];

const publicReadPolicy = (bucket) =>
  JSON.stringify({
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Principal: { AWS: ['*'] },
        Action: ['s3:GetObject'],
        Resource: [`arn:aws:s3:::${bucket}/*`],
      },
    ],
  });

async function main() {
  for (const Bucket of BUCKETS) {
    try {
      await s3.send(new CreateBucketCommand({ Bucket }));
      console.log(`created bucket ${Bucket}`);
    } catch (e) {
      if (e.name === 'BucketAlreadyOwnedByYou' || e.name === 'BucketAlreadyExists') {
        console.log(`bucket ${Bucket} already exists`);
      } else {
        throw e;
      }
    }
  }

  for (const Bucket of PUBLIC) {
    await s3.send(new PutBucketPolicyCommand({ Bucket, Policy: publicReadPolicy(Bucket) }));
    console.log(`public-read policy set on ${Bucket}`);
  }
  console.log('✅ MinIO setup complete');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
