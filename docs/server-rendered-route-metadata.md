# Server-rendered route metadata

Public static routes are served through `api/page-meta.mjs` so their title, description, canonical URL, social metadata, crawler directives, and WebPage or Article structured data are present before client JavaScript executes.

Filtered discovery and company-claim URLs receive `noindex,follow,noarchive`. Authenticated and private workspace paths receive `X-Robots-Tag: noindex,nofollow,noarchive` and private no-store caching at the Vercel routing layer.

Dynamic catalog and entity pages continue to use their dedicated metadata functions.
