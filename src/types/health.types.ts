export interface HealthStatus {
  status: string;
  service: string;
  environment: string;
  database: string;
  uptimeSeconds: number;
  timestamp: string;
}
