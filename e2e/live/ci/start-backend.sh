#!/usr/bin/env bash
# Boot a real ObjectStack backend for the live e2e lane — from PUBLISHED
# @objectstack/* packages, serving the showcase app the live specs target.
#
# What it does (idempotent; a stamp file skips prepare when pins are unchanged):
#   1. Sparse-checkout `examples/app-showcase` from objectstack-ai/objectstack
#      at the pinned OBJECTSTACK_REF (backend.env).
#   2. Rewrite its package.json: every `@objectstack/*` workspace dep -> the
#      pinned published OBJECTSTACK_VERSION; dev-only tooling dropped.
#   3. `npm install` (published tarballs only — nothing is built from source,
#      so the lane tests the console against the released artifacts), with the
#      floating `better-auth` family pinned to BETTER_AUTH_VERSION through an
#      npm `overrides` block — see backend.env and better-auth-pin.mjs.
#   4. Verify that pin actually took, ON EVERY RUN including cache hits, and
#      fail by name if it did not (objectstack#16186 / objectui#8084).
#   5. `objectstack dev --seed-admin --fresh` on $LIVE_BACKEND_PORT with a
#      throwaway sqlite db, then poll the seeded sign-in until it answers.
#
# Env overrides:
#   LIVE_BACKEND_DIR   scratch dir (default: $TMPDIR/objectui-live-backend)
#   LIVE_BACKEND_PORT  backend port (default: 4010)
#   OBJECTSTACK_REPO_URL  metadata source repo (default: GitHub)
#
# Companion: stop-backend.sh (kills only the PID this script recorded).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=backend.env
source "$SCRIPT_DIR/backend.env"

BACKEND_DIR="${LIVE_BACKEND_DIR:-${TMPDIR:-/tmp}/objectui-live-backend}"
PORT="${LIVE_BACKEND_PORT:-4010}"
REPO_URL="${OBJECTSTACK_REPO_URL:-https://github.com/objectstack-ai/objectstack.git}"
APP_DIR="$BACKEND_DIR/app"
STAMP="$BACKEND_DIR/.prepared"
# An absent pin is a hard stop, not a soft default: silently installing the
# floating family is the exact outcome this pin exists to prevent, and it costs
# 300 seconds to discover downstream (objectstack#16186).
: "${BETTER_AUTH_VERSION:?backend.env must declare BETTER_AUTH_VERSION — see its header and objectstack#16186}"
# The pin is IN the stamp: without it, a fixture prepared before a pin change
# satisfies the reuse test and the new pin is never installed. The workflow's
# fixture cache key is the hash of backend.env, which carries the pin for the
# same reason.
WANT_STAMP="$OBJECTSTACK_REF $OBJECTSTACK_VERSION better-auth@$BETTER_AUTH_VERSION"

mkdir -p "$BACKEND_DIR"

