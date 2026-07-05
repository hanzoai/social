// Hanzo Tasks module builder. The prior nestjs-temporal-core wiring is replaced
// by the @hanzoai/tasks integration in ./tasks — durable execution on the ONE
// engine embedded in cloud (gated ZAP :9999), no upstream Temporal.
export { getTemporalModule } from './tasks';
