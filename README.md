# Agent Manager for relay-plugin

A powerful VS Code extension that provides a graphical interface for managing relay-plugin agents, teams, and configurations.

## Features

### 🎯 Dashboard
- Real-time statistics for Experts, Teams, and Agents
- Mermaid diagram visualization for team structures
- Quick access to common actions
- VS Code theme integration

### 👥 Expert Management
- Create, edit, and delete AI experts
- 9 preset templates for common expert types
- Dynamic capability and constraint lists
- Automatic slug generation and validation
- Duplicate experts for quick iteration

### 🏗️ Team Building
- Visual team builder interface
- Drag-and-drop member assignment
- Team structure validation
- Upper and Lower team support
- Coordinator and decision mode configuration

### 📊 Visualization
- Mermaid diagram generation for:
  - Team hierarchies
  - Expert capabilities
  - Agent relationships
- Export diagrams as SVG

### 🌳 Sidebar Tree View
- Organized Experts and Teams
- Context menus for quick actions
- Click to edit, right-click for more options
- Real-time refresh

## Installation

### From VS Code Marketplace
1. Open VS Code
2. Press `Ctrl+Shift+X` (or `Cmd+Shift+X` on Mac)
3. Search for "Agent Manager"
4. Click Install

### From Source
1. Clone this repository
2. Run `npm install`
3. Run `npm run compile`
4. Press `F5` in VS Code to launch the Extension Development Host

## Usage

### Quick Start

1. **Open Dashboard**: Press `Ctrl+Shift+A` (or `Cmd+Shift+A`)
2. **Create Expert**: Click "Create Expert" and choose a template
3. **Build Team**: Click "Build Team" to configure team members
4. **View Diagrams**: Right-click on teams or experts to view diagrams

### Commands

| Command | Keyboard | Description |
|----------|----------|-------------|
| `agentManager.openDashboard` | `Ctrl+Shift+A` | Open Dashboard |
| `agentManager.createExpert` | - | Create new Expert |
| `agentManager.buildTeam` | - | Build new Team |
| `agentManager.editAgent` | - | Edit Expert definition |
| `agentManager.openSettings` | - | Open Settings |

### Expert Templates

| Template | Category | Description |
|----------|----------|-------------|
| Frontend Developer | Development | React, Vue, Next.js expert |
| Backend Developer | Development | API, Database, Server-side |
| Fullstack Developer | Development | End-to-end web development |
| DevOps Engineer | Development | CI/CD, Infrastructure |
| Security Auditor | Development | Security review, OWASP |
| UX Designer | Development | User experience, interface design |
| Product Manager | General | Product strategy, requirements |
| Technical Writer | General | Documentation, technical communication |
| Custom | Custom | Create from scratch |

## File Structure

```
.claude/relay/
├── experts/           # Expert definitions (.md)
├── teams/              # Team configurations (.json)
└── domain-config.json  # Domain settings
```

### Expert File Format

```yaml
---
role: Frontend Developer
slug: frontend-developer
domain: development
backed_by: claude
tier: premium
permission_mode: default
phases:
  - tangle
  - ink
capabilities:
  - React 19+ component architecture
  - Next.js 15 App Router
  - TypeScript 5+ type safety
constraints:
  - Always use TypeScript for type safety
  - Follow React best practices
created_at: 2026-01-01
```

### Team File Format

```json
{
  "id": "team-1",
  "name": "Product Development Team",
  "slug": "product-dev",
  "type": "lower",
  "execution_mode": "teammate",
  "coordinator": "claude",
  "coordinator_model": "claude-opus-4-6",
  "purpose": "Implements product features",
  "decision_mode": "leader_decides",
  "members": [
    {
      "role": "Team Lead",
      "expert_slug": "team-lead",
      "tier": "premium",
      "permission_mode": "default",
      "is_leader": true,
      "is_bridge": false
    }
  ],
  "phase_routing": {},
  "created_at": "2026-01-01"
}
```

## Development

### Setup
```bash
npm install
```

### Compile
```bash
npm run compile
```

### Watch Mode
```bash
npm run watch
```

### Run Tests
```bash
npm test
```

### Lint
```bash
npm run lint
```

### Build Package
```bash
npm run package
```

## Testing

### Unit Tests
```bash
npm run test:unit
```

### E2E Tests
```bash
npm run test:e2e
```

### Coverage
```bash
npm run test:coverage
```

## CI/CD

This extension uses GitHub Actions for CI/CD:

- **Lint**: ESLint checks on every push
- **Build**: Webpack compilation verification
- **Unit Tests**: Mocha test suite
- **E2E Tests**: VS Code extension host testing
- **Security**: Dependency audit and Snyk scan
- **Release**: Automatic packaging on tags

## Requirements

- VS Code 1.84.0 or higher
- Node.js 20.x
- relay-plugin installed and configured

## Configuration

The extension reads configuration from `.claude/relay/domain-config.json`:

```json
{
  "domain": "development",
  "active_packs": ["typescript", "react"],
  "project_name": "my-project",
  "configured_at": "2026-01-01"
}
```

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

MIT

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history.
