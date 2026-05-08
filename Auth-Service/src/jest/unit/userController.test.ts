import axios from "axios";
import userController from "../../controllers/userController";
import { createRequest, createResponse } from "./testUtils";

jest.mock("axios");

const mockedAxios = jest.mocked(axios);

const adminTokenResponse = { data: { access_token: "admin-token" } };

describe("userController.getUsers", () => {
  beforeEach(() => {
    mockedAxios.post.mockReset();
    mockedAxios.get.mockReset();
    jest.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns 401 when authorization header is missing", async () => {
    const req = createRequest();
    const res = createResponse();

    await userController.getUsers(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Authorization header is required" });
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it("loads all Keycloak users page by page", async () => {
    const firstBatch = Array.from({ length: 100 }, (_, index) => ({
      id: `user-${index}`,
      email: `user-${index}@example.com`,
    }));
    const secondBatch = [{ id: "user-100", email: "user-100@example.com" }];

    mockedAxios.post.mockResolvedValueOnce(adminTokenResponse);
    mockedAxios.get
      .mockResolvedValueOnce({ data: firstBatch })
      .mockResolvedValueOnce({ data: secondBatch });

    const req = createRequest({ headers: { authorization: "Bearer user-token" } });
    const res = createResponse();

    await userController.getUsers(req, res);

    expect(mockedAxios.post).toHaveBeenCalledWith(
      "http://localhost:8080/realms/test-realm/protocol/openid-connect/token",
      expect.any(URLSearchParams),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );
    expect(mockedAxios.get).toHaveBeenNthCalledWith(
      1,
      "http://localhost:8080/admin/realms/test-realm/users",
      {
        headers: { Authorization: "Bearer admin-token" },
        params: { first: 0, max: 100 },
      }
    );
    expect(mockedAxios.get).toHaveBeenNthCalledWith(
      2,
      "http://localhost:8080/admin/realms/test-realm/users",
      {
        headers: { Authorization: "Bearer admin-token" },
        params: { first: 100, max: 100 },
      }
    );
    expect(res.json).toHaveBeenCalledWith([...firstBatch, ...secondBatch]);
  });

  it("returns 500 when Keycloak users request fails", async () => {
    mockedAxios.post.mockResolvedValueOnce(adminTokenResponse);
    mockedAxios.get.mockRejectedValueOnce(new Error("Keycloak is down"));

    const req = createRequest({ headers: { authorization: "Bearer user-token" } });
    const res = createResponse();

    await userController.getUsers(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Failed to load users from Keycloak",
      details: "Error: Keycloak is down",
    });
  });
});

describe("userController.getUserById", () => {
  beforeEach(() => {
    mockedAxios.post.mockReset();
    mockedAxios.get.mockReset();
    jest.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns 401 when authorization header is missing", async () => {
    const req = createRequest({ params: { id: "user-id" } });
    const res = createResponse();

    await userController.getUserById(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Authorization header is required" });
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it("returns a user found by id", async () => {
    mockedAxios.post.mockResolvedValueOnce(adminTokenResponse);
    mockedAxios.get.mockResolvedValueOnce({ data: { id: "user-id", email: "u@example.com" } });

    const req = createRequest({
      headers: { authorization: ["Bearer user-token"] },
      params: { id: "user-id" },
    });
    const res = createResponse();

    await userController.getUserById(req, res);

    expect(mockedAxios.get).toHaveBeenCalledWith(
      "http://localhost:8080/admin/realms/test-realm/users/user-id",
      {
        headers: { Authorization: "Bearer admin-token" },
      }
    );
    expect(res.json).toHaveBeenCalledWith({ id: "user-id", email: "u@example.com" });
  });

  it("returns 404 when user is not found", async () => {
    mockedAxios.post.mockResolvedValueOnce(adminTokenResponse);
    mockedAxios.get.mockRejectedValueOnce({ response: { status: 404 } });

    const req = createRequest({
      headers: { authorization: "Bearer user-token" },
      params: { id: "missing-id" },
    });
    const res = createResponse();

    await userController.getUserById(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "User not found" });
  });
});

describe("userController.createUser", () => {
  beforeEach(() => {
    mockedAxios.post.mockReset();
    mockedAxios.get.mockReset();
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("creates a Keycloak user", async () => {
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

    const req = createRequest({
      body: {
        username: "new-user",
        email: "new-user@example.com",
        password: "password",
        isActive: false,
        birthDate: "2000-01-01",
      },
    });
    const res = createResponse();

    await userController.createUser(req, res);

    expect(mockedAxios.post).toHaveBeenNthCalledWith(
      2,
      "http://localhost:8080/admin/realms/test-realm/users",
      {
        username: "new-user",
        firstName: "new",
        lastName: "user",
        email: "new-user@example.com",
        emailVerified: true,
        enabled: false,
        requiredActions: [],
        attributes: { birthDate: "2000-01-01" },
        credentials: [
          {
            type: "password",
            value: "password",
            temporary: false,
          },
        ],
      },
      {
        headers: {
          Authorization: "Bearer admin-token",
          "Content-Type": "application/json",
        },
      }
    );
    expect(mockedAxios.get).toHaveBeenCalledWith(
      "http://localhost:8080/admin/realms/test-realm/roles/user",
      {
        headers: {
          Authorization: "Bearer admin-token",
          "Content-Type": "application/json",
        },
      }
    );
    expect(mockedAxios.post).toHaveBeenLastCalledWith(
      "http://localhost:8080/admin/realms/test-realm/users/created-user-id/role-mappings/realm",
      [{ id: "role-id", name: "user" }],
      {
        headers: {
          Authorization: "Bearer admin-token",
          "Content-Type": "application/json",
        },
      }
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ message: "User created" });
  });

  it("uses provided first and last name when creating a Keycloak user", async () => {
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

    const req = createRequest({
      body: {
        username: "new-user",
        firstName: "John",
        lastName: "Smith",
        email: "new-user@example.com",
        password: "password",
      },
    });
    const res = createResponse();

    await userController.createUser(req, res);

    expect(mockedAxios.post).toHaveBeenNthCalledWith(
      2,
      "http://localhost:8080/admin/realms/test-realm/users",
      expect.objectContaining({
        firstName: "John",
        lastName: "Smith",
      }),
      expect.any(Object)
    );
  });

  it("returns 500 when Keycloak user creation fails", async () => {
    mockedAxios.post
      .mockResolvedValueOnce(adminTokenResponse)
      .mockRejectedValueOnce({ response: { data: { error: "exists" } } });

    const req = createRequest({
      body: {
        username: "new-user",
        email: "new-user@example.com",
        password: "password",
      },
    });
    const res = createResponse();

    await userController.createUser(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: { error: "exists" } });
  });
});

describe("userController.blockUser", () => {
  beforeEach(() => {
    mockedAxios.post.mockReset();
    mockedAxios.put.mockReset();
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("disables a Keycloak user", async () => {
    mockedAxios.post.mockResolvedValueOnce(adminTokenResponse);
    mockedAxios.put.mockResolvedValueOnce({ data: {} });

    const req = createRequest({ params: { id: "user-id" } });
    const res = createResponse();

    await userController.blockUser(req, res);

    expect(mockedAxios.put).toHaveBeenCalledWith(
      "http://localhost:8080/admin/realms/test-realm/users/user-id",
      { enabled: false },
      {
        headers: {
          Authorization: "Bearer admin-token",
          "Content-Type": "application/json",
        },
      }
    );
    expect(res.json).toHaveBeenCalledWith({ message: "User blocked" });
  });

  it("returns 500 when Keycloak user update fails", async () => {
    mockedAxios.post.mockResolvedValueOnce(adminTokenResponse);
    mockedAxios.put.mockRejectedValueOnce({ response: { data: { error: "missing" } } });

    const req = createRequest({ params: { id: "user-id" } });
    const res = createResponse();

    await userController.blockUser(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: { error: "missing" } });
  });
});
