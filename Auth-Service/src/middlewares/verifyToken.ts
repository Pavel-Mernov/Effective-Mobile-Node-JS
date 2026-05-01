import type { JWTPayload } from "jose";
import { REALM } from "../env";

type JoseModule = typeof import("jose");
type RemoteJWKSet = ReturnType<JoseModule["createRemoteJWKSet"]>;

const importJose = new Function("specifier", "return import(specifier)") as (
  specifier: string
) => Promise<JoseModule>;

let josePromise: Promise<JoseModule> | undefined;
let jwks: RemoteJWKSet | undefined;

function getJose() {
  josePromise ??= importJose("jose");

  return josePromise;
}

function getJwks(createRemoteJWKSet: JoseModule["createRemoteJWKSet"]) {
  jwks ??= createRemoteJWKSet(
    new URL(`http://keycloak:8080/realms/${REALM}/protocol/openid-connect/certs`)
  );

  return jwks;
}

export async function verifyToken(token: string): Promise<JWTPayload> {
  try {
    const { createRemoteJWKSet, jwtVerify } = await getJose();
    const { payload } = await jwtVerify(token, getJwks(createRemoteJWKSet), {
      issuer: `http://localhost:8080/realms/${REALM}`,
      // audience: "pavel_mernov",
    });

    return payload;
  } catch (err) {
    console.log("Error:\n" + JSON.stringify(err));
    throw err;
  }
}
