import { authServiceUrl, parseResponseBody } from "./login";

interface AddUserDto {
    username ?: string;
    firstName: string;
    lastName: string;
    email: string;
    password: string;

    isActive ?: boolean;
    birthDate ?: string;
}

async function addUser(body : AddUserDto) {
  const url = `${authServiceUrl}/auth-api/users`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  console.log(`POST ${url}`);

  const response = await fetch(`${authServiceUrl}/auth-api/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body : JSON.stringify(body),
    signal: controller.signal,
  });

  clearTimeout(timeout);

  const responseText = await response.text();
  const responseBody = responseText ? parseResponseBody(responseText) : null;

  console.log("Status:", response.status);
  console.log("Body:", responseBody);

  return responseBody;
}

const [firstName, lastName, email, password] = process.argv.slice(2) as string[] 

if (!firstName || !lastName || !email || !password) {
    console.error('Usage: npx ts-node addUser.ts <firstName> <lastName> <email> <password>')
    process.exit(-1)
}

addUser({
    firstName,
    lastName,
    email,
    password
})
.catch((error) => {
  console.error(error);
  
});
