# Release Process

This document describes the automated release process for OrionECS packages using Changesets.

## Overview

OrionECS uses [Changesets](https://github.com/changesets/changesets) to manage versioning and publishing of packages in this monorepo. This allows for:

- **Independent versioning** - Each package can be versioned independently
- **Automated changelogs** - Generated from changeset descriptions
- **Automated GitHub releases** - Created when packages are published
- **Safe publishing** - Dry-run validation before actual publishing

## Packages

The following packages can be published to npm:

- **Core Package**: `orion-ecs` - The main ECS framework
- **Utils Package**: `@orion-ecs/utils` - Shared utilities (Vector2, Bounds, etc.)
- **Plugin Packages**:
  - `@orion-ecs/canvas2d-renderer` - Canvas2D rendering
  - `@orion-ecs/input-manager` - Input handling
  - `@orion-ecs/interaction-system` - Interaction system
  - `@orion-ecs/physics` - Physics simulation
  - `@orion-ecs/spatial-partition` - Spatial partitioning
  - `@orion-ecs/debug-visualizer` - Debug visualization
  - `@orion-ecs/profiling` - Performance profiling
  - `@orion-ecs/resource-manager` - Resource management

## Authentication

OrionECS uses **npm Trusted Publishers** with OpenID Connect (OIDC) for secure, automated publishing. This eliminates the need for long-lived npm tokens.

### Setting Up Trusted Publishers

For each package you want to publish, configure it as a trusted publisher on npmjs.com:

1. **Go to package settings** on [npmjs.com](https://www.npmjs.com)
2. Navigate to **"Publishing access"** tab
3. Click **"Add trusted publisher"**
4. Select **"GitHub Actions"** as the provider
5. Configure the publisher:
   - **Repository**: `tyevco/OrionECS`
   - **Workflow**: `release.yml` (for automated releases)
   - **Environment**: (leave empty)

6. **For manual publishing**, also add:
   - **Repository**: `tyevco/OrionECS`
   - **Workflow**: `publish.yml`
   - **Environment**: (leave empty)

### How It Works

- GitHub Actions generates a short-lived OIDC token during workflow execution
- npm validates the token against your trusted publisher configuration
- Authentication happens automatically - no secrets needed
- Provenance information is automatically attached to published packages

### Benefits

✅ **No long-lived secrets** - tokens expire after the workflow completes
✅ **Automatic provenance** - npm knows exactly which workflow published each version
✅ **Better security** - reduced attack surface
✅ **Audit trail** - clear link between GitHub workflow and npm package

## Release Workflow

### 1. Making Changes

When you make changes that should be released:

1. Create a branch for your changes
2. Make your code changes
3. Add a changeset to describe your changes:

```bash
npm run changeset:add
```

This will prompt you to:
- Select which packages are affected
- Choose the type of version bump (patch, minor, major)
- Provide a description of the changes

**Version Bump Guidelines:**
- **Patch** (0.0.x): Bug fixes, documentation updates
- **Minor** (0.x.0): New features, backwards-compatible changes
- **Major** (x.0.0): Breaking changes

4. Commit the changeset file along with your changes:

```bash
git add .changeset/*.md
git commit -m "feat: your feature description"
```

5. Create a pull request

### 2. PR Validation

When you create a PR, the **PR Validation** workflow will automatically:

- Run type checking
- Run linters
- Check code formatting
- Build all packages
- Run all tests
- Verify build artifacts
- Check for changesets (if needed)

The PR can only be merged if all checks pass.

### 3. Version PR (Automated)

When changes with changesets are merged to `main`, the **Release** workflow will:

1. Automatically create a "Version Packages" PR
2. This PR will:
   - Update package versions based on changesets
   - Generate/update CHANGELOG.md files
   - Remove the changeset files

### 4. Publishing (Automated)

When the "Version Packages" PR is merged to `main`:

1. The **Release** workflow will automatically:
   - Build all packages
   - Run all tests
   - Publish changed packages to npm
   - Create GitHub releases with changelogs

**Note:** Publishing uses npm Trusted Publishers with OIDC authentication. Each package must be configured as a trusted publisher on npmjs.com with the repository `tyevco/OrionECS` and workflow `release.yml`.

## Manual Operations

### Checking Changeset Status

To see which packages have pending changesets:

```bash
npm run changeset:status
```

### Dry Run Publishing

To test the publishing process without actually publishing:

```bash
npm run release:dry-run
```

This will:
- Build all packages
- Run all tests
- Simulate publishing to npm (no actual publish)

### Manual Publishing

If you need to manually publish a specific package (emergency releases, etc.):

1. Go to **Actions** → **Manual Publish** in GitHub
2. Select the package to publish
3. Choose whether to do a dry run (recommended first)
4. Click "Run workflow"

The workflow will:
- Build and test everything
- Publish the selected package
- Provide a summary of what was published

### Validating Packages

To run all validation checks locally:

```bash
# Validate all packages (typecheck, lint, test, build)
npm run validate:packages

# Validate packages and simulate publishing
npm run validate:publish
```

## Changeset Configuration

Changesets are configured in `.changeset/config.json`:

- **changelog**: Uses GitHub changelog generator
- **access**: "public" (packages are published as public)
- **baseBranch**: "main"
- **ignore**: ["orion-ecs-monorepo", "examples"] (not published)

## NPM Configuration

All packages have `publishConfig.access: "public"` in their `package.json` to ensure they're published as public packages on npm.

## Peer Dependencies

Plugins use peer dependencies to avoid version conflicts:

- All plugins depend on `orion-ecs: "*"` as a peer dependency
- Plugins that need utilities depend on `@orion-ecs/utils: "*"`
- Some plugins depend on other plugins (e.g., `interaction-system` depends on `input-manager`)

**Note:** Users need to install peer dependencies manually:

```bash
npm install orion-ecs @orion-ecs/physics
```

## Workflow Files

The release process uses these GitHub Actions workflows:

- **`.github/workflows/release.yml`** - Automated versioning and publishing
- **`.github/workflows/pr-validation.yml`** - PR validation checks
- **`.github/workflows/publish.yml`** - Manual publishing workflow

## Best Practices

1. **Always add changesets** for changes that affect published packages
2. **Use semantic versioning** correctly (patch/minor/major)
3. **Write clear changeset descriptions** - they become changelog entries
4. **Test locally** before pushing (run `npm run validate:packages`)
5. **Review the Version PR** before merging to ensure correct versions
6. **Monitor the Release workflow** after merging to ensure successful publishing

## Troubleshooting

### Changeset not created

If the PR validation warns about missing changesets but your changes don't need a release:
- This is fine for docs, tests, or internal changes
- Add a comment explaining why no changeset is needed

### Build failures

If the release workflow fails during build:
1. Check the workflow logs for errors
2. Run `npm run build` locally to reproduce
3. Fix the build errors and push changes
4. The workflow will re-run automatically

### Publish failures

If publishing fails:
1. Verify the package is configured as a trusted publisher on npmjs.com:
   - Repository: `tyevco/OrionECS`
   - Workflow: `release.yml` (or `publish.yml` for manual publishes)
   - Environment: (leave empty)
2. Check if the version already exists on npm
3. Verify the workflow has `id-token: write` permission
4. Use the Manual Publish workflow with dry-run to test authentication

### Version conflicts

If you see version conflicts in the Version PR:
1. Check for merged PRs with changesets that weren't included
2. Manually edit version in package.json if needed
3. Commit and push to the Version PR branch

## Resources

- [Changesets Documentation](https://github.com/changesets/changesets)
- [Semantic Versioning](https://semver.org/)
- [npm Publishing Guide](https://docs.npmjs.com/packages-and-modules/contributing-packages-to-the-registry)
