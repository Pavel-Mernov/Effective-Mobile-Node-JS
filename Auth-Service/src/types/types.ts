export type HeaderValue = string | string[] | undefined;
type SameSitePolicy = 'lax' | 'strict' | 'none';

export interface Request<BodyType = any, CookieType = any, ParamsType = any> {
    body : BodyType
    cookies : CookieType
    headers ?: Record<string, HeaderValue>
    params : ParamsType
}

export interface KeycloakUser {
    id: string;
    email?: string | null;
    [key: string]: unknown;
}

export interface CookieOptions {
    httpOnly ?: boolean
    secure ?: boolean
    sameSite ?: SameSitePolicy
}

export interface Response {
    json : (arg ?: any) => Response
    status : (code : number) => Response
    cookie : (key : string, value : any, options ?: CookieOptions) => Response
    sendStatus : (code : number) => Response
    clearCookie : (cookie : string) => Response
}