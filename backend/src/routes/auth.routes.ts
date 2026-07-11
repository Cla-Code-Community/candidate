import { Router } from "express";
import { validate } from "../middleware/validate";
import { AuthController } from "../modules/auth/auth.controller";
import { AuthService } from "../modules/auth/auth.service";
import { CredentialsController } from "../modules/auth/credentials.controller";
import { CredentialsService } from "../modules/auth/credentials.service";
import {
  authAccountRateLimiter,
  authIpRateLimiter,
} from "../middleware/rateLimit";

const router = Router();

const authService = new AuthService();
const authController = new AuthController(authService);
const credentialsService = new CredentialsService();
const credentialsController = new CredentialsController(credentialsService);

const providerParamsSchema = z.object({
  provider: OAuthProviderSchema,
});

// OAuth
router.get(
  "/:provider/url",
  validate({ params: providerParamsSchema }),
  (req, res, next) => {
    authController.getUrl(req, res).catch(next);
  },
);
router.get("/:provider/callback", (req, res, next) => {
  authController.callback(req, res).catch(next);
});

// Credentials
router.post("/register", authIpRateLimiter, authAccountRateLimiter, (req, res) =>
  credentialsController.register(req, res),
);
router.post("/login", authIpRateLimiter, authAccountRateLimiter, (req, res) =>
  credentialsController.login(req, res),
);
router.post("/logout", (req, res) => credentialsController.logout(req, res));
router.get("/me", (req, res) => credentialsController.me(req, res));

export { router as authRoutes };
