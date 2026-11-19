# Production server runbook

kohvioad.eu runs on one Pilvio VPS in Tallinn (Ubuntu 26.04 LTS) with Docker Compose:

- GitHub Actions builds two images on every push to `main` and pushes them to GHCR, tagged with the commit SHA: `app-<sha>` and `migrate-<sha>`.
- Once `check`, `test` and `image` pass, the `deploy` job logs in over SSH with a key that may run only `deploy.sh`. The script checks out that commit and starts it.
- On the server the repository is a read-only clone at `/opt/kohvioad`. Secrets live only in `/opt/kohvioad/deploy/.env`.

Server commands below are bash on the VPS. Commands marked **(cmd)** run on the Windows PC. `<admin>` is your login user on the server and `<ip>` its IPv4 address.

## One-time setup

### 1. The VM (Pilvio dashboard)

- Ubuntu 26.04 LTS, 1 vCPU, 2 GB RAM, 40 GB disk, Tallinn, sized per resource (the dashboard's bundles don't offer this size). Give it your SSH public key, a login user with a password (your way in through the web console if SSH breaks), a floating IPv4 and the IPv6 address. Leave automatic backups off until launch.
- Firewall: create it in Pilvio's firewall menu, then attach it to the VM. The VM's network tab only lists firewalls already attached.
  - Inbound, from any source: 22/tcp, 80/tcp, 443/tcp, 443/udp, `icmp` and `icmp6`. `icmp6` is a separate protocol in Pilvio, and IPv6 needs it.
  - Outbound: keep the allow-all rule Pilvio puts into a new firewall. Its firewall page says that whatever no rule allows is blocked, in both directions, and the server needs apt, the image registries, GitHub and Let's Encrypt.
  - It filters before traffic reaches the VM, so Docker's iptables rules can't bypass it the way they bypass ufw.
- On the VM, check:
  - `systemd-detect-virt`: a hypervisor such as `kvm`. `lxc` or `openvz` would mean a container, where Docker may not run.
  - `ip -6 addr show scope global`: an address here means the AAAA record can go in.
- **(cmd)** `curl --connect-timeout 5 http://<ip>:8080/` should time out. A timeout means the firewall dropped the packet. Without a firewall, the VM would answer "connection refused" at once, because nothing listens on that port.

### 2. Admin user and SSH

Pilvio creates the login user from the dashboard with your key and passwordless sudo: `sudo -n true` succeeds. That user is `<admin>`. A provider that gives you only `root` needs one created first:

```bash
sudo adduser <admin>
sudo usermod -aG sudo <admin>
sudo install -d -m 700 -o <admin> -g <admin> /home/<admin>/.ssh
sudo install -m 600 -o <admin> -g <admin> ~/.ssh/authorized_keys /home/<admin>/.ssh/authorized_keys
```

Then `/etc/ssh/sshd_config.d/10-hardening.conf`:

```
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
```

For most settings, sshd keeps the first value it reads, and it reads this folder in name order, so `10-` wins over a cloud-init `50-cloud-init.conf` that may allow passwords.

```bash
sudo sshd -t && sudo systemctl restart ssh
sudo sshd -T | grep -E '^(passwordauthentication|permitrootlogin)'
```

Keep the current session open and log in as `<admin>` from a second terminal before closing it. If the new login fails, the open session is the way back in.

### 3. Updates and swap

```bash
sudo apt update && sudo apt full-upgrade -y
systemctl is-active unattended-upgrades
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

The swap file is headroom for memory spikes (an image pull, sharp from Phase 6), so the kernel doesn't kill Postgres or Node.

### 4. Docker

Install Docker Engine and the Compose plugin from Docker's own apt repository, following https://docs.docker.com/engine/install/ubuntu/ ("Install using the apt repository"). Don't use Pilvio's one-click Docker image, so that this setup can be repeated anywhere.

```bash
sudo usermod -aG docker <admin>   # log out and in again afterwards
docker version && docker compose version
```

Membership of the `docker` group is equal to root: any member can start a container that mounts `/`.

### 5. The app folder

```bash
sudo install -d -o <admin> -g <admin> /opt/kohvioad
git clone https://github.com/ivom2k/coffeebeans.git /opt/kohvioad
cd /opt/kohvioad/deploy
install -m 600 .env.example .env
openssl rand -hex 32   # once for POSTGRES_PASSWORD, once more for NUXT_SESSION_PASSWORD
nano .env
```

The Google sign-in values come from step 6.

### 6. Google sign-in (Google Cloud Console)

The `kohvioad` project at https://console.cloud.google.com, under Google Auth Platform:

- Branding: app name `kohvioad`, home page `https://kohvioad.eu`, authorised domain `kohvioad.eu`. No logo: a logo waits for Google's brand verification before it shows.
- Data access: only the `openid` scope. Google then sends only the account's subject (`sub`), the one thing `app_user` stores.
- Clients: `kohvioad-prod`, a web application whose only redirect URI is `https://kohvioad.eu/api/auth/google`, the address `compose.yaml` sets. Development has its own client, `kohvioad-dev`, so this secret exists only on the server.
- Google shows a client secret only once, when it is created. Put the client ID and secret into `.env`. If the secret is lost, add a new one to the client, put that in `.env`, then delete the old one.

