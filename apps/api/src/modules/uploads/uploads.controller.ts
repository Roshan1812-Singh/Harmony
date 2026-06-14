import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { IsInt, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CsrfGuard } from '../../common/guards/csrf.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { UploadsService } from './uploads.service';
import { MAX_AUDIO_UPLOAD_BYTES, MAX_IMAGE_UPLOAD_BYTES } from '@harmony/shared';

class SignAudioDto {
  @IsString() @MinLength(1) @MaxLength(255) filename!: string;
  @IsString() contentType!: string;
  @IsInt() @Min(1) @Max(MAX_AUDIO_UPLOAD_BYTES) size!: number;
}

class SignImageDto {
  @IsString() @MinLength(1) @MaxLength(255) filename!: string;
  @IsString() contentType!: string;
  @IsInt() @Min(1) @Max(MAX_IMAGE_UPLOAD_BYTES) size!: number;
}

@ApiTags('uploads')
@ApiCookieAuth()
@UseGuards(JwtAuthGuard, RolesGuard, CsrfGuard)
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Roles('ARTIST', 'ADMIN')
  @Post('audio/sign')
  signAudio(@CurrentUser() user: AuthUser, @Body() dto: SignAudioDto) {
    return this.uploads.signAudio(user.id, dto);
  }

  @Post('image/sign')
  signImage(@CurrentUser() user: AuthUser, @Body() dto: SignImageDto) {
    return this.uploads.signImage(user.id, dto);
  }
}
