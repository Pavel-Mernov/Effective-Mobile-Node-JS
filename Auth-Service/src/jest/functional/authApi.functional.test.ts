import axios from "axios";
import request from "supertest";
import app from "../../app";
import { verifyToken } from "../../middlewares/verifyToken";

jest.mock("axios");
jest.mock("../../middlewares/verifyToken");

const mockedAxios = jest.mocked(axios);
const mockedVerifyToken = jest.mocked(verifyToken);

describe("Auth API functional behavior", () => {
  beforeEach(() => {
    mockedAxios.post.mockReset();
    mockedAxios.get.mockReset();
    mockedVerifyToken.mockReset();
    jest.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("authenticates a user with valid credentials", async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        access_token: "access-token",
        refresh_token: "refresh-token",
      },
    });

    const response = await request(app)
      .post("/auth-api/login")
      .send({ login: "user", password: "password" })
      .expect(200);

    expect(response.body).toEqual({ accessToken: "access-token" });
  });

  it("rejects login with missing password", async () => {
    const response = await request(app)
      .post("/auth-api/login")
      .send({ login: "user" })
      .expect(400);

    expect(response.body).toEqual({ error: "Password cannot be empty" });
  });

  it("forbids non-admin users from listing users", async () => {
    mockedVerifyToken.mockResolvedValueOnce({
      realm_access: { roles: ["user"] },
    });

    const response = await request(app)
      .get("/auth-api/users")
      .set("Authorization", "Bearer user-jwt")
      .expect(403);

    expect(response.body).toEqual({ error: "Access denied" });
  });

  it("returns 404 when requested user does not exist", async () => {
    mockedVerifyToken.mockResolvedValueOnce({
      realm_access: { roles: ["admin"] },
      sub: "admin-user-id",
    });
    mockedAxios.post.mockResolvedValueOnce({ data: { access_token: "admin-token" } });
    mockedAxios.get.mockRejectedValueOnce({ response: { status: 404 } });

    const response = await request(app)
      .get("/auth-api/users/missing-id")
      .set("Authorization", "Bearer any-token")
      .expect(404);

    expect(response.body).toEqual({ error: "User not found" });
  });

  it("requires authorization for loading a user by id", async () => {
    const response = await request(app).get("/auth-api/users/user-id").expect(401);

    expect(response.body).toEqual({ error: "No token provided" });
  });
});
