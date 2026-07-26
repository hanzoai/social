import { IsEnum } from 'class-validator';
import { ShortLinkPreference } from '../../database/prisma/enums';

export class ShortlinkPreferenceDto {
  @IsEnum(ShortLinkPreference)
  shortlink: ShortLinkPreference;
}

