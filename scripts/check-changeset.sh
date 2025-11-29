#!/bin/bash

# Check if changeset is required based on changed files
# This script determines if the changes require a changeset and validates
# that the changeset includes the correct packages that were modified.
#
# Usage:
#   ./scripts/check-changeset.sh [base_ref]
#
# Arguments:
#   base_ref - The base branch to compare against (default: origin/main)
#
# Exit codes:
#   0 - No changeset required OR valid changeset is present
#   1 - Changeset required but missing, or changeset doesn't include modified packages

set -e

BASE_REF="${1:-origin/main}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Patterns that require a changeset (code and config files)
REQUIRE_CHANGESET_PATTERNS=(
    "^packages/[^/]+/src/.*\.ts$"
    "^plugins/[^/]+/src/.*\.ts$"
    "^packages/[^/]+/package\.json$"
    "^plugins/[^/]+/package\.json$"
    "^packages/[^/]+/tsconfig.*\.json$"
    "^plugins/[^/]+/tsconfig.*\.json$"
    "^packages/[^/]+/tsup\.config\.ts$"
    "^plugins/[^/]+/tsup\.config\.ts$"
)

# Patterns that are explicitly excluded from requiring changesets
EXCLUDE_PATTERNS=(
    "\.test\.ts$"
    "\.spec\.ts$"
    "__tests__/"
    "^docs/"
    "^examples/"
    "^tutorials/"
    "^benchmarks/"
    "^scripts/"
    "^\.github/"
    "\.md$"
    "^\.changeset/"
    "^\.performance/"
)

# Check if a file matches any of the require patterns
matches_require_pattern() {
    local file="$1"
    for pattern in "${REQUIRE_CHANGESET_PATTERNS[@]}"; do
        if echo "$file" | grep -qE "$pattern"; then
            return 0
        fi
    done
    return 1
}

# Check if a file matches any of the exclude patterns
matches_exclude_pattern() {
    local file="$1"
    for pattern in "${EXCLUDE_PATTERNS[@]}"; do
        if echo "$file" | grep -qE "$pattern"; then
            return 0
        fi
    done
    return 1
}

# Extract package directory from a file path (e.g., "packages/core/src/foo.ts" -> "packages/core")
get_package_dir() {
    local file="$1"
    if echo "$file" | grep -qE "^packages/[^/]+/"; then
        echo "$file" | sed -E 's|^(packages/[^/]+)/.*|\1|'
    elif echo "$file" | grep -qE "^plugins/[^/]+/"; then
        echo "$file" | sed -E 's|^(plugins/[^/]+)/.*|\1|'
    fi
}

# Get npm package name from a package directory
get_package_name() {
    local pkg_dir="$1"
    local pkg_json="$pkg_dir/package.json"
    if [ -f "$pkg_json" ]; then
        # Use node for reliable JSON parsing, fallback to grep
        if command -v node >/dev/null 2>&1; then
            node -e "console.log(require('./$pkg_json').name)" 2>/dev/null || \
            grep -o '"name"[[:space:]]*:[[:space:]]*"[^"]*"' "$pkg_json" | head -1 | sed 's/.*"\([^"]*\)"$/\1/'
        else
            grep -o '"name"[[:space:]]*:[[:space:]]*"[^"]*"' "$pkg_json" | head -1 | sed 's/.*"\([^"]*\)"$/\1/'
        fi
    fi
}

# Extract packages referenced in a changeset file
get_changeset_packages() {
    local changeset_file="$1"
    # Parse YAML frontmatter - lines between --- that contain package names
    # Format: "@orion-ecs/core": minor
    awk '/^---$/{if(++n==2)exit}n==1{print}' "$changeset_file" | \
        grep -oE '"[^"]+"|'\''[^'\'']+'\''' | \
        tr -d '"' | tr -d "'"
}

# Get list of changed files
echo "Checking for changeset requirement..."
echo "Comparing against: $BASE_REF"
echo ""

# Fetch the base ref if it doesn't exist locally
if ! git rev-parse --verify "$BASE_REF" >/dev/null 2>&1; then
    echo "Fetching $BASE_REF..."
    git fetch origin main:refs/remotes/origin/main 2>/dev/null || true
fi

# Get changed files
CHANGED_FILES=$(git diff --name-only "$BASE_REF" 2>/dev/null || git diff --name-only HEAD~1 2>/dev/null || echo "")

if [ -z "$CHANGED_FILES" ]; then
    echo -e "${GREEN}✓ No changed files detected${NC}"
    exit 0
fi

