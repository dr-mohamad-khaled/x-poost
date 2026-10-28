@AGENTS.md

# XPoost Development and Deployment

Always run commands in `c:\Users\phmoh\convboost\x-poost`.

## Deployment Commands

### 1. Build Verification
```powershell
npm run typecheck
npm run build
```

### 2. Shopify Extensions and Functions Release
Set environment variables to prevent CLI analytics timeouts and allocate memory:
```powershell
$env:SHOPIFY_CLI_NO_ANALYTICS = "1"
$env:NODE_OPTIONS = "--max-old-space-size=4096"
npx -y @shopify/cli@4.9.4 app deploy --config=xpoost --allow-updates --message "Deploy latest updates"
```

### 3. Git Push
```powershell
git add .
git commit -m "Deploy: <description of changes>"
git push origin main
```

## Critical Rules
- Strictly ZERO emojis across all code, commits, and comments.
- Never delete or modify `extensions/xpoost-thank-you` (active Thank-You page checkout offer extension).
- Working directory is `c:\Users\phmoh\convboost\x-poost`.

