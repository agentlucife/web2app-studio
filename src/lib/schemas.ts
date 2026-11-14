import { z } from "zod";

export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

// Android application IDs / iOS bundle IDs: reverse-DNS, each segment starts
// with a letter and contains only letters, digits and underscores.
export const PACKAGE_ID_REGEX =
  /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/;

export const VERSION_NAME_REGEX = /^\d{1,3}(\.\d{1,3}){0,3}$/;
export const SCHEME_REGEX = /^[a-z][a-z0-9+.-]{1,30}$/;
export const HOST_REGEX = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/i;

export const hexColorSchema = z
  .string()
  .regex(HEX_COLOR, "Use a 6-digit hex colour such as #10b981");

export const packageIdSchema = z
  .string()
  .trim()
  .min(5, "Package ID is too short")
  .max(150, "Package ID is too long")
  .regex(
    PACKAGE_ID_REGEX,
    "Use reverse-DNS format with at least two segments, e.g. com.example.myapp"
  );

export const featureSchema = z.object({
  camera: z.boolean().default(false),
  gallery: z.boolean().default(false),
  fileUploads: z.boolean().default(false),
  fileDownloads: z.boolean().default(false),
  location: z.boolean().default(false),
  pushNotifications: z.boolean().default(false),
  share: z.boolean().default(false),
  deepLinks: z.boolean().default(false),
  biometric: z.boolean().default(false),
  statusBar: z.boolean().default(true),
  offlinePage: z.boolean().default(true),
});

export const appConfigSchema = z
  .object({
    appName: z.string().trim().min(1, "App name is required").max(60),
    packageId: packageIdSchema,
    websiteUrl: z
      .string()
      .trim()
      .min(1, "Website URL is required")
      .max(2048)
      .refine((value) => {
        try {
          const url = new URL(value);
          return url.protocol === "https:" || url.protocol === "http:";
        } catch {
          return false;
        }
      }, "Enter a valid http(s) website URL"),
    description: z.string().trim().max(500).default(""),
    versionName: z
      .string()
      .trim()
      .regex(VERSION_NAME_REGEX, "Use a version such as 1.0.0")
      .default("1.0.0"),
    versionCode: z.coerce
      .number()
      .int("Version code must be a whole number")
      .min(1)
      .max(2_100_000_000)
      .default(1),
    platforms: z
      .object({
        android: z.boolean().default(true),
        ios: z.boolean().default(false),
      })
      .refine((value) => value.android || value.ios, {
        message: "Select at least one platform",
      }),
    theme: z.enum(["light", "dark", "system"]).default("system"),
    colors: z
      .object({
        primary: hexColorSchema.default("#10b981"),
        splashBackground: hexColorSchema.default("#0a0a0a"),
        statusBar: hexColorSchema.default("#0a0a0a"),
        navigationBar: hexColorSchema.default("#0a0a0a"),
      })
      .default({
        primary: "#10b981",
        splashBackground: "#0a0a0a",
        statusBar: "#0a0a0a",
        navigationBar: "#0a0a0a",
      }),
    navigation: z
      .object({
        externalLinks: z.enum(["in-app", "external-browser"]).default("external-browser"),
        allowNavigation: z
          .array(z.string().trim().regex(HOST_REGEX, "Enter a hostname such as app.example.com"))
          .max(20)
          .default([]),
        showLoadingIndicator: z.boolean().default(true),
      })
      .default({
        externalLinks: "external-browser",
        allowNavigation: [],
        showLoadingIndicator: true,
      }),
    features: featureSchema.default({
      camera: false,
      gallery: false,
      fileUploads: false,
      fileDownloads: false,
      location: false,
      pushNotifications: false,
      share: false,
      deepLinks: false,
      biometric: false,
      statusBar: true,
      offlinePage: true,
    }),
    deepLink: z
      .object({
        scheme: z.string().trim().regex(SCHEME_REGEX, "Invalid URI scheme").optional(),
        host: z.string().trim().regex(HOST_REGEX, "Invalid deep-link host").optional(),
        pathPrefix: z
          .string()
          .trim()
          .regex(/^\/[A-Za-z0-9\-._~!$&'()*+,;=:@/]*$/, "Must start with /")
          .max(120)
          .optional(),
      })
      .default({}),
    assets: z
      .object({
        iconPath: z.string().trim().max(512).optional(),
        splashPath: z.string().trim().max(512).optional(),
      })
      .default({}),
  })
  .superRefine((value, ctx) => {
    if (value.features.deepLinks) {
      if (!value.deepLink.scheme && !value.deepLink.host) {
        ctx.addIssue({
          code: "custom",
          path: ["deepLink", "scheme"],
          message: "Deep links need a custom scheme or an https host",
        });
      }
    }
    try {
      const url = new URL(value.websiteUrl);
      if (url.protocol !== "https:") {
        ctx.addIssue({
          code: "custom",
          path: ["websiteUrl"],
          message:
            "Use an HTTPS URL. Android and iOS block cleartext traffic in release builds.",
        });
      }
      if (url.hostname === "localhost") {
        ctx.addIssue({
          code: "custom",
          path: ["websiteUrl"],
          message: "Localhost cannot be used for a published mobile app",
        });
      }
    } catch {
      /* handled above */
    }
  });

export type AppConfig = z.infer<typeof appConfigSchema>;

export const projectInputSchema = z.object({
  name: z.string().trim().min(1, "Project name is required").max(80),
  description: z.string().trim().max(500).default(""),
  config: appConfigSchema,
  repoFullName: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/, "Use owner/repository")
    .max(200)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  repoPrivate: z.boolean().default(true),
});

export type ProjectInput = z.infer<typeof projectInputSchema>;

export const buildInputSchema = z.object({
  projectId: z.string().uuid(),
  platform: z.enum(["android", "ios"]),
  buildType: z.enum(["debug", "release-apk", "release-aab", "ios-archive", "ios-ipa"]),
});

export const githubTokenSchema = z
  .string()
  .trim()
  .min(20, "That token looks too short")
  .max(255, "That token looks too long")
  .regex(/^[A-Za-z0-9_\-]+$/, "GitHub tokens contain only letters, digits, _ and -");

export const repoNameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(/^[A-Za-z0-9_.-]+$/, "Only letters, digits, dot, dash and underscore"),
  description: z.string().trim().max(350).default(""),
  private: z.boolean().default(true),
});

