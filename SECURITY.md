# Security Policy

## Supported Versions

We release security updates for the following versions of Orion ECS:

| Version | Supported          |
| ------- | ------------------ |
| 0.2.x   | :white_check_mark: |
| < 0.2.0 | :x:                |

We strongly recommend always using the latest stable version to ensure you have the most recent security patches and improvements.

## Reporting a Vulnerability

The Orion ECS team takes security vulnerabilities seriously. We appreciate your efforts to responsibly disclose your findings and will make every effort to acknowledge your contributions.

### How to Report

**Please DO NOT report security vulnerabilities through public GitHub issues.**

Instead, please report security vulnerabilities through one of the following methods:

#### GitHub Security Advisories (Preferred)

1. Navigate to the [Security tab](https://github.com/tyevco/OrionECS/security) of the repository
2. Click "Report a vulnerability"
3. Fill out the security advisory form with as much detail as possible

#### Email

If you prefer email or are unable to use GitHub Security Advisories, you can report vulnerabilities via email to the project maintainers. Please check the repository for the current maintainer contact information.

### What to Include

Please include the following information in your report:

- **Type of vulnerability** (e.g., buffer overflow, injection, authentication bypass)
- **Full paths of source file(s)** related to the manifestation of the vulnerability
- **Location of affected source code** (tag/branch/commit or direct URL)
- **Any special configuration** required to reproduce the issue
- **Step-by-step instructions** to reproduce the vulnerability
- **Proof-of-concept or exploit code** (if possible)
- **Impact of the vulnerability**, including how an attacker might exploit it
- **Affected versions** of Orion ECS
- **Any potential mitigations** you've identified

### Response Timeline

We are committed to responding to security reports promptly:

- **Initial Response**: Within 48 hours of receiving your report, we will acknowledge receipt
- **Status Update**: Within 7 days, we will provide an initial assessment and expected timeline
- **Resolution**: We aim to release a fix within 30 days for critical vulnerabilities, 90 days for others
- **Disclosure**: We will work with you to determine an appropriate disclosure timeline

### What to Expect

1. **Acknowledgment**: We'll confirm receipt of your vulnerability report
2. **Assessment**: We'll validate the vulnerability and assess its impact
3. **Fix Development**: We'll develop and test a fix
4. **Coordinated Disclosure**: We'll work with you on disclosure timing
5. **Release**: We'll release the security update with proper attribution (if desired)
6. **Announcement**: We'll publish a security advisory detailing the vulnerability

## Security Update Process

When a security vulnerability is confirmed:

1. **Patch Development**: A fix is developed in a private repository
2. **Testing**: The fix is thoroughly tested to ensure it resolves the issue
3. **Advisory Creation**: A security advisory is created with details about the vulnerability
4. **Release**: A new version is released with the security fix
5. **Notification**: Users are notified through:
   - GitHub Security Advisories
   - Release notes
   - npm package update
   - Project README updates

## Security Best Practices

When using Orion ECS in your projects, we recommend:

### Input Validation

- Validate all component data before adding to entities
- Use component validators to enforce data constraints
- Sanitize any external data before processing

```typescript
engine.registerComponentValidator(Position, {
    validate: (component) => {
        if (!Number.isFinite(component.x) || !Number.isFinite(component.y)) {
            return 'Position coordinates must be finite numbers';
        }
        return true;
    }
});
```

### Safe Serialization

- Validate serialized data before deserializing
- Only deserialize trusted data sources
- Implement version checking for saved states

```typescript
// Validate before deserializing
const worldData = engine.serialize();
if (isValidWorldData(worldData)) {
    engine.deserialize(worldData);
}
```

### Plugin Security

- Only use plugins from trusted sources
- Review plugin code before installation
- Be cautious with plugins that extend the engine API
- Uninstall unused plugins

```typescript
// Verify plugin before installation
const plugin = new ThirdPartyPlugin();
console.log(`Installing: ${plugin.name} v${plugin.version}`);
engine.installPlugin(plugin);
```

### Resource Limits

- Set appropriate limits for entity creation
- Monitor memory usage in production
- Implement safeguards against resource exhaustion

```typescript
// Example: Limit entity creation
const MAX_ENTITIES = 10000;
if (engine.getAllEntities().length < MAX_ENTITIES) {
    engine.createEntity();
}
```

### Debug Mode in Production

- **IMPORTANT**: Disable debug mode in production environments
- Debug mode includes additional error information that may expose internal details

```typescript
// Development
const devEngine = new EngineBuilder()
    .withDebugMode(true)
    .build();

// Production
const prodEngine = new EngineBuilder()
    .withDebugMode(false)
    .build();
```

## Known Security Considerations

### Component Data Integrity

Orion ECS does not encrypt component data. If your application handles sensitive information:

- Implement your own encryption layer for sensitive components
- Use secure storage mechanisms for persisted data
- Clear sensitive data from memory when no longer needed

### Plugin Sandbox Limitations

Plugins have access to the engine through the `PluginContext`. While this provides controlled access:

- Plugins can still execute arbitrary code
- Review plugin source code before installation
- Use plugins only from trusted sources

### Serialization Format

The serialization format is JSON-based and not cryptographically signed:

- Don't deserialize untrusted data
- Implement signature verification if needed for your use case
- Validate schema before deserialization

## Security Champions

We recognize and appreciate security researchers who help improve Orion ECS. Security contributors may be:

- Listed in release notes (with permission)
- Credited in security advisories
- Acknowledged in the repository

## Scope

This security policy applies to:

- The core Orion ECS engine (`core/`)
- Official plugins in the `plugins/` directory
- Examples in the `examples/` directory

Third-party plugins and integrations have their own security policies.

## Questions

If you have questions about this security policy, please:

- Open a GitHub Discussion for general security questions
- Use GitHub Security Advisories for vulnerability-related questions
- Check existing security advisories for similar issues

Thank you for helping keep Orion ECS and its users safe!
