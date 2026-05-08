import axios from "axios";
import { CLIENT_ID, CLIENT_SECRET, KEYCLOAK_URL, REALM } from "../env";
import { type KeycloakUser, type Request, type Response } from "../types/types";
import { CreateUserDto } from "../types/userDto";

const getAdminAccessToken = async () => {
  const response = await axios.post(
    `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/token`,
    new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: "client_credentials",
    }),
    {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    }
  );

  return response.data.access_token as string;
};

const getHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
});

const getCreatedUserId = (location: string | undefined) => {
  const userId = location?.split("/").filter(Boolean).at(-1);

  if (!userId) {
    throw new Error("Created user id was not returned by Keycloak");
  }

  return userId;
};

const assignRealmRoleToUser = async (token: string, userId: string, roleName: string) => {
  const roleResponse = await axios.get(
    `${KEYCLOAK_URL}/admin/realms/${REALM}/roles/${roleName}`,
    {
      headers: getHeaders(token),
    }
  );

  await axios.post(
    `${KEYCLOAK_URL}/admin/realms/${REALM}/users/${userId}/role-mappings/realm`,
    [roleResponse.data],
    {
      headers: getHeaders(token),
    }
  );
};

const getProfileNames = (body: CreateUserDto) => {
  const username = body.username ?? body.email;
  const usernameParts = username
    .split(/[\s._-]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const fallbackName = usernameParts[0] ?? body.email.split("@")[0] ?? username;

  return {
    firstName: body.firstName?.trim() || fallbackName,
    lastName: body.lastName?.trim() || usernameParts.slice(1).join(" ") || fallbackName,
  };
};

async function getUsers(req: Request, res: Response) {
  const authorization = Array.isArray(req.headers?.authorization) ? req.headers.authorization[0] : req.headers?.authorization;

  if (!authorization?.trim()) {
    res.status(401).json({ error: "Authorization header is required" });
    return;
  }

  try {
    const adminAccessToken = await getAdminAccessToken();

    

    const users: KeycloakUser[] = [];
    const max = 100;
    let first = 0;

    for (;;) {
      const response = await axios.get(
        `${KEYCLOAK_URL}/admin/realms/${REALM}/users`,
        {
          headers: {
            Authorization: `Bearer ${adminAccessToken}`,
          },
          params: {
            first,
            max,
          },
        }
      );

      const batch = Array.isArray(response.data) ? (response.data as KeycloakUser[]) : [];
      users.push(...batch);

      if (batch.length < max) {
        break;
      }

      first += max;
    }

    res.json(users);
  } catch (error) {
    const details = axios.isAxiosError(error) ? error.response?.data ?? error.message : String(error);

    console.log(JSON.stringify(details))

    res.status(500).json({
      error: "Failed to load users from Keycloak",
      details,
    });
  }
}

async function getUserById(req: Request<any, any, { id: string }>, res: Response) {
  const { id } = req.params;
  const authorization = Array.isArray(req.headers?.authorization) ? req.headers.authorization[0] : req.headers?.authorization;

  if (!authorization?.trim()) {
    res.status(401).json({ error: "Authorization header is required" });
    return;
  }

  try {
    const adminAccessToken = await getAdminAccessToken();

    const response = await axios.get(
      `${KEYCLOAK_URL}/admin/realms/${REALM}/users/${id}`,
      {
        headers: {
          Authorization: `Bearer ${adminAccessToken}`,
        },
      }
    );

    res.json(response.data);
  } catch (error) {
    const status = axios.isAxiosError(error) || typeof error === "object"
      ? (error as { response?: { status?: number } }).response?.status
      : undefined;

    if (status === 404) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const details = axios.isAxiosError(error) ? error.response?.data ?? error.message : String(error);

    console.log(JSON.stringify(details))

    res.status(500).json({
      error: "Failed to load user from Keycloak",
      details,
    });
  }
}

async function createUser(req: Request<CreateUserDto>, res: Response) {
    try {
        const body = req.body;

        const token = await getAdminAccessToken();

        const { username, email, password, isActive } = body;
        const { firstName, lastName } = getProfileNames(body);

        const createUserResponse = await axios.post(
            `${KEYCLOAK_URL}/admin/realms/${REALM}/users`,
            {
                username: username ?? email,
                firstName,
                lastName,
                email,
                emailVerified: true,
                enabled: isActive ?? true,
                requiredActions: [],

                attributes: {
                    birthDate: body.birthDate
                },

                credentials: [
                    {
                        type: "password",
                        value: password,
                        temporary: false
                    }
                ]
            },
            {
                headers: getHeaders(token)
            }
        );

        const userId = getCreatedUserId(createUserResponse.headers?.location);
        await assignRealmRoleToUser(token, userId, "user");

        res.status(201).json({
            message: "User created"
        });

    } catch (error: any) {
        console.error(error.response?.data);

        res.status(500).json({
            error: error.response?.data || error.message
        });
    }
}

async function blockUser(req: Request<any, any, { id: string }>, res: Response) {
    try {
        const token = await getAdminAccessToken();

        await axios.put(
            `${KEYCLOAK_URL}/admin/realms/${REALM}/users/${req.params.id}`,
            {
                enabled: false
            },
            {
                headers: getHeaders(token)
            }
        );

        res.json({
            message: "User blocked"
        });

    } catch (error: any) {
        console.error(error.response?.data);

        res.status(500).json({
            error: error.response?.data || error.message
        });
    }
}

export default {
    getUsers,
    getUserById,
    createUser,
    blockUser
}
