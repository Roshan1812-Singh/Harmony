import { Injectable, OnModuleInit } from '@nestjs/common';
import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit {
  readonly registry = new Registry();

  readonly httpRequests = new Counter({
    name: 'harmony_http_requests_total',
    help: 'Total HTTP requests handled.',
    labelNames: ['method', 'route', 'status'] as const,
  });

  readonly httpDuration = new Histogram({
    name: 'harmony_http_request_duration_seconds',
    help: 'HTTP request duration in seconds.',
    labelNames: ['method', 'route', 'status'] as const,
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  });

  readonly playbacks = new Counter({
    name: 'harmony_track_plays_total',
    help: 'Tracks fully played (>= 30s).',
    labelNames: ['license'] as const,
  });

  readonly transcodingJobs = new Counter({
    name: 'harmony_transcoding_jobs_total',
    help: 'Transcoding jobs by outcome.',
    labelNames: ['outcome'] as const,
  });

  onModuleInit(): void {
    collectDefaultMetrics({ register: this.registry, prefix: 'harmony_' });
    this.registry.registerMetric(this.httpRequests);
    this.registry.registerMetric(this.httpDuration);
    this.registry.registerMetric(this.playbacks);
    this.registry.registerMetric(this.transcodingJobs);
  }

  async render(): Promise<string> {
    return this.registry.metrics();
  }
}