`compose.yaml` requires both. Without them a deploy stops at `docker compose pull` with `required variable NUXT_OAUTH_GOOGLE_CLIENT_ID is missing a value`, and plain `docker compose` commands fail the same way. The running containers are left as they were: fill in `.env` and re-run the failed job. To check without printing the values, `grep -c '^NUXT_OAUTH_GOOGLE_CLIENT_' .env` prints `2`.

A redirect URI that differs from Google's by a single character fails at Google with `Error 400: redirect_uri_mismatch`.

### 7. Deploy key

**(cmd)** Create a key with no passphrase, since CI can't type one:

```
ssh-keygen -t ed25519 -N "" -C kohvioad-github-deploy -f %USERPROFILE%\.ssh\kohvioad_deploy
```

On the server, add the public key (`kohvioad_deploy.pub`) to `~/.ssh/authorized_keys` as one line:

```
restrict,command="/opt/kohvioad/deploy/deploy.sh" ssh-ed25519 AAAA... kohvioad-github-deploy
```

`command=` makes sshd run `deploy.sh` whatever the client asks for, and passes the request in `SSH_ORIGINAL_COMMAND`. `restrict` turns off port forwarding, agent forwarding and the terminal. If the private key leaks, all it can do is redeploy a commit that is already on `main`.

The private key goes into GitHub (step 9). Delete the local copy afterwards; a new key replaces it if needed.

### 8. DNS (Zone.ee)

1. Check the A record's TTL: **(cmd)** `nslookup -debug -type=A kohvioad.eu ns.zone.eu`, under ANSWERS. If it's long, lower it to 300 and wait out the old value first. Zone's default was already 300.
2. Point A at `<ip>`. Add AAAA with the IPv6 address, if the VM has one. `www` must be a CNAME to `kohvioad.eu`; Zone creates it that way.
3. **(cmd)** `nslookup kohvioad.eu 1.1.1.1` shows `<ip>`. Do this before the first deploy: Caddy requests the certificate as soon as it starts, and Let's Encrypt can verify only a domain that already points here.

### 9. GitHub (repository settings)

- **Environments → New environment** `production`. Under deployment branches, select `main` only.
  - Secret `DEPLOY_SSH_KEY`: the content of `kohvioad_deploy` (the private key).
  - Variable `DEPLOY_HOST`: `<ip>`. Variable `DEPLOY_USER`: `<admin>`.
  - Variable `DEPLOY_KNOWN_HOSTS`: the server's host key. **(cmd)** `ssh-keyscan -t ed25519 <ip>` prints it. First check that `ssh-keyscan -t ed25519 <ip> | ssh-keygen -lf -` shows the same fingerprint as `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub` on the server. That check is what prevents a man-in-the-middle at this step.
    - Windows' built-in `ssh-keyscan` (OpenSSH 9.5) may fail against the server's newer OpenSSH with `choose_kex: unsupported KEX method sntrup761x25519-sha512@openssh.com`. Use Git's instead: `"C:\Program Files\Git\usr\bin\ssh-keyscan.exe" -t ed25519 <ip>`. Or read the key you already accepted at your first login: `ssh-keygen -F <ip>`.

### 10. First deploy

A push to `main` runs the workflow.

- The first push creates the GHCR package `ghcr.io/ivom2k/coffeebeans`. It came out **public** in 2026, apparently because it is linked to the public repository through the image's `org.opencontainers.image.source` label.
- If a later package ever comes out private, `deploy` fails to pull it with `denied`. Fix it under **Packages → coffeebeans → Package settings → Change visibility → Public**, then re-run the failed jobs.
- If `deploy` ran before steps 7–9 were done, it failed with ssh's usage text, because there was no host to connect to. Re-run it once they're done.

