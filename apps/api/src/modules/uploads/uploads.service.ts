import { BadRequestException, Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { ACCEPTED_AUDIO_MIME, ACCEPTED_IMAGE_MIME, MAX_AUDIO_UPLOAD_BYTES, MAX_IMAGE_UPLOAD_BYTES } from '@harmony/shared';
import { S3Service } from '../../common/s3/s3.service';

export interface SignAudioInput {
  filename: string;
  contentType: string;
  size: number;
}

@Injectable()
export class UploadsService {
  constructor(private readonly s3: S3Service) {}

  async signAudio(userId: string, input: SignAudioInput) {
    if (!(ACCEPTED_AUDIO_MIME as readonly string[]).includes(input.contentType)) {
      throw new BadRequestException('Unsupported audio MIME');
    }
    if (input.size > MAX_AUDIO_UPLOAD_BYTES) {
      throw new BadRequestException('File exceeds 100 MB');
    }
    const buckets = this.s3.buckets();
    const ext = input.filename.split('.').pop()?.replace(/[^a-z0-9]/gi, '') ?? 'bin';
    const key = `raw/${userId}/${uuidv4()}.${ext.toLowerCase()}`;
    const signed = await this.s3.signPut({
      bucket: buckets.bucketRaw,
      key,
      contentType: input.contentType,
      contentLengthMax: input.size,
      expiresInSec: 300,
    });
    return { uploadUrl: signed.url, key, expiresAt: signed.expiresAt.toISOString() };
  }

  async signImage(userId: string, input: SignAudioInput) {
    if (!(ACCEPTED_IMAGE_MIME as readonly string[]).includes(input.contentType)) {
      throw new BadRequestException('Unsupported image MIME');
    }
    if (input.size > MAX_IMAGE_UPLOAD_BYTES) {
      throw new BadRequestException('Image exceeds 5 MB');
    }
    const buckets = this.s3.buckets();
    const ext = input.filename.split('.').pop()?.replace(/[^a-z0-9]/gi, '') ?? 'jpg';
    const key = `art/${userId}/${uuidv4()}.${ext.toLowerCase()}`;
    const signed = await this.s3.signPut({
      bucket: buckets.bucketPublicArt,
      key,
      contentType: input.contentType,
      contentLengthMax: input.size,
      expiresInSec: 300,
    });
    return { uploadUrl: signed.url, key, expiresAt: signed.expiresAt.toISOString() };
  }
}
