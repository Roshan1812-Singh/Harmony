import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Thin Prisma wrapper that:
 *   – Connects eagerly on boot (`onModuleInit`) so the first request isn't slow.
 *   – Disconnects on shutdown.
 *   – Logs slow queries (>200ms) at warn level. Tune in production via env if noisy.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'warn' },
        { emit: 'event', level: 'error' },
      ],
    });

    this.$on('query' as never, (e: { duration: number; query: string }) => {
      if (e.duration > 200) {
        this.logger.warn(`Slow query (${e.duration}ms): ${e.query.slice(0, 200)}`);
      }
    });
  }

  async onModuleInit(): Promise<void> {
    // Managed Postgres (Neon free tier) can be briefly unreachable while it wakes
    // from suspend. Retry a few times, and if it still fails, continue rather than
    // crash the whole process — Prisma will connect lazily on the first query.
    const attempts = 5;
    for (let i = 1; i <= attempts; i++) {
      try {
        await this.$connect();
        return;
      } catch (err) {
        this.logger.warn(
          `DB connect attempt ${i}/${attempts} failed: ${(err as Error).message}`,
        );
        if (i === attempts) {
          this.logger.error('Could not connect to the database on boot; continuing with lazy connect.');
          return;
        }
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
