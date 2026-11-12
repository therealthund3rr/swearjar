# Security policy

## Reporting a vulnerability

Please report security problems **privately**, not in a public issue: open the repository's **Security** tab and choose **Report a vulnerability**.

Include what you found, how to reproduce it and what you think the impact is. Do not include real credentials or recordings of people. This is a one-person project, so a response may take a few days; reports about payments are treated first.

## What is in scope

- **Payments:** any way to charge a player more than the hold they approved, to capture twice, to capture or void another player's authorization, or to move money without the session ending.
- **Secrets:** any way the PayPal client secret, access tokens or the AI API key reach the browser or the logs.
- **Privacy:** any path where audio is stored or sent by the app, or where sentences without a fine are kept.
- **Session access:** joining, controlling or ending a jar you were not given the code for.

## Out of scope

- The app runs only against the PayPal **sandbox**; no real money is involved.
- Accuracy of speech recognition or of the AI judge (open a normal issue).
- Problems in PayPal, the AI provider (Groq or LM Studio), Render or the browser's speech service themselves; report those to the vendor.

## Supported versions

Only the latest code on the default branch is supported.
