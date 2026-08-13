const { CacheHandler } = require('@neshca/cache-handler');
const createRedisHandler = require('@neshca/cache-handler/redis-strings').default;
const { createClient } = require('redis');

CacheHandler.onCreation(async () => {
    if (process.env.DISABLE_REDIS_CACHE === 'true') {
        return { handlers: [] };
    }

    let client;

    try {
        // Create a Redis client.
        // It connects to localhost:6379 by default if no URL is provided, which works 
        // on development. In production Docker, it will use process.env.REDIS_URL
        client = createClient({
            url: process.env.REDIS_URL ?? 'redis://localhost:6379/1',
        });

        // Redis won't work without error handling.
        client.on('error', (error) => {
            console.error('Redis Error:', error);
        });
    } catch (error) {
        console.warn('Failed to create Redis client:', error);
    }

    if (client) {
        try {
            await client.connect();
            console.info('Redis connected. Next.js Cache is now extremely fast.');
        } catch (error) {
            console.warn('Failed to connect Redis client:', error);
            // We must not throw an error here, or Next.js will crash
        }
    }

    let handler;
    if (client && client.isOpen) {
        handler = createRedisHandler({
            client,
            keyPrefix: 'next_pwa_cache:',
        });
    }

    return {
        handlers: handler ? [handler] : [],
    };
});

module.exports = CacheHandler;
