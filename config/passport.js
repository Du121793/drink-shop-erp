import passport from "passport";
import { Strategy as JwtStrategy, ExtractJwt } from "passport-jwt";
import dotenv from "dotenv";
import * as permissionController from "../SQL_controller/permission.js";

dotenv.config();

const jwtSecret = process.env.JWT_SECRET || "fallback-secret";

// JWT 驗證：解析 line_id，查詢最高權限等級，放入 req.user
passport.use(
  new JwtStrategy(
    {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: jwtSecret,
      algorithms: ["HS256"],
    },
    async (payload, done) => {
      try {
        const lineId = payload?.line_id;
        if (!lineId) return done(null, false);
        const permissionLevel = await permissionController.getPermissionLevelByLineId(lineId);
        return done(null, { line_id: lineId, permission_level: permissionLevel });
      } catch (err) {
        return done(err, false);
      }
    }
  )
);

const requireAuth = passport.authenticate("jwt", { session: false });

export { passport, requireAuth };
