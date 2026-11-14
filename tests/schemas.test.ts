import test from "node:test";
import assert from "node:assert/strict";
import { appConfigSchema, planLimits, projectInputSchema } from "@/lib/schemas";

const baseConfig = {
  appName: "Acme Portal",
  packageId: "com.acme.portal",
  websiteUrl: "https://app.example.com",
  versionName: "1.2.3",
  versionCode: 7,
  platforms: { android: true, ios: false },
};

test("appConfigSchema applies safe defaults", () => {
  const parsed = appConfigSchema.parse(baseConfig);
  assert.equal(parsed.theme, "system");
  assert.equal(parsed.colors.primary, "#10b981");
  assert.equal(parsed.features.statusBar, true);
  assert.equal(parsed.features.offlinePage, true);
  assert.equal(parsed.navigation.externalLinks, "external-browser");
});

test("appConfigSchema rejects non-HTTPS website URLs", () => {
  const result = appConfigSchema.safeParse({ ...baseConfig, websiteUrl: "http://app.example.com" });
  assert.equal(result.success, false);
  if (!result.success) {
    assert.ok(result.error.issues.some((issue) => issue.path.join(".") === "websiteUrl"));
  }
});

test("appConfigSchema rejects localhost and invalid package ids", () => {
  assert.equal(
    appConfigSchema.safeParse({ ...baseConfig, websiteUrl: "https://localhost:3000" }).success,
    false
  );
  assert.equal(appConfigSchema.safeParse({ ...baseConfig, packageId: "not-a-package" }).success, false);
  assert.equal(appConfigSchema.safeParse({ ...baseConfig, packageId: "1com.acme.app" }).success, false);
});

test("appConfigSchema requires at least one platform", () => {
  const result = appConfigSchema.safeParse({
    ...baseConfig,
    platforms: { android: false, ios: false },
  });
  assert.equal(result.success, false);
});

test("deep links need a scheme or host", () => {
  const result = appConfigSchema.safeParse({
    ...baseConfig,
    features: { deepLinks: true },
    deepLink: {},
  });
  assert.equal(result.success, false);
  assert.equal(
    appConfigSchema.safeParse({
      ...baseConfig,
      features: { deepLinks: true },
      deepLink: { scheme: "acme" },
    }).success,
    true
  );
});

test("projectInputSchema rejects malformed repositories and accepts owner/name", () => {
  assert.equal(
    projectInputSchema.safeParse({
      name: "Acme",
      config: baseConfig,
      repoFullName: "not a repo",
    }).success,
    false
  );
  assert.equal(
    projectInputSchema.safeParse({
      name: "Acme",
      config: baseConfig,
      repoFullName: "acme/portal-app",
    }).success,
    true
  );
});

test("plan limits fall back to free and map known plans", () => {
  assert.equal(planLimits(undefined).projects, 3);
  assert.equal(planLimits("something-else").projects, 3);
  assert.equal(planLimits("pro").projects, 25);
  assert.equal(planLimits("enterprise").projects, 500);
});
