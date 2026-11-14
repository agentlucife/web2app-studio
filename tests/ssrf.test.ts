import test from "node:test";
import assert from "node:assert/strict";
import { assertSafePublicUrl, isPrivateIp, UnsafeUrlError } from "@/lib/ssrf";

test("isPrivateIp blocks loopback, private, link-local and metadata ranges", () => {
  for (const ip of [
    "127.0.0.1",
    "10.0.0.5",
    "172.16.4.2",
    "192.168.1.10",
    "169.254.169.254",
    "100.64.0.1",
    "::1",
    "fd00::1",
    "fe80::1",
  ]) {
    assert.equal(isPrivateIp(ip), true, `${ip} should be private`);
  }
});

test("isPrivateIp allows public addresses", () => {
  assert.equal(isPrivateIp("93.184.216.34"), false);
  assert.equal(isPrivateIp("8.8.8.8"), false);
  assert.equal(isPrivateIp("2606:4700:4700::1111"), false);
});

test("assertSafePublicUrl accepts a public HTTPS URL literal", async () => {
  const result = await assertSafePublicUrl("https://93.184.216.34/app?x=1");
  assert.equal(result.url.protocol, "https:");
  assert.deepEqual(result.addresses, ["93.184.216.34"]);
});

test("assertSafePublicUrl blocks dangerous URLs", async () => {
  const cases = [
    "ftp://example.com/file",
    "http://localhost:3000",
    "http://127.0.0.1/",
    "http://10.0.0.1/admin",
    "http://169.254.169.254/latest/meta-data",
    "http://metadata.google.internal/computeMetadata/v1",
    "https://user:pass@example.com/",
    "not a url",
  ];
  for (const value of cases) {
    await assert.rejects(() => assertSafePublicUrl(value), UnsafeUrlError, value);
  }
});
