# Page-session continuity repair

Base: 81d79bd86d164dafba282182af83aefd0dbc8457. Scope: shared page-auth proxy availability handling only. Chat semantic code, prompts, sources, gold, acceptance policy and Report Engine unchanged.

Preview evidence: a Chat POST returned401 with safe reason `missing`, after middleware307 responses. The exact original redirect reason was not logged; it is not proven that the original event was PGRST003 or a timeout. Separately, execution of the unmodified proxy with synthetic PGRST003 at each of account_sessions, account_devices and account_security_state reproduced deletion of sm_active_session. A valid control returned200.

Repair: dependency errors now fail closed with503/no-store and preserve the application cookie. Invalid signatures, absent/inactive/expired sessions, binding mismatch, revoked/unverified devices and account locks still deny access. No stale authorization, no bypass, no automatic paid retry. Logs contain stage/code/reason only, not messages, cookies, tokens or personal data. Thrown dependency errors are caught without erasing the session. No DB schema or permissions changed.

Local checks: 32 page-session controls and 26 existing Chat session-recovery controls PASS, TypeScript and diff-check PASS. These are injected tests, not live outage proof or full Chat acceptance. Prior failed smoke remains immutable. Authenticated Preview verification is still required before any production promotion.

Existing device-trust script:45 controls PASS when executed directly with Node's TypeScript support. The package command's separate security-scripts tsc configuration cannot resolve Node typings in this worktree; that command is not claimed PASS. The application-wide tsc --noEmit passed. No config/dependency patch was made for the separate runner.

Application-source recipe @3 remains 9d98ac2bb9ea709b4c55ac4dae1bc04e68b33f0ba4dcf6109ec8ea9fa5565d6b because proxy.ts is outside that recipe. This identity is not a full deployment hash; the new Git commit must separately attest proxy.ts and the rest of the build.

Supabase SSR documentation checked before implementation: https://supabase.com/docs/guides/auth/server-side/creating-a-client?queryGroups=framework&framework=nextjs . Identity continues to use getUser; getSession is used only for binding after validated identity, never as sole authorization. No package changes.
