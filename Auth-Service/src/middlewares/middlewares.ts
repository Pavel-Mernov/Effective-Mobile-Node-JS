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
    params: Record<string, string>;
    [key: string]: any;
}

interface DecodedToken {
  sub?: string;
  realm_access?: { roles?: string[] };
  resource_access?: Record<string, { roles?: string[] }>;
}

function getBearerToken(authHeader: HeaderValue) {
  const header = Array.isArray(authHeader) ? authHeader[0] : authHeader;

  return header?.split(' ')[1];
}

function hasAdminRole(decodedToken: DecodedToken) {
  const realmRoles = decodedToken.realm_access?.roles ?? [];
  const clientRoles = Object.values(decodedToken.resource_access ?? {})
    .flatMap((resource) => resource.roles ?? []);

  return [...realmRoles, ...clientRoles].includes('admin');
}

export async function adminMiddleware(req : Request, res : Response, next : NextFunction) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = getBearerToken(authHeader);

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    try {
      const decodedToken = await verifyToken(token) as DecodedToken;

      if (!hasAdminRole(decodedToken)) {
        return res.status(403).json({ error: 'Access denied' });
      }

      next();
    } catch {
      return res.status(401).json({ error: 'Invalid token' });
    }
}

export async function userIdParamMiddleware(req : Request, res : Response, next : NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = getBearerToken(authHeader);

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decodedToken = await verifyToken(token) as DecodedToken;

    if (!hasAdminRole(decodedToken)) {

      

      if (!decodedToken.sub) {
        return res.status(401).json({ error: 'Invalid token' });
      }

      req.params.id = decodedToken.sub;
    }

    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
