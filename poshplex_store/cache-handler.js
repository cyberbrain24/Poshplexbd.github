const { CacheHandler } = require('@neshca/cache-handler');
const createRedisHandler = require('@neshca/cache-handler/redis-strings').default;
const { createClient } = require('redis');

CacheHandler.onCreation(async () => {
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

    /**
     * Use the custom Redis Cache Handler.
     * The `redis-strings` adapter stringifies and stores JSON cache data directly in Redis keys.
     */
    const handler = client
        ? createRedisHandler({
              client,
              keyPrefix: 'next_pwa_cache:',
          })
        : undefined; // Fallback to Next.js default if Redis is down

    return {
        handlers: [handler],
    };
});

module.exports = CacheHandler;
