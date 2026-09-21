# Studio AI support

The live React Studio website and the Flutter app now include an account-based support conversation in its bottom-right corner. Support does not spend customer credits. The assistant uses the existing server-side Kie AI connection, a scoped product prompt, and the active model/credit-pack catalog.

Uncertain answers, account-specific issues, unsuccessful troubleshooting, explicit human requests, and provider failures escalate to an open ticket. Customers can also use **Open a ticket** directly. A ticket number is only displayed after the database confirms creation. The saved conversation follows the account between sessions. This first version keeps one ongoing support case per account; further help reopens that same case.

Staff open **Studio admin → Support tickets** to review up to 100 recently updated cases, save a customer-visible reply, and mark cases open or resolved. Website customers see replies refresh automatically every 30 seconds while the support panel is open; they can also refresh manually or reopen it. The Flutter panel uses manual refresh/reopen. There are no email notifications or promised response times in this version. Website visitors can ask general platform questions without signing in. Account-specific help and ticket creation require sign-in. The Flutter app currently retains its signed-in support flow.

## Deployment

1. Apply `supabase/migrations/20260905080408_studio_support.sql` through the normal migration workflow.
2. Deploy `studio-support` with the same JWT gateway setting as the existing Studio edge functions. The function independently validates the bearer token with Supabase Auth. It reuses `KIE_API_KEY` and `STUDIO_ALLOWED_ORIGIN`.
3. Build and publish the Studio frontend and the admin frontend using their existing deployment workflows.
4. Verify with a normal account: a product question, a direct ticket, reopening the panel, and a support reply from an admin account. Confirm a second account cannot read the first account's conversation or edit any support record. Test provider failure in staging and verify that it creates a ticket.

## Access and operational details

RLS restricts customers to reading their own conversation. Only admins can update reply/status. Only the service role can reserve requests or append customer/AI messages. A database row lock enforces 30 requests per account per hour. Prompts accept at most 2,000 characters; the provider sees only the 16 most recent conversation messages. The transcript is retained with the account and deleted on account deletion. Admin replies are displayed separately from AI responses and are never sent as user instructions to the model.

Validation passed: Dart analysis, release web build, three support widget tests, TypeScript checking, and two provider-response parsing tests. The migration also passed an isolated PGlite PostgreSQL test with stubbed Supabase auth helpers covering ticket creation, owner isolation, admin replies, service-only writes, rate limiting, and hourly reset. The Supabase migration and edge function are deployed. A live smoke test passed for a real AI product answer, automatic ticket escalation, stable ticket numbers, account isolation, admin reply, resolved status and unauthenticated rejection; temporary test users and their conversations were removed. The admin build was published to timeless-admin.pages.dev. The website implementation lives in .codex-tmp/timeless-support-site, on branch codex/studio-support, and includes the latest concurrent pricing changes. All 33 website tests and the production build passed. The new support component passes ESLint; full-site TypeScript checking still reports pre-existing workspace narrowing and Cloudflare ambient-type errors.


Published website: https://timelessapp.ai/studio (Sites version 33, source 4fc486c6fa0ec2542681e840f56434068987ad92). Both the custom domain and the Sites domain returned HTTP 200 with the support launcher present; browser CORS preflights passed for both origins. Admin deployment: https://2cd4f079.timeless-admin.pages.dev (production alias: timeless-admin.pages.dev).

The admin deploy command confirmed success. Direct post-deploy asset verification from this environment encountered Cloudflare connection timeouts; ticket permissions and staff replies were verified against the live backend. No browser interaction test was performed.


## Guest chat update — September 5

The website support widget uses Studio's pink-to-peach gradient and dark surfaces. Guests use `studio-support-public`, which answers from the same current catalog and cannot read accounts or create tickets. Guests can continue general questions even after an account-specific question prompts sign-in. Explicit support sign-in keeps bounded guest context in session storage and attaches it to the ticket after authentication. Guest context is labeled customer-supplied, unverified text, never trusted instructions.

The `20260905082000_studio_guest_support.sql` migration provides atomic hourly ceilings of 20 requests per hashed client address and 300 globally. Only service-role calls can access counters; no guest transcripts or raw IP addresses are saved in the database. General guest chat remains in component memory unless explicitly handed off for sign-in.

