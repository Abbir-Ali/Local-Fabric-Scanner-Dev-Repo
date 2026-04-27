# Kiro Setup Guide — Shopify Full-Stack Development

**Last Updated:** April 27, 2026
**Status:** ✅ Fully Configured

---

## Overview

Your Kiro IDE is now fully optimized for Shopify development across themes, Remix apps, Hydrogen storefronts, GraphQL APIs, Liquid templates, and app extensions. This setup provides automatic code quality checks, intelligent context for AI assistance, and one-command project initialization.

---

## What's Installed

### 1. Global Steering Rules

**Location:** `~/.kiro/steering/shopify-global.md`

**What it does:**
Automatically loads Shopify-specific development rules into every Kiro session, regardless of which project you open. This gives Kiro deep context about:

- Shopify CLI commands and workflows
- Admin GraphQL API and Storefront API patterns
- Liquid syntax and schema requirements
- Remix app structure with TypeScript and Prisma
- Hydrogen/React Router patterns
- Metafields, metaobjects, webhooks, and app extensions
- Security best practices (env vars, API scopes, secret handling)

**Benefit:**
Kiro understands Shopify conventions automatically. When you ask it to "add a new product metafield" or "fix this Liquid schema," it knows exactly what you mean and follows Shopify best practices without you having to explain the context every time.

---

### 2. MCP Servers (Model Context Protocol)

**Location:** `~/.kiro/settings/mcp.json`

MCP servers extend Kiro's capabilities by connecting it to external tools and APIs.

#### Active Servers

| Server | Purpose | Status |
|--------|---------|--------|
| **fetch** | Fetch web pages and documentation | ✅ Enabled |
| **filesystem** | Read/search files in your workspace | ✅ Enabled |
| **shopify-dev-mcp** | Official Shopify Dev MCP — search docs, introspect Admin GraphQL schema, scaffold Functions, access Polaris component docs | ✅ Enabled |

#### Available (Disabled by Default)

| Server | Purpose | How to Enable |
|--------|---------|---------------|
| **shopify-store-mcp** | Live store data access — query products, orders, customers via GraphQL | Add your Shopify Admin API token and store domain to `mcp.json`, set `"disabled": false` |
| **github** | GitHub API access | Add your GitHub personal access token to `mcp.json`, set `"disabled": false` |

**Benefit:**
- **shopify-dev-mcp** lets Kiro search Shopify's official docs, validate GraphQL queries against the live Admin API schema, and scaffold Shopify Functions without leaving the IDE.
- **shopify-store-mcp** (when enabled) lets Kiro read and modify your actual store data — useful for debugging live issues or building admin tools.
- **fetch** and **filesystem** give Kiro the ability to read external docs and search your codebase efficiently.

---

### 3. Workspace Hooks (7 Active)

**Location:** `.kiro/hooks/` (per-project)

Hooks are automated actions that trigger when specific events happen in the IDE. They catch errors early and enforce quality standards automatically.

#### Hook 1: **Shopify Secret Guard**
- **Triggers on:** `.env`, `shopify.app.toml`, `shopify.web.toml` file edits
- **Action:** Scans for hardcoded secrets (API keys, tokens, passwords)
- **Benefit:** Prevents accidental credential leaks before they reach git

#### Hook 2: **Shopify Liquid Schema Validator**
- **Triggers on:** `.liquid` file saves
- **Action:** Checks for missing `{% schema %}`, invalid JSON, duplicate IDs, missing presets
- **Benefit:** Catches broken Liquid schemas immediately — no more "section won't load in theme editor" surprises

#### Hook 3: **Shopify App TypeCheck**
- **Triggers on:** `.ts`, `.tsx` file saves
- **Action:** Runs `tsc --noEmit` to check for TypeScript errors
- **Benefit:** Catches type errors as you code, before runtime or build failures

