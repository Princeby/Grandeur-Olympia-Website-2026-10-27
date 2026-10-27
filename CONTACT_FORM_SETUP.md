# Contact form email setup

The contact form submits to `/api/contact` on the existing `grandeur-olympia` Cloudflare Worker. It sends only to `grandeurolympiaglobal@gmail.com`, from `website@grandeurolympiaglobal.com`, with the visitor's address as Reply-To. No Gmail password, external email provider, or local package installation is needed.

The existing page layout, stylesheets, imagery, fields, and navigation are preserved. The submit button and explanatory text now describe direct sending. The newsletter subscription prompt retains its existing behavior.

## Complete Cloudflare setup before deploying

1. Sign into the Cloudflare account that owns the `grandeur-olympia` Worker and `grandeurolympiaglobal.com`.
2. Open **Compute → Email Service → Email Routing**. If the domain is not onboarded, choose **Onboard Domain → grandeurolympiaglobal.com** and apply Cloudflare's required email DNS records. Review existing mail records before making any changes; do not replace a separate domain email provider if one is in use. Email Routing to a verified destination is the free option used here.
3. Open **Email Routing → Destination Addresses**. Add `grandeurolympiaglobal@gmail.com`. Open Cloudflare's verification email in that Gmail inbox and select **Verify email address**. Confirm that the address shows verified.
4. Confirm the sending domain is active in Email Service. The sender address belongs to the onboarded domain. A verified Gmail destination alone does not replace domain onboarding/authentication.
5. Merge this change only after the domain and destination are ready. The existing GitHub integration can deploy the update. Keep the existing no-build deployment workflow; the repository now supplies `wrangler.json`, which identifies `worker/contact.mjs`, the static assets, the fixed-recipient `CONTACT_EMAIL` send binding, and `CONTACT_RATE_LIMITER`.
6. In the Worker's bindings, confirm that `CONTACT_EMAIL` targets the verified Gmail address. The configuration creates the required bindings during deployment. Keep the existing custom domain connections.
7. Open `https://grandeurolympiaglobal.com/contact` and submit a clearly labelled test enquiry. Check Gmail (including Spam) and confirm that Reply addresses the test visitor. This live inbox delivery check must be performed after Cloudflare setup; local tests simulate the email binding and do not send mail.

If delivery is rejected, the form retains the visitor's details and displays an error. A successful response is returned only after Cloudflare accepts the email. Inbox placement is controlled by the receiving mail provider.

## Validation

Run the installed Node.js test runner, without downloading packages:

```sh
node --test tests/*.test.mjs
```

The tests cover successful sending, awaiting service acceptance, a fixed recipient, Reply-To, validation, header injection, malformed/oversized requests, cross-site requests, honeypot submissions, rate limits, missing bindings, send failures, static page routing, duplicate clicks, form reset timing, and understandable browser error states.

`.assetsignore` publishes only the existing HTML, CSS, client JavaScript, robots file, and assets. Worker source, tests, setup instructions, and configuration are excluded from public static assets.

References:

- https://developers.cloudflare.com/email-service/configuration/email-routing-addresses/
- https://developers.cloudflare.com/email-service/configuration/domains/
- https://developers.cloudflare.com/email-service/configuration/send-bindings/
- https://developers.cloudflare.com/email-service/api/send-emails/workers-api/
- https://developers.cloudflare.com/email-service/platform/pricing/

## Preview deployments

Cloudflare’s configured preview command is `wrangler preview`. The `previews` block supplies its required email and rate-limit bindings. Preview submissions intentionally use the same verified company inbox, with a separate rate-limit namespace so preview testing does not consume the production limit. Send only clearly labelled test enquiries from previews.
