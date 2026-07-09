import { Router } from "express";
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

// OAuth
router.get("/:provider/url", (req, res) => authController.getUrl(req, res));
router.get("/:provider/callback", (req, res) =>
  authController.callback(req, res),
);

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
