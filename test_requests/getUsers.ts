import { authServiceUrl, parseResponseBody, postLogin } from "./login";

async function getUsers(token : string) {
  const url = `${authServiceUrl}/auth-api/users`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  console.log(`GET ${url}`);

  const response = await fetch(`${authServiceUrl}/auth-api/users`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    signal: controller.signal,
  });

  clearTimeout(timeout);

  const responseText = await response.text();
  const responseBody = responseText ? parseResponseBody(responseText) : null;

  console.log("Status:", response.status);
  console.log("Body:", responseBody);

  return responseBody;
}

const [login, password] = process.argv.slice(2)

if (!login || !password) {
    console.error('Usage: npx ts-node getUsers.ts <login> <password>')
    process.exit(-1)
}

postLogin(login, password)
.then(token => { return token ? getUsers(token) : null })
.catch((error) => {
  console.error(error);
  
});
