import { Context, Next } from 'hono'

export const etagCache = () => {
    return async (c: Context, next: Next) => {
        await next()
    }
}
