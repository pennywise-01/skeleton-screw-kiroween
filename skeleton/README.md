# Skeleton Component Library

Reusable React components for AI-powered web apps.

## Components

- `AgentProvider` - Context provider for AI agent integration
- `FileUpload` - Drag-and-drop file uploader
- `CodePreview` - Syntax-highlighted code viewer with diff support
- `SpecEditor` - Markdown editor with live preview

## Usage

```tsx
import { AgentProvider, useAgent, FileUpload } from 'skeleton';

function App() {
  return (
    <AgentProvider>
      <YourApp />
    </AgentProvider>
  );
}
```

## Build

```bash
npm install
npm run build
```
