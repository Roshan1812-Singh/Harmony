import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { LICENSES, type License } from '@harmony/shared';

export class CreateTrackDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  albumId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(999)
  trackNumber?: number;

  @ApiProperty({ default: false })
  @IsBoolean()
  @IsOptional()
  explicit?: boolean;

  @ApiProperty({ enum: LICENSES })
  @IsEnum(LICENSES)
  license!: License;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsUUID('all', { each: true })
  genreIds?: string[];

  @ApiProperty()
  @IsString()
  @MaxLength(512)
  sourceKey!: string;
}

export class UpdateTrackDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) @MaxLength(200) title?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() explicit?: boolean;
  @ApiPropertyOptional({ enum: LICENSES }) @IsOptional() @IsEnum(LICENSES) license?: License;
  @ApiPropertyOptional() @IsOptional() @IsArray() @IsUUID('all', { each: true }) genreIds?: string[];
}