Then seed the fictional catalogue once, into the freshly migrated database:

```bash
cd /opt/kohvioad/deploy
docker compose run --rm migrate npm run db:seed
```

### 11. Admin role

The coffee editor at https://kohvioad.eu/admin is for accounts whose `app_user.role` is `ADMIN`; everyone signs up as `USER`. Sign in once with your Google account, then over the DBeaver tunnel (Routine operations below) find your row and promote it:

```sql
SELECT id, created_at FROM app_user WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 5;
UPDATE app_user SET role = 'ADMIN' WHERE id = <your id>;
```

Your row is the one created when you signed in; before launch it is the only one besides the seed's (whose `created_at` is the seed's time). The role is read from the database on every request, so the next page load sees it, with no new sign-in. `UPDATE 0` means the id matched no row.

## Coffee photos

The admin's uploads live in the named volume `kohvioad_media`: the app writes it at `/app/media`, and Caddy serves it read-only at `/media/`. Each upload is re-encoded to two WebP files (`coffee/<slug>-<random>.webp` and its `.thumb.webp`), and a replaced or removed photo's files are deleted.

- **See it.** `docker volume ls` lists `kohvioad_media`; `docker compose exec app ls -la /app/media/coffee` lists the files. `ls -ld /app/media` must show the owner `node`; owned by `root`, every upload fails with `EACCES` in the app's log.
- **Keep it.** Like `pgdata`, it survives `docker compose down` and every redeploy. `docker compose down -v` deletes it together with the database. The Phase 10 backups copy it along with the `pg_dump`.
- **A 413 on upload** comes from Caddy's 16 MB body cap or the app's 15 MB limit: the photo is bigger than any phone photo should be.
- **Only `.webp` is served.** Caddy answers 404 for any other file under `/media/`, so a file that got into the volume some other way can't be opened as a page of this site.

## Private uploads

Suggestion photos (Phase 7) wait for review in a second named volume, `kohvioad_media_private`, mounted at `/app/media-private` in the `app` container and nowhere else. Caddy has no mount of it, so no URL leads to these files; the only way to see one is the app's admin route.

- **See it.** `docker volume ls` lists `kohvioad_media_private` after the first deploy that has it; `docker compose exec app ls -ld /app/media-private` must show the owner `node`, as for `media`.
- **Check the isolation.** `docker compose config` prints the stack as Compose reads it: `media_private` appears under `app`'s volumes and not under `caddy`'s. `docker inspect kohvioad-caddy-1 --format "{{range .Mounts}}{{.Destination}} {{end}}"` lists what the running Caddy really mounts: `/srv/media`, `/etc/caddy`, `/data` and `/config`, nothing else.
- **Keep it.** It survives redeploys like the others, and `docker compose down -v` deletes it with them. The files are short-lived by design (deleted at review), so the backups leave it out.

## What the server refuses

Three layers answer before any endpoint's own code runs. When a request fails, the status code says which one.

| Status | Who answers | Meaning |
|---|---|---|
| 403 `Cross-site request refused` | the app (`server/middleware/0.guard.ts`) | A write (anything but GET) that didn't come from a page of https://kohvioad.eu. From `curl`, send no `Origin` header or the site's own. |
| 411 | the app | A body sent in chunks, without `Content-Length`. Browsers always send the length. |
| 413 | Caddy, or the app | A body over the route's cap. Caddy: 64 KB, and 16 MB for the admin's photo upload. The app: 32 KiB and 15 MiB (`server/features/security/bodyLimits.ts`). A new upload route needs both raised, or it answers 413 here first. |
| 415 | the app | JSON sent with a `Content-Type` other than `application/json`. |
| 429, with `Retry-After` | the app (`server/middleware/3.rateLimit.ts`) | Too many requests from one address or account: 60 searches a minute, 30 rating saves an hour, 5 feedback messages an hour, and so on (`server/features/security/rateLimits.ts`). The counts live in the app's memory, so a restart or deploy clears them. |
| 429, without `Retry-After` | the app (`server/api/feedback.post.ts`) | A feedback message over a daily cap, counted from the table: 10 a day per sender, 300 a day for the whole site (`shared/utils/feedback.ts`). It doesn't say which. |
| 503 `Feedback unavailable` | the app | `NUXT_IP_HMAC_KEY` is missing from `.env` or shorter than 32 characters (Feedback, below). |
| 503 `Too many uploads at once` | the app | More than five photo uploads in flight; they are decoded one at a time. |

