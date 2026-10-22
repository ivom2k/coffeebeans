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

### 6. Deploy key

**(cmd)** Create a key with no passphrase, since CI can't type one:

```
ssh-keygen -t ed25519 -N "" -C kohvioad-github-deploy -f %USERPROFILE%\.ssh\kohvioad_deploy
```

On the server, add the public key (`kohvioad_deploy.pub`) to `~/.ssh/authorized_keys` as one line:

```
restrict,command="/opt/kohvioad/deploy/deploy.sh" ssh-ed25519 AAAA... kohvioad-github-deploy
```

`command=` makes sshd run `deploy.sh` whatever the client asks for, and passes the request in `SSH_ORIGINAL_COMMAND`. `restrict` turns off port forwarding, agent forwarding and the terminal. If the private key leaks, all it can do is redeploy a commit that is already on `main`.

The private key goes into GitHub (step 8). Delete the local copy afterwards; a new key replaces it if needed.

### 7. DNS (Zone.ee)

1. Check the A record's TTL: **(cmd)** `nslookup -debug -type=A kohvioad.eu ns.zone.eu`, under ANSWERS. If it's long, lower it to 300 and wait out the old value first. Zone's default was already 300.
2. Point A at `<ip>`. Add AAAA with the IPv6 address, if the VM has one. `www` must be a CNAME to `kohvioad.eu`; Zone creates it that way.
3. **(cmd)** `nslookup kohvioad.eu 1.1.1.1` shows `<ip>`. Do this before the first deploy: Caddy requests the certificate as soon as it starts, and Let's Encrypt can verify only a domain that already points here.

### 8. GitHub (repository settings)

- **Environments → New environment** `production`. Under deployment branches, select `main` only.
  - Secret `DEPLOY_SSH_KEY`: the content of `kohvioad_deploy` (the private key).
  - Variable `DEPLOY_HOST`: `<ip>`. Variable `DEPLOY_USER`: `<admin>`.
  - Variable `DEPLOY_KNOWN_HOSTS`: the server's host key. **(cmd)** `ssh-keyscan -t ed25519 <ip>` prints it. First check that `ssh-keyscan -t ed25519 <ip> | ssh-keygen -lf -` shows the same fingerprint as `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub` on the server. That check is what prevents a man-in-the-middle at this step.
    - Windows' built-in `ssh-keyscan` (OpenSSH 9.5) may fail against the server's newer OpenSSH with `choose_kex: unsupported KEX method sntrup761x25519-sha512@openssh.com`. Use Git's instead: `"C:\Program Files\Git\usr\bin\ssh-keyscan.exe" -t ed25519 <ip>`. Or read the key you already accepted at your first login: `ssh-keygen -F <ip>`.

### 9. First deploy

A push to `main` runs the workflow.

- The first push creates the GHCR package `ghcr.io/ivom2k/coffeebeans`. It came out **public** in 2026, apparently because it is linked to the public repository through the image's `org.opencontainers.image.source` label.
- If a later package ever comes out private, `deploy` fails to pull it with `denied`. Fix it under **Packages → coffeebeans → Package settings → Change visibility → Public**, then re-run the failed jobs.
- If `deploy` ran before steps 6–8 were done, it failed with ssh's usage text, because there was no host to connect to. Re-run it once they're done.

Then seed the fictional catalogue once, into the freshly migrated database:

```bash
cd /opt/kohvioad/deploy
docker compose run --rm migrate npm run db:seed
```

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
- **Postgres and Caddy updates.** Deploys never pull these two, so a deploy can't upgrade the database by surprise. Run the update command above monthly, or after a security release.
- **DBeaver.** **(cmd)** `ssh -N -L 5433:127.0.0.1:5432 <admin>@<ip>`, then connect DBeaver to `localhost:5433` with the credentials from `.env`.
- **Restore.** Until launch there are no provider backups or snapshots. The server holds only the fictional seed, so a broken one is rebuilt from this runbook. Restoring the database from an off-provider dump arrives with launch.
