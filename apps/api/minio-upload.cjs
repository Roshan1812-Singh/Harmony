/* One-off: upload pre-baked HLS for seed tracks into the harmony-stream bucket. */
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { readdir, readFile } = require('node:fs/promises');
const { join } = require('node:path');

const s3 = new S3Client({
  endpoint: 'http://127.0.0.1:9000',
  region: 'us-east-1',
  forcePathStyle: true,
  credentials: { accessKeyId: 'minioadmin', secretAccessKey: 'minioadmin' },
});

const BUCKET = 'harmony-stream';
const ROOT = 'C:/Users/rosha/harmony_audio';
const SLUGS = ['drifting', 'cirrus', 'halcyon'];

function contentType(name) {
  if (name.endsWith('.mp3')) return 'audio/mpeg';
  if (name.endsWith('.m3u8')) return 'application/vnd.apple.mpegurl';
  if (name.endsWith('.ts')) return 'video/mp2t';
  return 'application/octet-stream';
}

async function uploadDir(localDir, keyPrefix) {
  let count = 0;
  const walk = async (dir, rel = '') => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      const relPath = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        await walk(full, relPath);
        continue;
      }
      if (entry.name === 'source.mp3') continue; // skip raw source
      const Body = await readFile(full);
      await s3.send(
        new PutObjectCommand({
          Bucket: BUCKET,
          Key: `${keyPrefix}/${relPath}`,
          Body,
          ContentType: contentType(entry.name),
          CacheControl: 'public, max-age=604800, immutable',
        }),
      );
      count++;
    }
  };
  await walk(localDir);
  return count;
}

async function main() {
  for (const slug of SLUGS) {
    const prefix = `stream/seed/${slug}`;
    const n = await uploadDir(join(ROOT, slug), prefix);
    console.log(`uploaded ${n} objects -> ${prefix}/`);
  }
  console.log('✅ HLS upload complete');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
