import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import type { S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getSignedUrl as cfGetSignedUrl } from '@aws-sdk/cloudfront-signer';
import type { AppConfig } from '../../config/configuration';
import { S3_CLIENT } from './s3.tokens';

interface SignedPutOptions {
  bucket: string;
  key: string;
  contentType: string;
  contentLengthMax: number;
  expiresInSec?: number;
}

@Injectable()
export class S3Service {
  constructor(
    @Inject(S3_CLIENT) private readonly client: S3Client,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  /**
   * Returns a pre-signed PUT URL with strict content-length-range constraints.
   * The browser uploads directly to S3, bypassing the API node.
   */
  async signPut(opts: SignedPutOptions): Promise<{ url: string; expiresAt: Date }> {
    const cmd = new PutObjectCommand({
      Bucket: opts.bucket,
      Key: opts.key,
      ContentType: opts.contentType,
      ContentLength: opts.contentLengthMax,
    });
    const expiresIn = opts.expiresInSec ?? 300;
    const url = await getSignedUrl(this.client, cmd, { expiresIn });
    return { url, expiresAt: new Date(Date.now() + expiresIn * 1000) };
  }

  /** Pre-signed GET (used as a fallback when CloudFront is not configured). */
  async signGet(bucket: string, key: string, expiresInSec = 3600): Promise<string> {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: bucket, Key: key }), {
      expiresIn: expiresInSec,
    });
  }

  /**
   * CloudFront signed URL — preferred for prod (it stays cached at the edge).
   * In dev (no CloudFront configured) we fall back to a presigned S3 URL.
   */
  async signStreamUrl(key: string, expiresInSec = 3600): Promise<string> {
    const cf = this.config.get('cloudfront', { infer: true });
    if (cf.domain && cf.keyPairId && cf.privateKeyPem) {
      return cfGetSignedUrl({
        url: `https://${cf.domain}/${key}`,
        keyPairId: cf.keyPairId,
        privateKey: cf.privateKeyPem,
        dateLessThan: new Date(Date.now() + expiresInSec * 1000).toISOString(),
      });
    }
    return this.signGet(this.config.get('s3', { infer: true }).bucketStream, key, expiresInSec);
  }

  async delete(bucket: string, key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  }

  buckets() {
    return this.config.get('s3', { infer: true });
  }
}
