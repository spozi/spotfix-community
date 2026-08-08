import { env } from './config/env';
import { logger } from './config/logger';
import { connectDatabase, disconnectDatabase } from './infra/db';
import { createApp } from './app';

async function bootstrap(): Promise<void> {
    try {
        await connectDatabase();
    } catch (err) {
        logger.fatal({ err }, 'Failed to connect to Postgres');
        process.exit(1);
    }

    const app = createApp();
    const server = app.listen(env.PORT, env.HOST, () => {
        logger.info({ host: env.HOST, port: env.PORT, env: env.NODE_ENV }, 'API listening');
    });

    const shutdown = async (signal: string): Promise<void> => {
        logger.info({ signal }, 'Shutting down API');
        server.close(async () => {
            try {
                await disconnectDatabase();
            } catch (err) {
                logger.error({ err }, 'Error disconnecting from Postgres');
            }
            process.exit(0);
        });

        // Hard exit if shutdown takes too long.
        setTimeout(() => process.exit(1), 10_000).unref();
    };

    process.on('SIGTERM', () => void shutdown('SIGTERM'));
    process.on('SIGINT', () => void shutdown('SIGINT'));
}

bootstrap().catch((err) => {
    logger.fatal({ err }, 'Fatal error during bootstrap');
    process.exit(1);
});
