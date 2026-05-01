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
      `${KEYCLOAK_URL}/admin/realms/${REALM}/users`,
      {
        headers: {
          Authorization: `Bearer ${adminAccessToken}`,
        },
        params: {
          id,
        },
      }
    );

    const [user] = Array.isArray(response.data) ? response.data : [];

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json(user);
  } catch (error) {
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

        await axios.post(
            `${KEYCLOAK_URL}/admin/realms/${REALM}/users`,
            {
                username: body.username,
                email: body.email,
                enabled: body.isActive ?? true,

                attributes: {
                    birthDate: body.birthDate
                },

                credentials: [
                    {
                        type: "password",
                        value: body.password,
                        temporary: false
                    }
                ]
            },
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json"
                }
            }
        );

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
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json"
                }
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