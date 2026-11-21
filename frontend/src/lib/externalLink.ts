/**
 * Opening a link outside the app. In a browser an ordinary target="_blank" link does it, and
 * on a phone a maps.google / yandex link then opens the maps app when it is installed. Inside
 * the mobile app's WebView a link to another site is blocked, so when the app provides the
 * `AndozaExternalLink` channel the URL is handed to it instead (it opens it with the system:
 * the maps app, Telegram, the browser).
 */
type Channel = { postMessage: (message: string) => void };

function channel(): Channel | null {
  const c = (window as unknown as { AndozaExternalLink?: Channel }).AndozaExternalLink;
  return c && typeof c.postMessage === "function" ? c : null;
}

/** For an <a target="_blank">'s onClick: hands the link to the app when there is one. */
export function handOffExternal(event: { preventDefault: () => void }, href: string): void {
  const app = channel();
  if (!app || !/^https?:\/\//i.test(href)) return;
  event.preventDefault();
  app.postMessage(href);
}