The rate limiter needs the visitor's address. The app takes it from the `X-Forwarded-For` header only because `compose.yaml` sets `NUXT_TRUST_PROXY=true`, and that is safe only because the app publishes no port: Caddy is the one thing that can reach it. If the app ever gets a `ports:` entry, anyone could send that header themselves.

## Feedback

The footer's "Tagasiside" needs no account. The admin reads the messages at https://kohvioad.eu/admin/tagasiside. A visitor's message is stored with an HMAC of their address (an IPv6 address cut to its /64), never the address itself; a signed-in user's is stored with their account and no hash. The hash exists only to count one sender's messages per day.

- **The key.** `NUXT_IP_HMAC_KEY` in `.env`, 64 hex characters from `openssl rand -hex 32`. `compose.yaml` requires it, so a server without it stops the deploy at `docker compose pull` with "required variable NUXT_IP_HMAC_KEY is missing a value", and the running site stays as it was.
- **Add it** (bash, from `/opt/kohvioad/deploy`): `echo "NUXT_IP_HMAC_KEY=$(openssl rand -hex 32)" >> .env`. `>>` appends; a single `>` would replace the whole file. Then `grep -c '^NUXT_IP_HMAC_KEY=' .env` must print `1`; `2` means it ran twice, so remove one line with `nano .env`.
- **Rotate it** by replacing the value and running `docker compose up -d`. Nothing breaks: old hashes simply stop matching new ones, which resets each sender's daily count. It is a secret of its own so that rotating it never signs anyone out, as changing `NUXT_SESSION_PASSWORD` does.
- **Clear spam** in DBeaver (Routine operations). Look first: `SELECT id, created_at, ip_hmac, left(message, 80) FROM feedback WHERE created_at > now() - interval '1 day' ORDER BY created_at DESC;`. A flood from one sender shares one `ip_hmac`, so delete by that value: `DELETE FROM feedback WHERE ip_hmac = '<the hash>';`. Deleted rows no longer count towards the daily caps.
- **Retention.** The nightly cleanup task (Phase 7.4) clears the hashes after 30 days and deletes messages after 12 months.

## The app container's limits

`compose.yaml` caps the `app` container at 900 MB of RAM and 256 processes, because it decodes visitors' photos.

- **See the usage.** `docker stats --no-stream` prints one line per container: `MEM USAGE / LIMIT` should read a few hundred MiB of `900MiB` for the app, and `PIDS` a few dozen.
- **Was it killed?** `docker inspect kohvioad-app-1 --format "{{.State.OOMKilled}} restarts={{.RestartCount}}"`. `true` means the kernel stopped it at the limit; `restart: unless-stopped` has already started it again. If that happens without an upload in progress, the limit is too low for the app itself: raise `mem_limit` in `compose.yaml`.
- **The limit and Node.** Node sizes its heap from the container's limit, so it collects garbage before it reaches the cap rather than being killed at it.

## Routine operations

All from `/opt/kohvioad/deploy`, where Compose finds `compose.yaml` and `.env`.

| Task | Command |
|---|---|
| What runs, which image tags | `docker compose ps` |
| Recent logs | `docker compose logs --tail 100 app` (also `caddy`, `db`, `migrate`) |
| Redeploy or roll back | `./deploy.sh <full sha of a commit on main>` |
| Update Postgres and Caddy within their major versions | `docker compose pull db caddy && docker compose up -d` |
| Launch: allow indexing | set `NUXT_SITE_INDEXABLE=true` in `.env`, then `docker compose up -d` |

- **Rollback.** A rollback works while that commit's images are still in GHCR. Drizzle has no down migrations, so the older app has to cope with the newer schema. That holds for additive changes (new tables or columns) and breaks for renames and drops.
- **Postgres and Caddy updates.** Step 3 of the monthly maintenance below.
- **DBeaver.** **(cmd)** `ssh -N -L 5433:127.0.0.1:5432 <admin>@<ip>`, then connect DBeaver to `localhost:5433` with the credentials from `.env`.
- **Restore.** Until launch there are no provider backups or snapshots. The server holds only the fictional seed, so a broken one is rebuilt from this runbook. Restoring the database from an off-provider dump arrives with launch.

## Monthly maintenance

What runs by itself: Ubuntu installs its security updates daily (`unattended-upgrades`), Caddy renews the certificate, Compose caps every container's log at 30 MB, and `deploy.sh` removes unused images. The rest is by hand, once a month, in this order, from `/opt/kohvioad/deploy`.

