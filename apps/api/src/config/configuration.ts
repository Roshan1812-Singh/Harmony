/**
 * Centralised, typed config object. `ConfigService<AppConfig, true>` is used everywhere
 * so misspelled keys are compile-time errors.
 */
export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  globalPrefix: string;
  logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
  webOrigin: string;

  database: {
    url: string;
  };

  redis: {
    url: string;
  };

  elasticsearch: {
    node: string | null;
  };

  jwt: {
    accessPrivateKey: string;
    accessPublicKey: string;
    accessTtl: string;
    refreshTtl: string;
    issuer: string;
  };

  cookie: {
    domain: string;
    secure: boolean;
    sameSite: 'lax' | 'strict' | 'none';
  };

  corsOrigins: string[];

  oauth: {
    google: { clientId: string; clientSecret: string };
    github: { clientId: string; clientSecret: string };
  };

  s3: {
    endpoint: string | null;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucketRaw: string;
    bucketStream: string;
    bucketPublicArt: string;
    forcePathStyle: boolean;
  };

  cloudfront: {
    domain: string | null;
    keyPairId: string | null;
    privateKeyPem: string | null;
  };

  mail: {
    host: string;
    port: number;
    user: string | null;
    pass: string | null;
    from: string;
  };

  throttleTtlMs: number;
  throttleLimit: number;

  sentryDsn: string | null;
}

const bool = (v: string | undefined, dflt: boolean) =>
  v === undefined ? dflt : ['1', 'true', 'yes'].includes(v.toLowerCase());

const orNull = (v: string | undefined) => (v && v.length > 0 ? v : null);

export const configuration = (): AppConfig => ({
  nodeEnv: (process.env.NODE_ENV as AppConfig['nodeEnv']) ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  globalPrefix: process.env.API_GLOBAL_PREFIX ?? 'api/v1',
  logLevel: (process.env.LOG_LEVEL as AppConfig['logLevel']) ?? 'info',
  webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',

  // Allowed browser origins for CORS (comma-separated). Defaults to WEB_ORIGIN.
  // Include the deployed frontend and any LAN/dev origins, e.g.
  // CORS_ORIGINS=https://harmony.vercel.app,http://192.168.1.20:3000
  corsOrigins: (process.env.CORS_ORIGINS ?? process.env.WEB_ORIGIN ?? 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),

  database: { url: process.env.DATABASE_URL ?? '' },
  redis: { url: process.env.REDIS_URL ?? 'redis://localhost:6379' },
  elasticsearch: { node: orNull(process.env.ELASTICSEARCH_NODE) },

  jwt: {
    accessPrivateKey: process.env.JWT_ACCESS_PRIVATE_KEY ?? '',
    accessPublicKey: process.env.JWT_ACCESS_PUBLIC_KEY ?? '',
    accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
    refreshTtl: process.env.JWT_REFRESH_TTL ?? '30d',
    issuer: process.env.JWT_ISSUER ?? 'harmony',
  },

  cookie: {
    domain: process.env.COOKIE_DOMAIN ?? 'localhost',
    secure: bool(process.env.COOKIE_SECURE, false),
    // Cross-site clients (deployed frontend / Android WebView on another domain)
    // require SameSite=None + Secure. Local dev stays Lax.
    sameSite: (process.env.COOKIE_SAMESITE as AppConfig['cookie']['sameSite']) ?? 'lax',
  },

  oauth: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID ?? '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
    },
  },

  s3: {
    endpoint: orNull(process.env.S3_ENDPOINT),
    region: process.env.S3_REGION ?? 'us-east-1',
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
    bucketRaw: process.env.S3_BUCKET_RAW ?? 'harmony-raw',
    bucketStream: process.env.S3_BUCKET_STREAM ?? 'harmony-stream',
    bucketPublicArt: process.env.S3_BUCKET_PUBLIC_ART ?? 'harmony-public-art',
    forcePathStyle: bool(process.env.S3_FORCE_PATH_STYLE, true),
  },

  cloudfront: {
    domain: orNull(process.env.CLOUDFRONT_DOMAIN),
    keyPairId: orNull(process.env.CLOUDFRONT_KEY_PAIR_ID),
    privateKeyPem: orNull(process.env.CLOUDFRONT_PRIVATE_KEY_PEM),
  },

  mail: {
    host: process.env.SMTP_HOST ?? 'localhost',
    port: Number(process.env.SMTP_PORT ?? 1025),
    user: orNull(process.env.SMTP_USER),
    pass: orNull(process.env.SMTP_PASS),
    from: process.env.SMTP_FROM ?? 'Harmony <no-reply@harmony.local>',
  },

  throttleTtlMs: Number(process.env.THROTTLE_TTL_MS ?? 60_000),
  throttleLimit: Number(process.env.THROTTLE_LIMIT ?? 120),

  sentryDsn: orNull(process.env.SENTRY_DSN),
});
