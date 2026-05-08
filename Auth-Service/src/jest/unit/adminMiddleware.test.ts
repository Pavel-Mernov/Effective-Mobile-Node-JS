import { adminMiddleware, userIdParamMiddleware } from "../../middlewares/middlewares";
import { verifyToken } from "../../middlewares/verifyToken";
import { createResponse } from "./testUtils";

jest.mock("../../middlewares/verifyToken");

const mockedVerifyToken = jest.mocked(verifyToken);

const createMiddlewareRequest = (authorization?: string | string[]) => ({
  body: {},
  cookies: {},
  headers: authorization === undefined ? {} : { authorization },
  params: { id: "requested-user-id" },
});

describe("adminMiddleware", () => {
  beforeEach(() => {
    mockedVerifyToken.mockReset();
  });

  it("returns 401 when authorization header is missing", async () => {
    const res = createResponse();
    const next = jest.fn();

    await adminMiddleware(createMiddlewareRequest(), res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "No token provided" });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when bearer token is missing", async () => {
    const res = createResponse();
    const next = jest.fn();

    await adminMiddleware(createMiddlewareRequest("Bearer"), res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "No token provided" });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 403 when token does not contain admin role", async () => {
    mockedVerifyToken.mockResolvedValueOnce({
      realm_access: { roles: ["user"] },
    });

    const res = createResponse();
    const next = jest.fn();

    await adminMiddleware(createMiddlewareRequest("Bearer user-token"), res, next);

    expect(mockedVerifyToken).toHaveBeenCalledWith("user-token");
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: "Access denied" });
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next when token contains admin role", async () => {
    mockedVerifyToken.mockResolvedValueOnce({
      realm_access: { roles: ["user", "admin"] },
    });

    const res = createResponse();
    const next = jest.fn();

    await adminMiddleware(createMiddlewareRequest(["Bearer admin-token"]), res, next);

    expect(mockedVerifyToken).toHaveBeenCalledWith("admin-token");
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("returns 401 when token verification fails", async () => {
    mockedVerifyToken.mockRejectedValueOnce(new Error("bad token"));

    const res = createResponse();
    const next = jest.fn();

    await adminMiddleware(createMiddlewareRequest("Bearer bad-token"), res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid token" });
    expect(next).not.toHaveBeenCalled();
  });
});

describe("userIdParamMiddleware", () => {
  beforeEach(() => {
    mockedVerifyToken.mockReset();
  });

  it("returns 401 when authorization header is missing", async () => {
    const res = createResponse();
    const next = jest.fn();

    await userIdParamMiddleware(createMiddlewareRequest(), res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "No token provided" });
    expect(next).not.toHaveBeenCalled();
  });

  it("keeps requested id when token contains admin role", async () => {
    mockedVerifyToken.mockResolvedValueOnce({
      resource_access: {
        "test-client": { roles: ["admin"] },
      },
      sub: "admin-user-id",
    });

    const req = createMiddlewareRequest("Bearer admin-token");
    const res = createResponse();
    const next = jest.fn();

    await userIdParamMiddleware(req, res, next);

    expect(req.params.id).toBe("requested-user-id");
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("replaces requested id with current user id for non-admin token", async () => {
    mockedVerifyToken.mockResolvedValueOnce({
      realm_access: { roles: ["user"] },
      sub: "current-user-id",
    });

    const req = createMiddlewareRequest("Bearer user-token");
    const res = createResponse();
    const next = jest.fn();

    await userIdParamMiddleware(req, res, next);

    expect(req.params.id).toBe("current-user-id");
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("returns 401 for non-admin token without subject", async () => {
    mockedVerifyToken.mockResolvedValueOnce({
      realm_access: { roles: ["user"] },
    });

    const req = createMiddlewareRequest("Bearer user-token");
    const res = createResponse();
    const next = jest.fn();

    await userIdParamMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid token" });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when token verification fails", async () => {
    mockedVerifyToken.mockRejectedValueOnce(new Error("bad token"));

    const res = createResponse();
    const next = jest.fn();

    await userIdParamMiddleware(createMiddlewareRequest("Bearer bad-token"), res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid token" });
    expect(next).not.toHaveBeenCalled();
  });
});