#### Hook 4: **Shopify Format on Save**
- **Triggers on:** `.liquid`, `.js`, `.ts`, `.tsx`, `.jsx`, `.css`, `.json` file saves
- **Action:** Runs Prettier to auto-format code
- **Benefit:** Consistent code style across the team with zero manual effort

#### Hook 5: **Shopify GraphQL Reviewer**
- **Triggers on:** `.graphql`, `.gql` file saves
- **Action:** Checks for `userErrors` on mutations, `pageInfo` on paginated queries, correct API usage
- **Benefit:** Ensures GraphQL queries follow Shopify best practices and won't fail silently

#### Hook 6: **Prisma Migration Reminder**
- **Triggers on:** `prisma/schema.prisma` edits
- **Action:** Reminds you to run migrations, warns about destructive changes
- **Benefit:** Never forget to migrate after schema changes — prevents production database drift

#### Hook 7: **Shopify Post-Task Lint**
- **Triggers on:** Spec task completion
- **Action:** Runs ESLint on the `app/` folder
- **Benefit:** Catches lint errors introduced during feature implementation before they accumulate

**Overall Benefit:**
Hooks act as a safety net. They catch common mistakes (broken schemas, missing migrations, hardcoded secrets, type errors) the moment they happen, not hours later during deployment or code review.

---

### 4. VS Code Settings

**Location:** `.vscode/settings.json` (per-project)

Configured for Shopify development:

```json
{
  "editor.formatOnSave": true,
  "editor.tabSize": 2,
  "files.trimTrailingWhitespace": true,
  "files.insertFinalNewline": true,
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "[liquid]": { "editor.defaultFormatter": "Shopify.theme-check-vscode" }
}
```

**Benefit:**
Consistent formatting, proper Liquid support, and TypeScript import preferences aligned with Shopify app conventions.

---

### 5. One-Command Project Setup

**Location:** `C:\Users\abbir\scripts\setup-kiro.cjs` (global)

A script that installs all hooks, steering, and VS Code settings into any project with one command:

```bash
setup-kiro
```

**What it does:**
1. Creates `.kiro/hooks/` and installs all 7 hooks
2. Creates `.kiro/steering/` and installs workspace steering rules
3. Creates `.vscode/settings.json` with Shopify-optimized settings
4. Skips any files that already exist (safe to run multiple times)

**Benefit:**
New Shopify projects get the full Kiro setup in 3 seconds. No manual copying, no forgetting to add hooks, no inconsistency across projects.

**Usage:**
- Open a terminal in any Shopify project root
- Run `setup-kiro`
- Reload Kiro (`Ctrl+Shift+P` → `Developer: Reload Window`)
- Done

---

## How This Benefits You

### 1. **Faster Development**
- Kiro understands Shopify context automatically — no need to explain "what's a Liquid schema" or "how do I query the Admin API"
- MCP servers give Kiro live access to Shopify docs and API schemas
- Hooks catch errors immediately, not during deployment

### 2. **Fewer Bugs**
- Liquid schema validator catches broken JSON before you push
- TypeCheck catches type errors before runtime
- Secret guard prevents credential leaks
- GraphQL reviewer ensures queries follow Shopify patterns
- Prisma reminder prevents forgotten migrations

### 3. **Consistent Quality**
- Auto-formatting on save keeps code clean
- Hooks enforce standards across the team
- Steering rules ensure Kiro follows Shopify best practices in every response

### 4. **Easier Onboarding**
- New projects get the full setup with `setup-kiro`
- New team members get the same Kiro experience automatically
- No "works on my machine" issues with formatting or linting

### 5. **Better AI Assistance**
- Kiro knows Shopify CLI commands, API patterns, and common workflows
- It can search official Shopify docs via MCP
- It validates GraphQL queries against the live Admin API schema
- It understands Liquid, Remix, Hydrogen, and Shopify Functions

---

## Quick Reference

