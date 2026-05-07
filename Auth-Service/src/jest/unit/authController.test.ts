import axios from "axios";
import authController from "../../controllers/authController";
import { createRequest, createResponse } from "./testUtils";

jest.mock("axios");

const mockedAxios = jest.mocked(axios);

describe("authController.login", () => {
  beforeEach(() => {
    mockedAxios.post.mockReset();
  });

  it("returns 400 when login is empty", async () => {
    const req = createRequest({ body: { login: " ", password: "password" } });
    const res = createResponse();

    await authController.login(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Login cannot be empty" });
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it("returns 400 when password is empty", async () => {
    const req = createRequest({ body: { login: "user", password: " " } });
    const res = createResponse();

    await authController.login(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Password cannot be empty" });
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it("exchanges credentials for tokens and stores the refresh token", async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        access_token: "access-token",
        refresh_token: "refresh-token",
      },
    });

    const req = createRequest({
      body: { login: "user", password: "password" },
      headers: { "x-forwarded-proto": "https" },
    });
    const res = createResponse();

    await authController.login(req, res);

    expect(mockedAxios.post).toHaveBeenCalledWith(
      "http://localhost:8080/realms/test-realm/protocol/openid-connect/token",
      expect.any(URLSearchParams),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const payload = mockedAxios.post.mock.calls[0]?.[1] as URLSearchParams;
    expect(payload.get("client_id")).toBe("test-client");
    expect(payload.get("client_secret")).toBe("test-secret");
    expect(payload.get("grant_type")).toBe("password");
    expect(payload.get("username")).toBe("user");
    expect(payload.get("password")).toBe("password");

    expect(res.cookie).toHaveBeenCalledWith("refreshToken", "refresh-token", {
      httpOnly: true,
      secure: true,
      sameSite: "none",
    });
    expect(res.json).toHaveBeenCalledWith({ accessToken: "access-token" });
  });

  it("returns 401 when Keycloak rejects credentials", async () => {
    mockedAxios.post.mockRejectedValueOnce(new Error("Unauthorized"));

    const req = createRequest({ body: { login: "user", password: "wrong" } });
    const res = createResponse();

    await authController.login(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: "Invalid credentials. Error: Unauthorized",
    });
  });
});

describe("authController.refresh", () => {
  beforeEach(() => {
    mockedAxios.post.mockReset();
  });

  it("returns 401 when refresh token cookie is missing", async () => {
    const req = createRequest({ cookies: {} });
    const res = createResponse();

    await authController.refresh(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "No refresh token" });
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it("exchanges refresh token and rotates the cookie", async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        access_token: "new-access-token",
        refresh_token: "new-refresh-token",
      },
    });

    const req = createRequest({
      cookies: { refreshToken: "old-refresh-token" },
      headers: { "x-forwarded-proto": "http" },
    });
    const res = createResponse();

    await authController.refresh(req, res);

    const payload = mockedAxios.post.mock.calls[0]?.[1] as URLSearchParams;
    expect(payload.get("grant_type")).toBe("refresh_token");
    expect(payload.get("refresh_token")).toBe("old-refresh-token");
    expect(res.cookie).toHaveBeenCalledWith("refreshToken", "new-refresh-token", {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
    });
    expect(res.json).toHaveBeenCalledWith({ accessToken: "new-access-token" });
  });

  it("returns 401 when Keycloak rejects refresh token", async () => {
    mockedAxios.post.mockRejectedValueOnce(new Error("Unauthorized"));

    const req = createRequest({ cookies: { refreshToken: "bad-token" } });
    const res = createResponse();

    await authController.refresh(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid refresh token" });
  });
});

describe("authController.logout", () => {
  beforeEach(() => {
    mockedAxios.post.mockReset();
  });

  it("returns 204 when refresh token cookie is missing", async () => {
    const req = createRequest({ cookies: {} });
    const res = createResponse();

    await authController.logout(req, res);

    expect(res.sendStatus).toHaveBeenCalledWith(204);
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it("revokes refresh token, clears cookie, and returns 204", async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: {} });

    const req = createRequest({ cookies: { refreshToken: "refresh-token" } });
    const res = createResponse();

    await authController.logout(req, res);

    const payload = mockedAxios.post.mock.calls[0]?.[1] as URLSearchParams;
    expect(payload.get("refresh_token")).toBe("refresh-token");
    expect(res.clearCookie).toHaveBeenCalledWith("refreshToken");
    expect(res.sendStatus).toHaveBeenCalledWith(204);
  });

  it("still clears cookie when Keycloak logout fails", async () => {
    mockedAxios.post.mockRejectedValueOnce(new Error("Network error"));

    const req = createRequest({ cookies: { refreshToken: "refresh-token" } });
    const res = createResponse();

    await authController.logout(req, res);

    expect(res.clearCookie).toHaveBeenCalledWith("refreshToken");
    expect(res.sendStatus).toHaveBeenCalledWith(204);
  });
});
