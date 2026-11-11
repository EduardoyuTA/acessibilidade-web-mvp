import assert from "node:assert/strict";
import test from "node:test";
import { createRequestGuard } from "../src/request-guard.mjs";
import { validatePublicUrl } from "../src/url-safety.mjs";

const publicLookup = async () => [{ address: "93.184.216.34" }];
const validate = (href) => validatePublicUrl(href, publicLookup);

function fakeRoute({ url, resourceType = "document" }) {
  const calls = [];
  return {
    calls,
    request: () => ({ url: () => url, resourceType: () => resourceType }),
    continue: async () => calls.push(["continue"]),
    abort: async (reason) => calls.push(["abort", reason])
  };
}

test("deixa seguir requisições para endereços públicos", async () => {
  const route = fakeRoute({ url: "https://example.com/" });
  await createRequestGuard({ validate })(route);
  assert.deepEqual(route.calls, [["continue"]]);
});

test("recusa cedo requisições para rede privada", async () => {
  for (const url of ["http://192.168.0.1/", "http://169.254.169.254/", "http://localhost/"]) {
    const route = fakeRoute({ url, resourceType: "script" });
    await createRequestGuard({ validate })(route);
    assert.deepEqual(route.calls, [["abort", "blockedbyclient"]], url);
  }
});

test("ignora recursos pesados e deixa passar data: e about:", async () => {
  const image = fakeRoute({ url: "https://example.com/a.png", resourceType: "image" });
  await createRequestGuard({ validate })(image);
  assert.deepEqual(image.calls, [["abort", undefined]]);

  const blank = fakeRoute({ url: "about:blank" });
  await createRequestGuard({ validate })(blank);
  assert.deepEqual(blank.calls, [["continue"]]);
});