export const repoLinkSchema = z.object({
  repoFullName: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/, "Use owner/repository")
    .max(200),
});

export const profileUpdateSchema = z.object({
  fullName: z.string().trim().max(80).default(""),
});

export const supportTicketSchema = z.object({
  subject: z.string().trim().min(3, "Add a subject").max(140),
  message: z.string().trim().min(10, "Describe the issue in a little more detail").max(4000),
});

export const adminSettingsSchema = z.object({
  maintenanceMode: z.boolean().default(false),
  signupsEnabled: z.boolean().default(true),
  buildNotifications: z.boolean().default(true),
  supportEmail: z.string().trim().email().max(200).default("support@web2app.studio"),
});

export const uploadKinds = ["icon", "splash"] as const;
export type UploadKind = (typeof uploadKinds)[number];

export const MAX_ICON_BYTES = 4 * 1024 * 1024;
export const MAX_SPLASH_BYTES = 8 * 1024 * 1024;
export const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

export const PLAN_LIMITS = {
  free: { projects: 3, buildsPerMonth: 30, maxIos: 2 },
  pro: { projects: 25, buildsPerMonth: 500, maxIos: 100 },
  enterprise: { projects: 500, buildsPerMonth: 5000, maxIos: 1000 },
} as const;

export type PlanId = keyof typeof PLAN_LIMITS;

export function planLimits(plan: string | null | undefined) {
  if (plan === "pro" || plan === "enterprise") return PLAN_LIMITS[plan];
  return PLAN_LIMITS.free;
}
