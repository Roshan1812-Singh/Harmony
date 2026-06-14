import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { SearchService } from './search.service';

@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Public()
  @Get()
  query(@Query('q') q = '', @Query('type') type = 'track,album,artist') {
    const types = type
      .split(',')
      .filter((t): t is 'track' | 'album' | 'artist' => ['track', 'album', 'artist'].includes(t));
    return this.search.search(q, types);
  }

  @Public()
  @Get('autocomplete')
  autocomplete(@Query('q') q = '') {
    return this.search.autocomplete(q);
  }
}