Validation: production build and 33 website tests passed; support component lint and both edge-function type checks passed; 3 Deno tests passed, including rejection of privileged/oversized guest history. Isolated PostgreSQL tests passed for guest caps, hourly reset and service-only access. Live unauthenticated AI questions succeeded, account help required sign-in, guest ticket/read actions returned 401, invalid history returned 400, and a signed-in test ticket retained guest context. Temporary test accounts/tickets were deleted.

Website source: 1e08df4010a2a1fc2d1fba0d91b9a7e7ee3e2ded, Sites version 35. Existing pricing-page work was preserved during integration.

## Browser acceptance test — September 5

Used the live Studio UI as a signed-out visitor. Verified a first-image/subscription question, a contextual cheapest-pack follow-up, Enter-to-send, conversation retention when closing/reopening, an account-payment question prompting sign-in, and Open a ticket launching the sign-in dialog. Logged in with a disposable test account through the actual form: the support panel reopened automatically, created ticket #8 and attached the entire guest conversation. A simulated staff reply appeared with Resolved status; Still need help reopened the same ticket number.

Found and fixed: at the actual narrow browser width, the mobile bottom navigation obscured the support launcher and pointer clicks hit Chat instead. Support now sits above the 68px navigation dock at the same 780px breakpoint, with a panel height that leaves room below the header. Also replaced the internal unverified-context label with customer-facing transcript copy (the stored security label remains unchanged).

Published fix source: 66e6415f907958f2f8e7f312141cf98c56911588, Sites version 37.

Post-deployment browser check passed: support launcher is visible above the mobile dock and a real pointer click opens the panel; the signed-in ticket survives page reload; handoff copy is customer-friendly. Signed out and deleted the disposable test account and ticket #8 after testing.

## Catalog accuracy and progressive replies — September 5

Published Sites version 38 (0f784a96535905d46e1c9a167f4ac428babc6a9a). Studio's full menu is shared by the UI and `/api/studio/support-catalog`, preventing support from overlooking upcoming listings. Support fetches that catalog along with live model credit costs, pricing rules and allowed parameters. Seedance 2.5 is present in the menu but currently has no generation model key or published price; its live support answer now acknowledges the coming-soon listing. No model activation or invented pricing was introduced.

Replies show a shimmer skeleton while waiting for the server, then reveal the completed answer in small text chunks with a caret. This is frontend progressive rendering, not upstream token streaming. Reduced-motion users receive the whole reply without the reveal animation; screen-reader text is announced when complete. Scrollbars match the dark support panel.

Validation: production build, component lint, 33 website tests, 3 Deno tests and edge-function type checks passed. Live browser testing confirmed the Seedance 2.5 answer without a sign-in requirement, the skeleton, an intermediate partial-text frame and the final answer. Both support edge functions were redeployed.

## Video catalog and provider refresh — September 5

Support now reads all 25 enabled video options from the active catalog, prioritizes it over older website listings, and includes configured defaults and image-reference requirements. Website-listing fetch failures no longer block use of the live database catalog. Kie's older GPT 5.2 route returned repeated provider 500 replies during this audit; both support endpoints now use the documented GPT 5.6 Luna Responses route with structured content and non-streamed JSON, followed by the existing progressive frontend reveal. Guest/follow-up and authenticated quotes matched Studio (101 credits at 4s/480p, 815 at 8s/1080p for Seedance 2.5). Personal account questions still require sign-in. Temporary provider errors offer retry without automatically requiring sign-in for a general question. See `maintenance/kie-video-audit/README.md` for the full 29-generation acceptance report.

## Multi-reference catalog and actual response streaming — September 5

Support now receives reference-slot limits, required/optional counts, video-slot weights, automatic-duration behavior and reference pricing. It uses real upstream Responses SSE events rather than waiting for a whole answer before simulating a reveal. Both guest and authenticated endpoints preserve non-stream compatibility. The UI shows a skeleton, incremental text and the final persisted answer; account changes remount support state. Canceling ticket sign-in clears its pending handoff, while successful authentication preserves the intended handoff.

Reference-generation acceptance is documented in `maintenance/kie-reference-audit/README.md`: 22 model configurations updated, 14,182 deterministic reference/setting combinations, 165 backend tests, 36 website tests and 28 successful real generations. Browser guest support correctly treats the H3 last frame as optional. Seven invalid generation requests did not change credits; three failed provider jobs were refunded and the disposable wallet reconciled. All test-account files were cleaned up.
