import { authServiceUrl, parseResponseBody, postLogin } from "./login";

async function getUserById(token : string, id : string) {
  const url = `${authServiceUrl}/auth-api/users/${id}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  console.log(`GET ${url}`);

  const response = await fetch(url, {
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

const [login, password, id] = process.argv.slice(2)

if (!login || !password || !id) {
    console.error('Usage: npx ts-node getUserById.ts <login> <password> <id>')
    process.exit(-1)
}

postLogin(login, password)
.then(token => token ? getUserById(token, id) : null )
.catch((error) => {
  console.error(error);
  
});
