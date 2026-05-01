import * as process from "node:process";

export const PORT = process.env.PORT || 3005;

export const KEYCLOAK_URL = process.env.KEYCLOAK_URL!;
export const REALM = process.env.KEYCLOAK_REALM!;
export const CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID!;
export const CLIENT_SECRET = process.env.CLIENT_SECRET!;
