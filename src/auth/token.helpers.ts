import * as bcrypt from 'bcrypt';
import { Response, Request } from 'express';

export async function hashToken(raw: string) {
  return bcrypt.hash(raw, 10);
}
export async function compareToken(raw: string, hash: string) {
  return bcrypt.compare(raw, hash);
}

export function setRefreshCookie(res: Response, token: string, domain: string | undefined, req: Request) {
  const cookieDomain = domain || (process.env.NODE_ENV === 'production' ? req.hostname : 'localhost');
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: (process.env.COOKIE_SAMESITE as any) || 'None',
    domain: cookieDomain, // e.g. .your-domain.com in prod
    path: '/',
    maxAge: 1000 * 60 * 60 * 24 * 7, // match JWT_REFRESH_EXPIRES_IN
  };
  console.log('Setting refresh token cookie with options:', cookieOptions);
  console.log('Refresh token:', token);
  res.cookie(process.env.COOKIE_NAME_REFRESH || 'busyfool_rtk', token, cookieOptions);
}
export function clearRefreshCookie(res: Response, domain?: string) {
  res.clearCookie(process.env.COOKIE_NAME_REFRESH || 'busyfool_rtk', {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: (process.env.COOKIE_SAMESITE as any) || 'None',
    domain: domain || undefined,
    path: '/',
  });
}