prepare() {
  if [ -f "$STAMP" ] && [ "$(cat "$STAMP")" = "$WANT_STAMP" ] && [ -d "$APP_DIR/node_modules" ]; then
    echo "[live-backend] prepare: pins unchanged ($WANT_STAMP), reusing $APP_DIR"
    return
  fi
  echo "[live-backend] prepare: showcase@${OBJECTSTACK_REF:0:12} on published @objectstack/*@$OBJECTSTACK_VERSION"
  rm -rf "$APP_DIR" "$BACKEND_DIR/src" "$STAMP"

  # Shallow, sparse fetch of the pinned commit — metadata source only.
  git init -q "$BACKEND_DIR/src"
  git -C "$BACKEND_DIR/src" remote add origin "$REPO_URL"
  git -C "$BACKEND_DIR/src" sparse-checkout set examples/app-showcase
  git -C "$BACKEND_DIR/src" fetch -q --depth 1 origin "$OBJECTSTACK_REF"
  git -C "$BACKEND_DIR/src" checkout -q FETCH_HEAD

  cp -R "$BACKEND_DIR/src/examples/app-showcase" "$APP_DIR"
  rm -rf "$BACKEND_DIR/src"

  # workspace:* -> the pinned published version; drop dev tooling the server
  # doesn't need (playwright/vitest/typescript — the CLI loads the TS config
  # itself). Keep non-@objectstack runtime deps (e.g. @modelcontextprotocol/sdk).
  #
  # The third argument is the `better-auth` pin, as npm's TOP-LEVEL `overrides`
  # object. Spelling matters and is not interchangeable: this app is installed
  # with `npm install` below, npm reads `overrides`, pnpm reads
  # `pnpm.overrides`, and each ignores the other with no warning and exit 0. The
  # names come from better-auth-pin.mjs so the list that is pinned and the list
  # that is checked cannot drift apart.
  node -e '
    const fs = require("fs");
    const file = process.argv[1], pin = process.argv[2];
    const overrides = JSON.parse(process.argv[3]);
    const pkg = JSON.parse(fs.readFileSync(file, "utf8"));
    for (const k of Object.keys(pkg.dependencies || {}))
      if (k.startsWith("@objectstack/")) pkg.dependencies[k] = pin;
    pkg.devDependencies = { "@objectstack/cli": pin };
    pkg.overrides = Object.assign({}, pkg.overrides, overrides);
    fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + "\n");
  ' "$APP_DIR/package.json" "$OBJECTSTACK_VERSION" \
    "$(node "$SCRIPT_DIR/better-auth-pin.mjs" overrides "$BETTER_AUTH_VERSION")"

  (cd "$APP_DIR" && npm install --no-audit --no-fund --loglevel=error)
  echo "$WANT_STAMP" > "$STAMP"
}

start() {
  # Trust a recorded pid only if it is alive AND is actually an objectstack
  # process — the pid file can ride in from the CI cache, where the raw number
  # may collide with an unrelated process on a fresh runner.
  if [ -f "$BACKEND_DIR/backend.pid" ]; then
    local old_pid
    old_pid="$(cat "$BACKEND_DIR/backend.pid")"
    if kill -0 "$old_pid" 2>/dev/null && grep -qa objectstack "/proc/$old_pid/cmdline" 2>/dev/null; then
      echo "[live-backend] already running (pid $old_pid)"
      return
    fi
    rm -f "$BACKEND_DIR/backend.pid"
  fi
  echo "[live-backend] starting objectstack dev on :$PORT (log: $BACKEND_DIR/backend.log)"
  # --fresh: throwaway sqlite db, auto-removed on SIGTERM. OS_CLOUD_URL=off:
  # no marketplace/cloud calls — the lane must be hermetic.
  (cd "$APP_DIR" && OS_CLOUD_URL=off nohup ./node_modules/.bin/objectstack dev \
      --seed-admin --fresh -p "$PORT" > "$BACKEND_DIR/backend.log" 2>&1 & \
    echo $! > "$BACKEND_DIR/backend.pid")

  # Ready = the seeded admin can actually sign in (same call the e2e
  # global-setup makes). Seeding runs at boot, so plain TCP is not enough.
  local deadline=$((SECONDS + 300))
  until curl -sf -o /dev/null -X POST "http://localhost:$PORT/api/v1/auth/sign-in/email" \
      -H 'Content-Type: application/json' \
      -d '{"email":"admin@objectos.ai","password":"admin123"}'; do
    if ! kill -0 "$(cat "$BACKEND_DIR/backend.pid")" 2>/dev/null; then
      echo "[live-backend] backend process died — last 100 log lines:" >&2
      tail -100 "$BACKEND_DIR/backend.log" >&2
      exit 1
    fi
    if [ "$SECONDS" -ge "$deadline" ]; then
      echo "[live-backend] not ready after 300s — last 100 log lines:" >&2
      tail -100 "$BACKEND_DIR/backend.log" >&2
      exit 1
    fi
    sleep 2
  done
  echo "[live-backend] ready: seeded sign-in answered on :$PORT (pid $(cat "$BACKEND_DIR/backend.pid"))"
}

prepare
# Deliberately OUTSIDE prepare(): prepare is skipped on a stamp hit, and a
# reused fixture is one of the ways the pin can stop being true. A check that
# only runs when the thing it checks was just built is not a check.
node "$SCRIPT_DIR/better-auth-pin.mjs" verify "$APP_DIR" "$BETTER_AUTH_VERSION"
start
