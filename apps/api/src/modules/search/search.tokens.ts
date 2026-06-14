/**
 * Injection token for the Elasticsearch client.
 *
 * Kept in its own module so the providers that inject it
 * (`SearchService`, `SearchIndexerService`) don't have to import
 * `search.module.ts`, which would create a circular import.
 */
export const ES_CLIENT = Symbol('ES_CLIENT');
