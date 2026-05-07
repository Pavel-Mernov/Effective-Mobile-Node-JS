import { type Request, type Response } from "../../types/types";

export const createResponse = () => {
  const res = {
    json: jest.fn(),
    status: jest.fn(),
    cookie: jest.fn(),
    sendStatus: jest.fn(),
    clearCookie: jest.fn(),
  } as unknown as jest.Mocked<Response>;

  res.json.mockReturnValue(res);
  res.status.mockReturnValue(res);
  res.cookie.mockReturnValue(res);
  res.sendStatus.mockReturnValue(res);
  res.clearCookie.mockReturnValue(res);

  return res;
};

export const createRequest = <
  BodyType = any,
  CookieType = any,
  ParamsType = any
>(
  overrides: Partial<Request<BodyType, CookieType, ParamsType>> = {}
): Request<BodyType, CookieType, ParamsType> => ({
  body: {} as BodyType,
  cookies: {} as CookieType,
  headers: {},
  params: {} as ParamsType,
  ...overrides,
});
