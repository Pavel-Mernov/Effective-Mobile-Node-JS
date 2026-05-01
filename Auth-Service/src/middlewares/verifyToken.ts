import jwt, { JwtHeader } from "jsonwebtoken";
import jwksClient, { type SigningKey } from 'jwks-rsa';
import { REALM } from "../env";

const client = jwksClient({
  jwksUri: `http://keycloak:8080/realms/${REALM}/protocol/openid-connect/certs`
});

function getKey(header : JwtHeader, callback: any) {

  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      console.log('JWKS error:', err);
      return callback(err, null);
    }

    if (!key) {
      return callback(new Error('No signing key found'), null);
    }

    console.log('Key found:', !!key);

    const signingKey = key?.getPublicKey();

    callback(null, signingKey);
  });
}

export function verifyToken(token: string) : Promise<any> {
    
        return new Promise((resolve, reject) => {
            try {
                jwt.verify(token, getKey, {
                    issuer: `http://localhost:8080/realms/${REALM}`, 
                    // audience: 'pavel_mernov'
                    }, 
                    (err, decoded) => {
                        if (err) {
                            console.log('Error:\n' + JSON.stringify(err))
                            reject(err);
                        } 
                        else {
                            // console.log(JSON.stringify(decoded)) 
                            resolve(decoded); 
                        }
                });
            }
            catch (err : any) {
                console.log(JSON.stringify(err))
                reject(err)
            }
        });
}