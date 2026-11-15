import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// The deployment files hold rules too, and nothing else would notice one being broken: a
// volume mounted in the wrong service or a port published to the world still starts fine.
// These read the files as text, since the project has no YAML parser and needs none.

const read = (path: string) => readFileSync(fileURLToPath(new URL(`../../${path}`, import.meta.url)), 'utf8');

const productionCompose = read('deploy/compose.yaml');
const developmentCompose = read('docker-compose.yml');
const caddyfile = read('deploy/caddy/Caddyfile');

// One service's block: from its name, indented two spaces, to the next key at that depth or
// shallower. Comment lines are dropped, so a comment may still mention what the service lacks.
const serviceBlock = (compose: string, service: string) => {
  const lines = compose.split(/\r?\n/);
  const start = lines.findIndex(line => line === `  ${service}:`);
  if (start === -1) {
    throw new Error(`No service "${service}" in the compose file.`);
  }
  const rest = lines.slice(start + 1);
  const end = rest.findIndex(line => /^ {0,2}\S/.test(line) && !line.trim().startsWith('#'));
  return rest.slice(0, end === -1 ? rest.length : end).filter(line => !line.trim().startsWith('#')).join('\n');
};

// Every "host:container" port mapping in a compose file that reaches Postgres.
const postgresPorts = (compose: string) =>
  [...compose.matchAll(/^\s*-\s*"?([^"\n#]*:5432)"?\s*$/gm)].map(match => match[1]);

describe('deploy configuration', () => {
  it('Should_KeepPrivateUploadsAwayFromCaddy_When_MountingVolumes', () => {
    // Act
    const app = serviceBlock(productionCompose, 'app');
    const caddy = serviceBlock(productionCompose, 'caddy');

    // Assert: the app writes them, and the web server has no path to them (CLAUDE.md § Access).
    expect(app).toContain('media_private:/app/media-private');
    expect(caddy).not.toMatch(/media[_-]private/);
    expect(caddyfile).not.toMatch(/media[_-]private/);
  });

  it.each([
    ['production', productionCompose],
    ['development', developmentCompose],
  ])('Should_PublishPostgresOnLoopbackOnly_When_RunningIn %s', (_case, compose) => {
    // Act
    const ports = postgresPorts(compose);

    // Assert: Docker's iptables rules bypass the firewall, so a bare 5432:5432 is public.
    expect(ports.length).toBeGreaterThan(0);
    for (const port of ports) {
      expect(port).toMatch(/^127\.0\.0\.1:\d+:5432$/);
    }
  });

  it('Should_PublishNoAppPort_When_RunningInProduction', () => {
    // Act
    const app = serviceBlock(productionCompose, 'app');

    // Assert: only Caddy reaches the app, which is what makes X-Forwarded-For trustworthy.
    expect(app).not.toMatch(/^\s*ports:/m);
    expect(app).toContain('NUXT_TRUST_PROXY: "true"');
  });

  it('Should_CapEveryRequestBody_When_CaddyTakesARequest', () => {
    // Act
    const caps = [...caddyfile.matchAll(/max_size\s+(\S+)/g)].map(match => match[1]);

    // Assert: a small default, and a larger cap only for a route named by a matcher.
    expect(caps).toContain('64KB');
    expect(caddyfile).toMatch(/@otherBodies not path_regexp/);
    expect(caddyfile).toMatch(/request_body @otherBodies \{\s*max_size 64KB/);
  });

  it('Should_ServeOnlyPhotosFromTheMediaVolume_When_AFileIsRequested', () => {
    // Assert: anything but a .webp file answers 404, so a stray file can't become a page.
    expect(caddyfile).toMatch(/@photo \{\s*path \*\.webp\s*file\s*\}/);
    expect(caddyfile).toMatch(/handle @photo \{\s*file_server\s*\}/);
    expect(caddyfile).toMatch(/handle \{\s*respond 404\s*\}/);
  });
});