# Find changeset files that were added/modified
CHANGESET_FILES=()
while IFS= read -r file; do
    if echo "$file" | grep -qE "^\.changeset/.*\.md$" && [ "$file" != ".changeset/README.md" ]; then
        CHANGESET_FILES+=("$file")
    fi
done <<< "$CHANGED_FILES"

# Find files that require a changeset and track which packages they belong to
REQUIRES_CHANGESET=()
declare -A MODIFIED_PACKAGES

while IFS= read -r file; do
    [ -z "$file" ] && continue

    # Skip if it matches exclude patterns
    if matches_exclude_pattern "$file"; then
        continue
    fi

    # Check if it matches require patterns
    if matches_require_pattern "$file"; then
        REQUIRES_CHANGESET+=("$file")

        # Track which package this file belongs to
        pkg_dir=$(get_package_dir "$file")
        if [ -n "$pkg_dir" ]; then
            pkg_name=$(get_package_name "$pkg_dir")
            if [ -n "$pkg_name" ]; then
                MODIFIED_PACKAGES["$pkg_name"]="$pkg_dir"
            fi
        fi
    fi
done <<< "$CHANGED_FILES"

# Report results
if [ ${#REQUIRES_CHANGESET[@]} -eq 0 ]; then
    echo -e "${GREEN}✓ No changeset required${NC}"
    echo "  Changed files do not include publishable code changes."
    exit 0
fi

echo "Files that require a changeset:"
for file in "${REQUIRES_CHANGESET[@]}"; do
    echo "  - $file"
done
echo ""

echo "Modified packages:"
for pkg_name in "${!MODIFIED_PACKAGES[@]}"; do
    echo "  - $pkg_name (${MODIFIED_PACKAGES[$pkg_name]})"
done
echo ""

# Check if any changeset files were added
if [ ${#CHANGESET_FILES[@]} -eq 0 ]; then
    echo -e "${RED}✗ Changeset required but not found${NC}"
    echo ""
    echo -e "${YELLOW}This PR includes changes to publishable packages.${NC}"
    echo "Please add a changeset describing your changes:"
    echo ""
    echo "  npx changeset"
    echo ""
    echo "Make sure to select the following package(s):"
    for pkg_name in "${!MODIFIED_PACKAGES[@]}"; do
        echo "  - $pkg_name"
    done
    echo ""
    echo "If these changes should NOT be published (internal refactoring with no"
    echo "user-facing changes), you can create an empty changeset:"
    echo ""
    echo "  npx changeset add --empty"
    echo ""
    echo "For more information, see RELEASE.md"
    exit 1
fi

# Validate that changesets include the modified packages
echo "Checking changeset coverage..."
PACKAGES_IN_CHANGESETS=()

for changeset_file in "${CHANGESET_FILES[@]}"; do
    if [ -f "$changeset_file" ]; then
        echo "  Found: $changeset_file"
        while IFS= read -r pkg; do
            [ -n "$pkg" ] && PACKAGES_IN_CHANGESETS+=("$pkg")
        done < <(get_changeset_packages "$changeset_file")
    fi
done
echo ""

# Check if all modified packages are covered by changesets
MISSING_PACKAGES=()
for pkg_name in "${!MODIFIED_PACKAGES[@]}"; do
    found=false
    for cs_pkg in "${PACKAGES_IN_CHANGESETS[@]}"; do
        if [ "$pkg_name" = "$cs_pkg" ]; then
            found=true
            break
        fi
    done
    if [ "$found" = false ]; then
        MISSING_PACKAGES+=("$pkg_name")
    fi
done

if [ ${#MISSING_PACKAGES[@]} -gt 0 ]; then
    echo -e "${RED}✗ Changeset does not include all modified packages${NC}"
    echo ""
    echo "The following packages were modified but not included in any changeset:"
    for pkg in "${MISSING_PACKAGES[@]}"; do
        echo "  - $pkg"
    done
    echo ""
    echo "Packages found in changesets:"
    if [ ${#PACKAGES_IN_CHANGESETS[@]} -eq 0 ]; then
        echo "  (none - changeset may be empty or malformed)"
    else
        for pkg in "${PACKAGES_IN_CHANGESETS[@]}"; do
            echo "  - $pkg"
        done
    fi
    echo ""
    echo -e "${YELLOW}Please update your changeset to include all modified packages:${NC}"
    echo ""
    echo "  npx changeset"
    echo ""
    echo "Or if using an empty changeset is intentional, ensure it's valid."
    exit 1
fi

echo -e "${GREEN}✓ Changeset found and includes all modified packages${NC}"
exit 0
