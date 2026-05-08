export const authServiceUrl = "http://localhost:3001";

export async function postLogin(login: string, password: string) {
  const url = `${authServiceUrl}/auth-api/login`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  console.log(`POST ${url}`);

  const response = await fetch(`${authServiceUrl}/auth-api/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      login,
      password,
    }),
    signal: controller.signal,
  });

  clearTimeout(timeout);

  const responseText = await response.text();
  const responseBody = responseText ? parseResponseBody(responseText) : null;

  console.log("Status:", response.status);
  console.log("Body:", responseBody);
  console.log("Set-Cookie:", response.headers.get("set-cookie"));

  return typeof responseBody === "object" && responseBody !== null
    ? (responseBody.accessToken as string | undefined)
    : undefined;
}

export function parseResponseBody(responseText: string) {
  try {
    return JSON.parse(responseText);
  } catch {
    return responseText;
  }
}

function main() {
    const [login, password] = process.argv.slice(2) as string[]

    if (!login || !password) {
        console.error('Usage: npx ts-node login.ts <login> <password>')
        process.exit(-1)
    }
    postLogin(login, password).catch((error) => {
    console.error(error);
    
  });
}

if (require.main === module) {
    main();
}
