#!/usr/bin/env bash
# Integration test for SSR meta routes (server/ssrMetaRoutes.ts)
# Verifies:
#   1. Crawler UAs receive per-route HTML with correct metadata
#   2. Browser UAs pass through to the SPA (no SSR injection)
#   3. Crawler responses carry Cache-Control: no-store + Vary: User-Agent
#
# Usage: bash scripts/test-ssr-meta-routes.sh [BASE_URL]
# Default BASE_URL: http://localhost:5000

BASE_URL="${1:-http://localhost:5000}"
PASS=0
FAIL=0

ok()   { echo "  ✅  $*"; PASS=$((PASS+1)); }
fail() { echo "  ❌  $*"; FAIL=$((FAIL+1)); }

check_contains() {
  local label="$1" value="$2" expected="$3"
  if echo "$value" | grep -q "$expected"; then
    ok "$label"
  else
    fail "$label (expected to contain: $expected)"
    echo "     First 3 lines: $(echo "$value" | head -3)"
  fi
}

check_not_contains() {
  local label="$1" value="$2" unexpected="$3"
  if echo "$value" | grep -q "$unexpected"; then
    fail "$label (should NOT contain: $unexpected)"
  else
    ok "$label"
  fi
}

crawler_headers() { curl -sI -A "Googlebot/2.1 (+http://www.google.com/bot.html)" "$BASE_URL$1"; }
crawler_body()    { curl -s  -A "GPTBot/1.1" "$BASE_URL$1"; }
browser_body()    { curl -s  -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120" "$BASE_URL$1"; }

echo ""
echo "══════════════════════════════════════════════════════════"
echo "  SSR Meta Route Integration Tests"
echo "  Target: $BASE_URL"
echo "══════════════════════════════════════════════════════════"

# ── Per-route correctness ──────────────────────────────────────────────────

test_route() {
  local path="$1" expected_title="$2"

  echo ""
  echo "── $path ──"

  local body headers browser
  body=$(crawler_body "$path")
  headers=$(crawler_headers "$path")
  browser=$(browser_body "$path")

  check_contains "crawler: <title> contains '$expected_title'" "$body" "$expected_title"
  check_contains "crawler: has meta description"               "$body" 'name="description"'
  check_contains "crawler: has og:title"                      "$body" 'og:title'
  check_contains "crawler: has og:description"                "$body" 'og:description'
  check_contains "crawler: has og:image"                      "$body" 'og:image'
  check_contains "crawler: has JSON-LD"                       "$body" 'application/ld+json'
  check_contains "crawler: has canonical"                     "$body" 'rel="canonical"'
  check_contains "crawler: has semantic <h1>"                 "$body" '<h1>'
  check_contains "crawler: Cache-Control: no-store"           "$headers" 'no-store'
  check_contains "crawler: Vary header present"               "$headers" 'Vary'
  check_contains "browser: gets HTML response"                "$browser" '<html'
  if [[ "$path" != "/" ]]; then
    check_not_contains "browser: no seo-content div (SPA pass-through)" "$browser" 'id="seo-content"'
  fi
}

test_route "/"             "Coin Railz | Payment Infrastructure for AI Agents"
test_route "/ai-marketplace" "Agentic AI Marketplace"
test_route "/enterprise"   "Autonomous Financial Services"
test_route "/iot"          "IoT Payments"
test_route "/fleet"        "Fleet Telematics Data API"
test_route "/weather"      "Weather"
test_route "/satellite"    "Satellite Data APIs"
test_route "/dex-trading"  "DEX Trading"
test_route "/developers"   "Developer Documentation"
test_route "/quickstart"   "Quickstart Guide"
test_route "/sdk-landing"  "AI Agent Payments SDK"
test_route "/bundles"      "AI Agent API Bundles"

# ── AI & social crawler UA matrix ─────────────────────────────────────────

echo ""
echo "── AI & social crawler UA matrix ─────────────────────"

check_crawler_ua() {
  local ua="$1"
  local code ct title
  code=$(curl -s -o /dev/null -w "%{http_code}" -A "$ua" "$BASE_URL/satellite")
  ct=$(curl -sI -A "$ua" "$BASE_URL/satellite" | grep -i content-type | head -1 | tr -d '\r\n')
  title=$(curl -s -A "$ua" "$BASE_URL/satellite" | grep -oP '(?<=<title>)[^<]+' | head -1)
  if [[ "$code" == "200" ]] && echo "$ct" | grep -q "text/html" && echo "$title" | grep -q "Satellite"; then
    ok "$ua → 200 HTML with correct title"
  else
    fail "$ua → HTTP $code | $ct | title='$title'"
  fi
}

check_crawler_ua "GPTBot/1.1"
check_crawler_ua "ClaudeBot/1.0"
check_crawler_ua "PerplexityBot/1.0"
check_crawler_ua "Applebot-Extended/1.0"
check_crawler_ua "Twitterbot/1.0"
check_crawler_ua "LinkedInBot/1.0"
check_crawler_ua "facebookexternalhit/1.1"
check_crawler_ua "Slackbot-LinkExpanding 1.0"
check_crawler_ua "anthropic-ai/1.0"

# ── Summary ───────────────────────────────────────────────────────────────

echo ""
echo "══════════════════════════════════════════════════════════"
echo "  Results: $PASS passed, $FAIL failed"
echo "══════════════════════════════════════════════════════════"
echo ""

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
exit 0