### Global Files (Apply to All Projects)
- `~/.kiro/steering/shopify-global.md` — Shopify development rules
- `~/.kiro/settings/mcp.json` — MCP server configuration
- `C:\Users\abbir\scripts\setup-kiro.cjs` — Project setup script

### Per-Project Files (Created by `setup-kiro`)
- `.kiro/hooks/*.kiro.hook` — 7 automated quality checks
- `.kiro/steering/shopify-fullstack.md` — Workspace-specific rules
- `.vscode/settings.json` — Editor configuration

### Commands
- `setup-kiro` — Install Kiro setup in current project
- `shopify theme dev` — Start theme development server
- `shopify app dev` — Start Remix app development server
- `npx tsc --noEmit` — Check TypeScript errors
- `npx prettier --write .` — Format all files
- `npx eslint app/` — Lint app code

---

## Maintenance

### Updating MCP Servers
MCP servers auto-update when you reload Kiro. To force an update:
1. Open `~/.kiro/settings/mcp.json`
2. Change `@shopify/dev-mcp@latest` to `@shopify/dev-mcp@<version>` (or keep `@latest`)
3. Reload Kiro

### Updating Hooks
Edit hook files in `.kiro/hooks/*.kiro.hook` directly. Changes take effect after reloading Kiro.

### Updating Steering Rules
Edit `~/.kiro/steering/shopify-global.md` or `.kiro/steering/shopify-fullstack.md`. Changes take effect immediately in new Kiro sessions.

### Updating the Setup Script
Edit `C:\Users\abbir\scripts\setup-kiro.cjs` to change what gets installed in new projects.

---

## Troubleshooting

### `setup-kiro` command not found
- Close and reopen your terminal (PATH update needs a fresh session)
- Or run directly: `node C:\Users\abbir\scripts\setup-kiro.cjs`

### MCP server won't connect
- Check `~/.kiro/settings/mcp.json` for typos
- Ensure `uvx` and `npx` are installed (`uvx --version`, `npx --version`)
- Reload Kiro (`Ctrl+Shift+P` → `Developer: Reload Window`)

### Hooks not triggering
- Check `.kiro/hooks/*.kiro.hook` files exist
- Ensure `"enabled": true` in each hook file
- Reload Kiro

### Kiro doesn't follow Shopify rules
- Check `~/.kiro/steering/shopify-global.md` exists
- Steering files load automatically — no activation needed
- Try asking Kiro: "What Shopify development rules are you following?"

---

## Next Steps

1. **Enable live store access** (optional):
   - Create a custom app in your Shopify admin
   - Add API scopes: `read_products`, `write_products`, `read_customers`, `write_customers`, `read_orders`, `write_orders`
   - Copy the Admin API access token
   - Edit `~/.kiro/settings/mcp.json`:
     - Replace `YOUR_SHOPIFY_ACCESS_TOKEN` with your token
     - Replace `YOUR_STORE.myshopify.com` with your store domain
     - Set `"disabled": false` for `shopify-store-mcp`
   - Reload Kiro

2. **Set up GitHub MCP** (optional):
   - Create a GitHub personal access token
   - Edit `~/.kiro/settings/mcp.json`:
     - Add your token to `GITHUB_PERSONAL_ACCESS_TOKEN`
     - Set `"disabled": false` for `github`
   - Reload Kiro

3. **Run `setup-kiro` in other projects**:
   - Open a terminal in each Shopify project
   - Run `setup-kiro`
   - Reload Kiro

---

## Summary

You now have a production-grade Kiro setup for Shopify development:

✅ Global Shopify context in every session
✅ Live access to Shopify docs and API schemas
✅ 7 automated quality checks catching errors early
✅ Consistent formatting and linting
✅ One-command setup for new projects
✅ Better AI assistance with deep Shopify knowledge

This setup saves hours per week by catching bugs early, automating repetitive tasks, and giving Kiro the context it needs to be a true development partner.
