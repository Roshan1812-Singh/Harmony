import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client as EsClient } from '@elastic/elasticsearch';
import type { AppConfig } from '../../config/configuration';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { SearchIndexerService } from './search-indexer.service';
import { ES_CLIENT } from './search.tokens';

@Global()
@Module({
  controllers: [SearchController],
  providers: [
    {
      provide: ES_CLIENT,
      inject: [ConfigService],
      useFactory: (cfg: ConfigService<AppConfig, true>) => {
        const node = cfg.get('elasticsearch', { infer: true }).node;
        if (!node) return null; // Service falls back to PG FTS.
        return new EsClient({ node, requestTimeout: 5_000, maxRetries: 1 });
      },
    },
    SearchService,
    SearchIndexerService,
  ],
  exports: [SearchService, SearchIndexerService, ES_CLIENT],
})
export class SearchModule {}
