import axios from "axios";
import { CLIENT_ID, CLIENT_SECRET, KEYCLOAK_URL, REALM } from "../env";
import { CookieOptions, type HeaderValue, type Request, type Response } from "../types/types";

interface LoginBody {
    login : string
    password : string
}

const getFirstHeaderValue = (header : HeaderValue) => {
  if (Array.isArray(header)) {
    return header[0]
  }

  return header
}

const getRefreshCookieOptions = (req : Request) : CookieOptions => {
  // Traefik forwards the external protocol, which lets us enable cross-site cookies only for HTTPS.
  const forwardedProto = getFirstHeaderValue(req.headers?.['x-forwarded-proto'])?.split(',')[0]?.trim()
  const isHttpsRequest = forwardedProto === 'https'

  return {
    httpOnly: true,
    secure: isHttpsRequest,
    sameSite: isHttpsRequest ? 'none' : 'lax',
  }
}

const login = async (req : Request<LoginBody>, res : Response) => {
  const { login, password } = req.body;

  if (!login || !login.trim()) {
    const error = 'Login cannot be empty'
    
    return res.status(400).json({ error })
  }

  if (!password || !password.trim()) {
    const error = 'Password cannot be empty'

    return res.status(400).json({ error })
  }

  try {
    const response = await axios.post(
      `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/token`,
      new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'password',
        username: login,
        password: password,
      }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }
    );

    const { access_token, refresh_token } = response.data;

    res.cookie('refreshToken', refresh_token, getRefreshCookieOptions(req));

    res.json({ accessToken: access_token });

  } catch (err : any) {

    // console.log(err)

    res.status(401).json({ error: 'Invalid credentials. ' + err.toString() });
  }
}

interface RefreshCookies {
    refreshToken : string
}

const refresh = async (req : Request<any, RefreshCookies>, res : Response) => {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    return res.status(401).json({ error: 'No refresh token' });
  }

  try {
    const response = await axios.post(
      `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/token`,
      new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }
    );

    const { access_token, refresh_token } = response.data;

    res.cookie('refreshToken', refresh_token, getRefreshCookieOptions(req));

    res.json({ accessToken: access_token });

  } catch (e) {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
}

const logout = async (req : Request<any, RefreshCookies>, res : Response) => {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    return res.sendStatus(204);
  }

  try {
    await axios.post(
      `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/logout`,
      new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: refreshToken,
      }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }
    );
  } catch (e) {}

  res.clearCookie('refreshToken');
  res.sendStatus(204);
}

export default {
    login, logout, refresh
}
