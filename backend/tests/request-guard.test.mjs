import assert from "node:assert/strict";
import test from "node:test";
import { createRequestGuard, isSkippedHost } from "../src/request-guard.mjs";
import { validatePublicUrl } from "../src/url-safety.mjs";

const publicLookup = async () => [{ address: "93.184.216.34" }];
const validate = (href) => validatePublicUrl(href, publicLookup);

function fakeRoute({ url, resourceType = "document", subframe = false }) {
  const calls = [];
  return {
    calls,
    request: () => ({
      url: () => url,
      resourceType: () => resourceType,
      isNavigationRequest: () => resourceType === "document",
      frame: () => ({ parentFrame: () => (subframe ? {} : null) })
    }),
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

test("não carrega o conteúdo de iframes, só a página principal", async () => {
  const frame = fakeRoute({ url: "https://www.youtube.com/embed/x", subframe: true });
  await createRequestGuard({ validate })(frame);
  assert.deepEqual(frame.calls, [["abort", undefined]]);

  const main = fakeRoute({ url: "https://example.com/" });
  await createRequestGuard({ validate })(main);
  assert.deepEqual(main.calls, [["continue"]]);
});

test("ignora rastreadores, widgets sociais e folhas de fontes de terceiros", async () => {
  for (const url of [
    "https://www.googletagmanager.com/gtag/js?id=x",
    "https://static.cdninstagram.com/rsrc.php/x.js",
    "https://fonts.googleapis.com/css2?family=Roboto",
    "https://static.cloudflareinsights.com/beacon.min.js"
  ]) {
    const route = fakeRoute({ url, resourceType: "script" });
    await createRequestGuard({ validate })(route);
    assert.deepEqual(route.calls, [["abort", undefined]], url);
  }
  assert.equal(isSkippedHost("fonts.googleapis.com"), true);
  assert.equal(isSkippedHost("camaradecarauari.am.gov.br"), false);
  assert.equal(isSkippedHost("notfacebook.com"), false);
});
