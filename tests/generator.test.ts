import test from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { appConfigSchema } from "@/lib/schemas";
import { generateCapacitorProject } from "@/lib/generator";

const config = appConfigSchema.parse({
  appName: "Acme Portal",
  packageId: "com.acme.portal",
  websiteUrl: "https://app.example.com",
  description: "Acme customer portal",
  versionName: "2.0.0",
  versionCode: 20,
  platforms: { android: true, ios: true },
  theme: "dark",
  features: {
    camera: true,
    fileDownloads: true,
    location: true,
    deepLinks: true,
    offlinePage: true,
  },
  deepLink: { scheme: "acme", host: "app.example.com", pathPrefix: "/open" },
});

test("generator emits a complete Capacitor project", async () => {
  const generated = await generateCapacitorProject(config);

  const paths = generated.files.map((file) => file.path);
  for (const required of [
    "package.json",
    "capacitor.config.json",
    "web2app.config.json",
    "README-GENERATED.md",
    ".gitignore",
    "www/index.html",
    "www/offline.html",
    "assets/icon.png",
    "assets/splash.png",
    "scripts/apply-native-config.mjs",
    "scripts/notify-build.mjs",
    ".github/workflows/android.yml",
    ".github/workflows/ios.yml",
  ]) {
    assert.ok(paths.includes(required), `missing ${required}`);
  }

  const packageJson = JSON.parse(
    generated.files.find((file) => file.path === "package.json")!.content as string
  );
  assert.equal(packageJson.dependencies["@capacitor/core"], "8.6.2");
  assert.ok(packageJson.dependencies["@capacitor/camera"]);
  assert.ok(packageJson.dependencies["@capacitor/geolocation"]);
  assert.ok(packageJson.dependencies["@capacitor/filesystem"]);

  const capacitor = JSON.parse(
    generated.files.find((file) => file.path === "capacitor.config.json")!.content as string
  );
  assert.equal(capacitor.appId, "com.acme.portal");
  assert.equal(capacitor.server.url, "https://app.example.com");
  assert.equal(capacitor.server.androidScheme, "https");
  assert.equal(capacitor.android.allowMixedContent, false);

  const metadata = JSON.parse(
    generated.files.find((file) => file.path === "web2app.config.json")!.content as string
  );
  assert.equal(metadata.generator, "web2app-studio");
  assert.equal(metadata.deepLink.scheme, "acme");

  const android = generated.files.find((file) => file.path === ".github/workflows/android.yml")!
    .content as string;
  assert.match(android, /workflow_dispatch/);
  assert.match(android, /notify-build/);
  assert.match(android, /secrets\.ANDROID_KEYSTORE_BASE64/);

  const icon = generated.files.find((file) => file.path === "assets/icon.png")!.content;
  assert.ok(Buffer.isBuffer(icon));
  assert.ok((icon as Buffer).length > 1000);
  assert.equal((icon as Buffer).subarray(1, 4).toString("ascii"), "PNG");
});

test("generator zip mirrors generated files and commit message is marked", async () => {
  const generated = await generateCapacitorProject(config, { commitMarker: "build-42" });
  const zip = await JSZip.loadAsync(generated.zip);
  const entries = Object.keys(zip.files).filter((name) => !zip.files[name].dir);
  assert.deepEqual(entries.sort(), generated.files.map((file) => file.path).sort());
  assert.equal(generated.commitMessage, "Web2App Studio build build-42");
});
