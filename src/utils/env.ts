import 'dotenv/config';

export function getEnv(key: string) {
    try {
        return import.meta.env[key]
    } catch (e) {
        return process.env[key]
    }
}