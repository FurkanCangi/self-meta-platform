# Chat Preview session recovery

Scope: application/auth integration only. Engine and Report code are unchanged.
Base commit: cece9824aa6b4946156478ed2ae4e5d14471e553.
Frozen engine: 41f4d61b21a080f88d0363eec52dba64782f3040.
Application source identity (not a commit): 63c42d94ae5d62f87cb2bdfd724e644301b381c3a222dc94690c5c71437c6ed0.
This source recipe does not include security files; the release commit also binds those changes.

## Evidence and uncertainty

Previous Preview: dpl_8bLgc8AYDHCyX24wp5jGezjDNnyY. First authenticated question returned 200 and a visible answer. Follow-up returned 401 during authentication, before Chat/provider execution. Re-login returned to the authenticated starter. Read-only session inspection found an active, verified, unrevoked device session expiring 2026-10-12.

The original log did not retain the exact session-denial reason. A transport timeout is not a proven incident root cause. The verified code defect is that backend session-read errors were presented as an expired session.

## Narrow change

Chat POST opts into one complete session verification retry for explicitly recognized transient read errors. Missing, invalid, expired, locked and suspended sessions are not retried. Every retry repeats authorization checks; no cached authorization or bypass is introduced. Other guard consumers retain their default behavior.

Unresolved session-read errors produce auth_service_unavailable/503 instead of a false session_expired/401. Safe logs contain stage, bounded error code and denial reason only, never cookies, user messages or raw backend errors. UI preserves the failed question and permits manual retry; no automatic question/provider replay occurs.

## Local verification

- 26 session recovery tests PASS (network-free mocks against actual guard/session modules).
- Existing 45 device-trust contract checks PASS.
- Full TypeScript no-emit check PASS.
- git diff --check PASS.
- Frozen Chat engine and protected Report paths have no changes.

These local results are not authenticated deployment proof or new Final70 acceptance. Historical strict FAIL and owner PASS_WITH_KNOWN_ISSUE disposition remain unchanged. Production promotion is not performed by this record. Preview build and authenticated two-turn regression must be recorded separately against the resulting commit.
