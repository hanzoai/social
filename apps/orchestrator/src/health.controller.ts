import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { Connection, Client } from '@hanzoai/tasks';
import { iamTokenSource } from '@social/nestjs-libraries/temporal/tasks';

@Controller('health')
export class HealthController {
  @Get('/status')
  async getHealthStatus(@Res() res: Response) {
    let connection: Connection | undefined;
    try {
      const address = process.env.TASKS_ADDRESS || 'cloud.hanzo.svc:9999';
      connection = await Connection.connect({ address, token: iamTokenSource });
      const client = await Client.create({
        connection,
        namespace: process.env.TASKS_NAMESPACE || 'default',
      });
      await Promise.race([
        client.connection.health(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 10000)
        ),
      ]);
      return res.status(200).json({ status: 'ok' });
    } catch {
      return res.status(500).json({ status: 'error' });
    } finally {
      await connection?.close().catch(() => {});
    }
  }
}
