// React Router's data routers build every navigation as
// `new Request(url, { signal: new AbortController().signal })`. Under jsdom the
// AbortController is jsdom's while Request is Node's (undici), and Node 24's
// undici rejects a foreign signal — every test that navigates then fails with
// "Expected signal to be an instance of AbortSignal". test-setup.ts bridges it.
describe("Request with the test environment's AbortSignal", () => {
  it("accepts the global AbortController's signal", () => {
    const controller = new AbortController();
    expect(() => new Request("http://localhost/x", { signal: controller.signal })).not.toThrow();
  });

  it("still aborts the request when the controller aborts", () => {
    const controller = new AbortController();
    const request = new Request("http://localhost/x", { signal: controller.signal });
    controller.abort();
    expect(request.signal.aborted).toBe(true);
  });
});
