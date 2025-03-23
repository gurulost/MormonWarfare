import { z } from 'zod';

/**
 * Environment configuration schema with validation
 */
const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().optional(),
  
  // Server settings
  PORT: z.string().transform(Number).default('5000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // Session and security
  SESSION_SECRET: z.string().default('book-of-mormon-war-game-secret'),
  
  // Feature flags - add as needed
  ENABLE_WEBSOCKETS: z.string()
    .transform(val => val.toLowerCase() === 'true')
    .default('true'),
  
  // Deployment specific
  IS_REPLIT: z.string()
    .transform(val => val.toLowerCase() === 'true')
    .default('false'),
});

/**
 * Type for the validated environment
 */
export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Parse and validate environment variables
 */
function getEnvConfig(): EnvConfig {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const formatted = error.format();
      console.error('❌ Invalid environment variables:', formatted);
    } else {
      console.error('❌ Error parsing environment variables:', error);
    }
    
    // Continue with defaults where possible
    return envSchema.parse({
      ...process.env,
      NODE_ENV: process.env.NODE_ENV || 'development',
      PORT: process.env.PORT || '5000',
      SESSION_SECRET: process.env.SESSION_SECRET || 'book-of-mormon-war-game-secret',
      ENABLE_WEBSOCKETS: process.env.ENABLE_WEBSOCKETS || 'true',
      IS_REPLIT: process.env.IS_REPLIT || 'false'
    });
  }
}

/**
 * Validated environment configuration
 */
export const config = getEnvConfig();

/**
 * Get the database URL with proper validation and fallback
 */
export function getDatabaseUrl(): string {
  // For Replit, provides in-memory or fallback databases when needed
  if (config.IS_REPLIT && !config.DATABASE_URL) {
    console.warn('⚠️ No DATABASE_URL provided. Using in-memory database for development.');
    return 'postgres://postgres:postgres@localhost:5432/postgres';
  }
  
  if (!config.DATABASE_URL) {
    console.warn('⚠️ No DATABASE_URL provided. Using local development database.');
    return 'postgres://postgres:postgres@localhost:5432/postgres';
  }
  
  return config.DATABASE_URL;
}

/**
 * Check if we're in production mode
 */
export function isProduction(): boolean {
  return config.NODE_ENV === 'production';
}

/**
 * Check if we're in development mode
 */
export function isDevelopment(): boolean {
  return config.NODE_ENV === 'development';
}

/**
 * Get session cookie configuration based on environment
 */
export function getSessionCookieConfig() {
  return {
    secret: config.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProduction(), // only use secure cookies in production
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    }
  };
}