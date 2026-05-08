import { z } from "zod";

const EnvSchema = z.object({
	CLIENT_URL: z.string().url().default("http://localhost:5173"),
	PORT: z.coerce.number().int().positive().default(3001),
	NODE_ENV: z
		.enum(["development", "production", "test"])
		.default("development"),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
	console.error("[env] Invalid environment variables:");
	console.error(parsed.error.flatten().fieldErrors);
	process.exit(1);
}

export const env = parsed.data;
