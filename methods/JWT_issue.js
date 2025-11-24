import { SignJWT, jwtVerify } from "jose";
import crypto from "crypto";
import dotenv from "dotenv";
dotenv.config();

const secret = new TextEncoder().encode(
  process.env.LINE_ISSUE_JWT_TOKEN_SECRET
);

export async function issueRegToken(lineUserId) {
  const jti = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);

  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(lineUserId)
    .setJti(jti)
    .setIssuedAt(now)
    .setExpirationTime(now + 60 * 60)
    .sign(secret);

  //   await db.reg_tokens.insert({ jti, lineUserId, exp: now + 3600, used: false });

  return token;
}

export async function verifyRegToken(token) {
  const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });

  const lineUserId = payload.sub;
  const jti = payload.jti;

  // 一次性檢查
  //   const row = await db.reg_tokens.findOne({ jti });
  if (!row || row.used) throw new Error("token used/unknown");
  if (row.lineUserId !== lineUserId) throw new Error("token mismatch");

  // 標記已使用
  //   await db.reg_tokens.update({ jti }, { used: true, used_at: new Date() });

  return { lineUserId };
}
