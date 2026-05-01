import { CookieOptions, NextFunction } from "express";
import { verifyToken } from "./verifyToken";

interface Response {
    status: (code: number) => Response;
    json: (arg?: any) => Response;
    sendStatus: (code: number) => Response;
    cookie: (key: string, value: any, options?: CookieOptions) => Response;
    clearCookie: (cookie: string) => Response;
}

type HeaderValue = string | string[] | undefined;

interface Request<BodyType = any, CookieType = any> {
    body: BodyType;
    cookies: CookieType;
    headers: Record<string, HeaderValue>;
    [key: string]: any;
}

export function adminMiddleware(req : Request, res : Response, next : NextFunction) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = (Array.isArray(authHeader) ? authHeader[0] : authHeader)?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decodedToken = verifyToken(token) as { realm_access?: { roles: string[] } };
    if (!decodedToken.realm_access?.roles.includes('admin')) {
      return res.status(403).json({ error: 'Access denied' });
    }

    next();
}