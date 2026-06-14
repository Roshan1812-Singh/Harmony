import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(10)
  @MaxLength(256)
  token!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(/[A-Za-z]/)
  @Matches(/\d/)
  @Matches(/[^A-Za-z0-9]/)
  password!: string;
}

export class VerifyEmailDto {
  @ApiProperty()
  @IsString()
  @MinLength(10)
  @MaxLength(256)
  token!: string;
}
