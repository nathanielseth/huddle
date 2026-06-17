import { z } from "zod";

const EnvSchema = z.object({
	CLIENT_URL: z.url().default("http://localhost:3000"),
	PORT: z.coerce.number().int().positive().default(3001),
	NODE_ENV: z
		.enum(["development", "production", "test"])
		.default("development"),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
	console.error("[env] Invalid environment variables");
	console.error(z.prettifyError(parsed.error));
	process.exit(1);
}

export const env = parsed.data;