# LibreTV personal deployment

Upstream: https://github.com/LibreSpark/LibreTV

Pinned version: 2.16.12, commit `a24ad336a3f7c8a16ca93d1f1198e08ac6b7e943`.
Upstream source and its AGPL-3.0-or-later license remain in the server release;
the application is deployed without source modifications.

- Public endpoint: `https://tv.hooper.ink/`, requiring its own password.
- Runtime: Node 22 standalone build, systemd `libretv.service`, loopback port 18874.
- Release: `/opt/libretv/releases/a24ad336a3f7/app`, selected by `/opt/libretv/current`.
- Runtime secrets: `/etc/libretv/libretv.env`, root-owned mode 600; never in Git.
  Set `PASSWORD`, independent `PROXY_SECRET`, and `COOKIE_SECURE=true`.
- Resource limits: 512 MiB runtime memory, 150% CPU; no server-side video storage.
- Nginx site: `/etc/nginx/sites-available/tv.hooper.ink`; HTTPS through Certbot.
- TLS renewal: existing Certbot timer and the existing
  `/usr/local/sbin/dsa-stage0-acme-auth` / `dsa-stage0-acme-cleanup` hooks.
  These create temporary `token/index.html` challenges under the old navigation
  public root, matching the existing port-80 redirect to its Node static server.
  A deployment hook tests and reloads Nginx after successful renewals.
- The old `nav-server.service` on port 8080 adds only a `tv.hooper.ink`
  HTTP-to-HTTPS redirect; ACME challenge handling and other hosts are unchanged.
- Video sources: configure from LibreTV settings; no third-party catalog is
  preselected. Viewing history and source settings stay in browser storage.

Verify `/api/status` reports `passwordRequired: true` and `verified: false` for
anonymous visitors. Search/proxy endpoints must reject anonymous requests. A valid
password sets a Secure, HttpOnly session cookie. Test playback using a public HLS
sample before adding personal sources. Stream proxying consumes server bandwidth.

The Dock opens this independent application in a new tab. It does not transmit
the navigation site's session or password. Existing navigation and private-note
data remain untouched.
