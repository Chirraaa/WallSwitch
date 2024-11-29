Here's a comprehensive README.md for the WallSwitch project:

```markdown
# WallSwitch: Seamless Game-Wallpaper Engine Automation

## Description
WallSwitch is an open-source Electron + Vite + React desktop application that automatically manages Wallpaper Engine during gaming sessions. Designed for gamers who want uninterrupted wallpaper experiences, it intelligently detects game launches and closures to optimize system resources.

## Key Features
- Automatic Wallpaper Engine management
- Multi-game support
- Configurable game executable list
- Minimal system overhead
- Background monitoring

## Technical Architecture
- Frontend: React (v18.2.0)
- Framework: Electron (v29.1.4)
- Build System: Vite (v5.1.6)
- Styling: Tailwind CSS (v3.4.15)
- Backend Management: PowerShell Scripts (node-powershell)
- Process Detection: Windows API integration
- Language: TypeScript

## Use Cases
- Prevent performance interruptions during gaming
- Automatically restore wallpapers post-game
- Streamline desktop environment transitions

## Prerequisites
- Node.js (v16 or later)
- npm (v8 or later)
- Windows 10/11

## Key Dependencies
### Main Dependencies
- React (v18.2.0)
- Electron (v29.1.4)
- Node-PowerShell (v5.0.1)
- Tailwind CSS (v3.4.15)
- Lucide React (Icons)
- Electron Store

### Development Dependencies
- TypeScript
- Vite
- Electron Builder
- ESLint

## Getting Started

### Installation

1. Clone the repository:
```bash
git clone https://github.com/Chirraaa/WallSwitch.git
cd WallSwitch
```

2. Install dependencies:
```bash
npm install
```

### Development Mode
To run the application in development mode:
```bash
npm run dev
```
This will start the Electron application with hot reloading enabled.

### Building for Production

#### Compile for specific platforms:
- For Windows:
```bash
npm run build
```

### Packaging
To create distributable packages:
```bash
npm run make
```

### Troubleshooting
- Ensure you have the latest version of Node.js and npm
- If you encounter any build errors, try clearing npm cache:
```bash
npm cache clean --force
```

## How to Use
1. Select the Wallpaper Engine executable
2. Add game executables you want to track
3. Start monitoring
4. WallSwitch will automatically manage Wallpaper Engine during your gaming sessions

## Licensing
Open-source (MIT/GPL)

## Platform Support
- Primary Platform: Windows 10/11

## Contact
- Twitter: [@ChirraaaB](https://twitter.com/ChirraaaB)
```