1. **Did the automatic updates run?**

   ```bash
   systemctl list-timers 'apt-daily*'
   sudo tail -n 30 /var/log/unattended-upgrades/unattended-upgrades.log
   ```

   `apt-daily-upgrade.timer` starts the daily install: its LAST column should be under a day old. The times move from day to day on purpose (a random delay, so not every Ubuntu server hits the mirrors at once), and they are in UTC, the server's clock. The log lists each run and what it installed. Its `Allowed origins are:` line shows that only Ubuntu's own packages qualify. Without `sudo`, `tail` fails with `Permission denied`: the folder is readable only by root and the `adm` group.

2. **What the automatic updates skip:** Docker Engine, which comes from Docker's repository, and Ubuntu's non-security fixes (`-updates`).

   ```bash
   sudo apt update && sudo apt full-upgrade
   sudo apt autoremove
   ```

   - `update` only refreshes the package lists. `full-upgrade` installs every newer version and, unlike `upgrade`, may add or remove packages when dependencies change, which a new kernel needs. Read its list before answering `y`, and answer `n` if it would remove something you don't expect.
   - An update to `docker-ce` or `containerd.io` restarts the Docker daemon and every container with it: a few seconds of downtime.
   - At the end, `needrestart` restarts the services whose libraries were updated. `Pending kernel upgrade!` means the new kernel runs only after a reboot (step 4). It also leaves `dbus` and `systemd-logind` for that reboot, under `Service restarts being deferred`, because restarting them on a live system can break it. `User sessions running outdated binaries` are your own SSH sessions.
   - `autoremove` deletes packages nothing needs any more, mostly old kernels.
   - `Could not get lock /var/lib/dpkg/lock-frontend … (unattended-upgr)` means the automatic update is running right now. Wait a few minutes and try again; never delete the lock file.

3. **Postgres and Caddy.** Deploys never pull these two, so a deploy can't upgrade the database by surprise.

   ```bash
   docker compose pull db caddy
   docker compose up -d
   ```

   - `pull` fetches the newest image for the tags `postgres:18` and `caddy:2`, so patch releases within the major version, without touching what runs. `up -d` then recreates only the containers whose image changed. The volumes stay, and with them the database and the certificates.
   - The replaced images remain in `docker images` as `<none>` until a deploy's cleanup a week later.
   - Postgres ships minor releases every quarter, on the second Thursday of February, May, August and November. After one, or after a security release of either, this step is worth running between the monthly rounds too.
   - Never change the tag to a new major version here. Postgres 19 can't read 18's data folder, so the container would refuse to start. A major upgrade is a dump and restore, planned on its own.

4. **Reboot, if an update is waiting for one.**

   ```bash
   cat /var/run/reboot-required.pkgs
   ```

   `No such file or directory` means none is needed. If it lists `linux-image-…` or `libc6`, run `sudo reboot` and log in again after a minute. Docker starts `db`, `app` and `caddy` again by itself (`restart: unless-stopped`), on the images they ran before. It doesn't wait for Postgres the way `docker compose up` does, but the app opens its database connection on the first query, so at most the first seconds' requests fail.

5. **Check.**

   ```bash
   docker compose ps
   df -h /
   free -h
   ssh-keygen -lf ~/.ssh/authorized_keys
   ```

   - `db` is `healthy`, `app` and `caddy` are `Up`, and `migrate` is missing or `Exited (0)`. `Restarting` is a crash loop: read `docker compose logs --tail 100 app`.
   - The disk stays under about 80 %. `docker system df` shows Docker's share of it.
   - Swap `used` that grows from month to month means 2 GB of RAM is getting tight.
   - Exactly two keys: yours and `kohvioad-github-deploy`. Any other line is someone else's way in.
   - **(cmd)** `curl -s -o NUL -w "%{http_code}" https://kohvioad.eu/` prints `200`. `-o NUL` throws the page away (NUL is Windows' empty file) and `-w` prints only the status code. Run from the PC, it tests the whole path: DNS, the firewall, the certificate, Caddy and the app.

6. **The app image.** It gets Node and Debian fixes only when CI builds it, since the build pulls the newest `node:26-slim`. If nothing was pushed to `main` this month, **(cmd)** `gh workflow run ci.yml --ref main` (or GitHub → Actions → CI → Run workflow) rebuilds the same commit and deploys it. **(cmd)** `gh run watch` follows the run.

Less often:

- **Yearly:** renew `kohvioad.eu` at Zone.ee before it expires.
- **Ubuntu itself:** no release upgrade. 26.04 LTS has standard support until 2031 (decisions log §8).
