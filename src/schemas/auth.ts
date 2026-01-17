import { t } from "elysia";
import { appConfig } from "../config";

export const loginSchema = t.Object({
	email: t.String({ format: "email" }),
	password: t.String({ minLength: 6 }),
});

export const signupSchema = t.Object({
	email: t.String({ format: "email" }),
	password: t.String({ minLength: appConfig.signupMinPasswordLength }),
	name: t.String({ minLength: 1 }),
});

export const magicLinkSchema = t.Object({
	email: t.String({ format: "email" }),
});

export const forgotPasswordSchema = t.Object({
	email: t.String({ format: "email" }),
});

export const resetPasswordSchema = t.Object({
	accessToken: t.String({ minLength: 10 }),
	password: t.String({ minLength: appConfig.signupMinPasswordLength }),
});

export const updateProfileSchema = t.Object({
	name: t.Optional(t.String({ minLength: 1 })),
	avatarUrl: t.Optional(t.String({ minLength: 1 })),
});
