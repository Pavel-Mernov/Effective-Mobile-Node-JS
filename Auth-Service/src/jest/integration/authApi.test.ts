import axios from "axios";
import request from "supertest";
import app from "../../app";
import { verifyToken } from "../../middlewares/verifyToken";

jest.mock("axios");
jest.mock("../../middlewares/verifyToken");

const mockedAxios = jest.mocked(axios);
const mockedVerifyToken = jest.mocked(verifyToken);

const adminTokenResponse = { data: { access_token: "admin-token" } };

describe("Auth API integration", () => {
  beforeEach(() => {
    mockedAxios.post.mockReset();
    mockedAxios.get.mockReset();
    mockedAxios.put.mockReset();
    mockedVerifyToken.mockReset();
    jest.spyOn(console, "log").mockImplementation(() => undefined);
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("POST /auth-api/login returns an access token and refresh cookie", async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        access_token: "access-token",
        refresh_token: "refresh-token",
      },
    });

    const response = await request(app)
      .post("/auth-api/login")
      .set("x-forwarded-proto", "https")
      .send({ login: "user", password: "password" })
      .expect(200);

    expect(response.body).toEqual({ accessToken: "access-token" });
    expect(response.headers["set-cookie"]?.[0]).toContain("refreshToken=refresh-token");
    expect(response.headers["set-cookie"]?.[0]).toContain("HttpOnly");
    expect(response.headers["set-cookie"]?.[0]).toContain("Secure");
  });

  it("POST /auth-api/login returns 400 for invalid request body", async () => {
    const response = await request(app)
      .post("/auth-api/login")
      .send({ login: "", password: "password" })
      .expect(400);

    expect(response.body).toEqual({ error: "Login cannot be empty" });
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it("POST /auth-api/refresh uses refresh cookie and returns a new access token", async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        access_token: "new-access-token",
        refresh_token: "new-refresh-token",
      },
    });

    const response = await request(app)
      .post("/auth-api/refresh")
      .set("Cookie", "refreshToken=old-refresh-token")
      .expect(200);

    expect(response.body).toEqual({ accessToken: "new-access-token" });
    expect(response.headers["set-cookie"]?.[0]).toContain("refreshToken=new-refresh-token");
  });

  it("POST /auth-api/refresh returns 401 without refresh cookie", async () => {
    const response = await request(app).post("/auth-api/refresh").expect(401);

    expect(response.body).toEqual({ error: "No refresh token" });
  });

  it("POST /auth-api/logout clears refresh cookie", async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: {} });

    const response = await request(app)
      .post("/auth-api/logout")
      .set("Cookie", "refreshToken=refresh-token")
      .expect(204);

    expect(response.headers["set-cookie"]?.[0]).toContain("refreshToken=");
  });

  it("GET /auth-api/users rejects requests without admin token", async () => {
    const response = await request(app).get("/auth-api/users").expect(401);

    expect(response.body).toEqual({ error: "No token provided" });
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it("GET /auth-api/users returns users for admin token", async () => {
    mockedVerifyToken.mockResolvedValueOnce({
      realm_access: { roles: ["admin"] },
    });
    mockedAxios.post.mockResolvedValueOnce(adminTokenResponse);
    mockedAxios.get.mockResolvedValueOnce({
      data: [{ id: "user-id", email: "user@example.com" }],
    });

    const response = await request(app)
      .get("/auth-api/users")
      .set("Authorization", "Bearer admin-jwt")
      .expect(200);

    expect(response.body).toEqual([{ id: "user-id", email: "user@example.com" }]);
  });

  it("GET /auth-api/users/:id returns one user", async () => {
    mockedVerifyToken.mockResolvedValueOnce({
      realm_access: { roles: ["admin"] },
      sub: "admin-user-id",
    });
    mockedAxios.post.mockResolvedValueOnce(adminTokenResponse);
    mockedAxios.get.mockResolvedValueOnce({
      data: { id: "user-id", email: "user@example.com" },
    });

    const response = await request(app)
      .get("/auth-api/users/user-id")
      .set("Authorization", "Bearer any-token")
      .expect(200);

    expect(response.body).toEqual({ id: "user-id", email: "user@example.com" });
    expect(mockedAxios.get).toHaveBeenCalledWith(
      "http://localhost:8080/admin/realms/test-realm/users/user-id",
      expect.any(Object)
    );
  });

  it("GET /auth-api/users/:id replaces requested id with current user id for non-admin token", async () => {
    mockedVerifyToken.mockResolvedValueOnce({
      realm_access: { roles: ["user"] },
      sub: "current-user-id",
    });
    mockedAxios.post.mockResolvedValueOnce(adminTokenResponse);
    mockedAxios.get.mockResolvedValueOnce({
      data: { id: "current-user-id", email: "current@example.com" },
    });

    const response = await request(app)
      .get("/auth-api/users/another-user-id")
      .set("Authorization", "Bearer user-jwt")
      .expect(200);

    expect(response.body).toEqual({ id: "current-user-id", email: "current@example.com" });
    expect(mockedAxios.get).toHaveBeenCalledWith(
      "http://localhost:8080/admin/realms/test-realm/users/current-user-id",
      expect.any(Object)
    );
  });

  it("GET /auth-api/users/:id returns 401 without token", async () => {
    const response = await request(app).get("/auth-api/users/user-id").expect(401);

    expect(response.body).toEqual({ error: "No token provided" });
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it("POST /auth-api/users creates a user for admin token", async () => {
    mockedVerifyToken.mockResolvedValueOnce({
      realm_access: { roles: ["admin"] },
    });
    mockedAxios.post
      .mockResolvedValueOnce(adminTokenResponse)
      .mockResolvedValueOnce({
        data: {},
        headers: {
          location: "http://localhost:8080/admin/realms/test-realm/users/created-user-id",
        },
      })
      .mockResolvedValueOnce({ data: {} });
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        id: "role-id",
        name: "user",
      },
    });

    const response = await request(app)
      .post("/auth-api/users")
      .set("Authorization", "Bearer admin-jwt")
      .send({
        username: "new-user",
        email: "new-user@example.com",
        password: "password",
      })
      .expect(201);

    expect(response.body).toEqual({ message: "User created" });
    expect(mockedAxios.post).toHaveBeenLastCalledWith(
      "http://localhost:8080/admin/realms/test-realm/users/created-user-id/role-mappings/realm",
      [{ id: "role-id", name: "user" }],
      expect.any(Object)
    );
  });

  it("PUT /auth-api/block-user/:id blocks a user for admin token", async () => {
    mockedVerifyToken.mockResolvedValueOnce({
      realm_access: { roles: ["admin"] },
    });
    mockedAxios.post.mockResolvedValueOnce(adminTokenResponse);
    mockedAxios.put.mockResolvedValueOnce({ data: {} });

    const response = await request(app)
      .put("/auth-api/block-user/user-id")
      .set("Authorization", "Bearer admin-jwt")
      .expect(200);

    expect(response.body).toEqual({ message: "User blocked" });
    expect(mockedAxios.put).toHaveBeenCalledWith(
      "http://localhost:8080/admin/realms/test-realm/users/user-id",
      { enabled: false },
      expect.any(Object)
    );
  });
});
