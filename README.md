# InstaPlate Recipe Manager

A powerful offline-first desktop application for managing, organizing, and discovering recipes. Built with Tauri v2 (Rust backend) and React (TypeScript frontend), InstaPlate provides a native desktop experience on Windows, macOS, and Linux.

## Features

- **Recipe Library** - Store, organize, search, and manage recipes with full metadata including ingredients, instructions, cooking times, difficulty levels, and more
- **Recipe Import** - Import recipes from multiple formats:
  - JSON files
  - Markdown files
  - InstaPlate pack files
  - Direct URL scraping from popular recipe websites
- **Crawl Engine** - Search and automatically scrape recipes from major recipe websites including AllRecipes, Epicurious, Food Network, Serious Eats, and Bon Appetit
- **Recipe Packs** - Group and organize recipes into thematic collections for easy export and sharing
- **Smart Suggestions** - AI-powered suggestions to automatically create recipe packs based on diversity, unused recipes, cuisine type, and meal type
- **Similarity Analysis** - Find similar recipes using multi-factor scoring based on ingredients, text content, and metadata
- **Duplicate Detection** - Automatic fingerprint-based duplicate detection using ingredient analysis
- **Image Management** - Support for recipe hero images, step photos, and galleries

## Table of Contents

- [Prerequisites](#prerequisites)
  - [Windows](#windows-prerequisites)
  - [macOS](#macos-prerequisites)
- [Installation](#installation)
  - [Windows](#windows-installation)
  - [macOS](#macos-installation)
- [Running the Application](#running-the-application)
- [Building for Production](#building-for-production)
- [Project Structure](#project-structure)
- [Database](#database)
- [Configuration](#configuration)
- [Development](#development)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Windows Prerequisites

#### 1. Install Node.js

1. Download Node.js LTS (v18 or later) from [https://nodejs.org/](https://nodejs.org/)
2. Run the installer and follow the prompts
3. Verify installation by opening Command Prompt or PowerShell:
   ```powershell
   node --version
   npm --version
   ```

#### 2. Install Rust

1. Download the Rust installer from [https://rustup.rs/](https://rustup.rs/)
2. Run `rustup-init.exe`
3. Follow the on-screen instructions (default installation is recommended)
4. Restart your terminal and verify:
   ```powershell
   rustc --version
   cargo --version
   ```

#### 3. Install Microsoft Visual Studio C++ Build Tools

Tauri requires the Microsoft C++ build tools for Windows:

1. Download the [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
2. Run the installer
3. In the installer, select **"Desktop development with C++"** workload
4. Click Install and wait for completion
5. Restart your computer

#### 4. Install WebView2 (Windows 10/11)

Windows 10 (version 1803+) and Windows 11 should have WebView2 pre-installed. If not:

1. Download WebView2 from [Microsoft's website](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)
2. Run the installer

### macOS Prerequisites

#### 1. Install Xcode Command Line Tools

Open Terminal and run:
```bash
xcode-select --install
```

Click "Install" when prompted and wait for completion.

#### 2. Install Homebrew (if not already installed)

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

After installation, follow the instructions to add Homebrew to your PATH.

#### 3. Install Node.js

**Option A: Using Homebrew (Recommended)**
```bash
brew install node
```

**Option B: Using nvm (Node Version Manager)**
```bash
brew install nvm
mkdir ~/.nvm
# Add the following to ~/.zshrc or ~/.bash_profile:
# export NVM_DIR="$HOME/.nvm"
# [ -s "/opt/homebrew/opt/nvm/nvm.sh" ] && \. "/opt/homebrew/opt/nvm/nvm.sh"

nvm install --lts
nvm use --lts
```

Verify installation:
```bash
node --version
npm --version
```

#### 4. Install Rust

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

Follow the on-screen instructions (default installation is recommended). Then restart your terminal or run:
```bash
source "$HOME/.cargo/env"
```

Verify installation:
```bash
rustc --version
cargo --version
```

---

## Installation

### Windows Installation

1. **Clone the repository**
   ```powershell
   git clone https://github.com/MagnoliaLex/RecipeOrganizer.git
   cd RecipeOrganizer
   ```

2. **Install Node.js dependencies**
   ```powershell
   npm install
   ```

3. **Verify Tauri CLI is available**
   ```powershell
   npx tauri --version
   ```

### macOS Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/MagnoliaLex/RecipeOrganizer.git
   cd RecipeOrganizer
   ```

2. **Install Node.js dependencies**
   ```bash
   npm install
   ```

3. **Verify Tauri CLI is available**
   ```bash
   npx tauri --version
   ```

---

## Running the Application

### Development Mode

Development mode provides hot-reload for rapid development.

**Windows (PowerShell or Command Prompt):**
```powershell
npm run tauri dev
```

**macOS (Terminal):**
```bash
npm run tauri dev
```

This command will:
1. Start the Vite development server on `http://localhost:1420`
2. Compile the Rust backend
3. Launch the desktop application with hot-reload enabled

### Frontend-Only Development

If you only want to work on the frontend without the Tauri wrapper:

```bash
npm run dev
```

Then open `http://localhost:1420` in your browser. Note that Tauri-specific features (file system access, database) won't work in browser mode.

---

## Building for Production

### Windows

Build the application for Windows:

```powershell
npm run tauri build
```

The built application will be located in:
- **MSI Installer:** `src-tauri/target/release/bundle/msi/`
- **Executable:** `src-tauri/target/release/bundle/nsis/`

### macOS

Build the application for macOS:

```bash
npm run tauri build
```

The built application will be located in:
- **DMG:** `src-tauri/target/release/bundle/dmg/`
- **App Bundle:** `src-tauri/target/release/bundle/macos/`

### Build for All Platforms

To build for a specific target platform, use:

```bash
# For macOS ARM (Apple Silicon)
npm run tauri build -- --target aarch64-apple-darwin

# For macOS Intel
npm run tauri build -- --target x86_64-apple-darwin

# For Windows 64-bit
npm run tauri build -- --target x86_64-pc-windows-msvc
```

---

## Project Structure

```
RecipeOrganizer/
├── src/                           # React/TypeScript frontend
│   ├── main.tsx                   # React entry point
│   ├── App.tsx                    # Main app with routing
│   ├── index.css                  # Tailwind CSS styles
│   ├── types/                     # TypeScript type definitions
│   │   └── index.ts               # Recipe, Pack, and other interfaces
│   ├── components/                # Reusable UI components
│   │   └── Layout.tsx             # App shell with sidebar navigation
│   ├── pages/                     # Page components (routes)
│   │   ├── Library.tsx            # Recipe library & search
│   │   ├── RecipeDetail.tsx       # Individual recipe view
│   │   ├── Import.tsx             # Import recipes UI
│   │   ├── CrawlEngine.tsx        # Web crawling interface
│   │   ├── Packs.tsx              # Recipe pack management
│   │   └── Suggest.tsx            # Pack suggestion generator
│   └── lib/                       # Business logic libraries
│       ├── db/                    # Database layer
│       │   ├── client.ts          # SQLite connection & migrations
│       │   ├── queries.ts         # CRUD operations
│       │   └── migrations/        # SQL migration files
│       ├── import/                # Recipe import functionality
│       │   ├── index.ts           # Public import API
│       │   ├── scrapeUrl.ts       # Web scraping logic
│       │   ├── normalize.ts       # Data normalization
│       │   └── fingerprint.ts     # Duplicate detection
│       ├── export/                # Recipe export functionality
│       │   ├── exportPack.ts      # Export to InstaPlate format
│       │   └── validatePack.ts    # Pack validation
│       ├── crawl/                 # Web crawling engine
│       │   └── crawlEngine.ts     # Search & scrape logic
│       ├── similarity/            # Recipe similarity algorithms
│       │   ├── score.ts           # Multi-factor similarity scoring
│       │   ├── jaccard.ts         # Ingredient similarity
│       │   ├── cosine.ts          # Text similarity
│       │   └── tfidf.ts           # TF-IDF vectorization
│       └── suggest/               # Pack suggestion system
│           └── suggestPacks.ts    # Suggestion algorithm
├── src-tauri/                     # Rust/Tauri backend
│   ├── src/
│   │   ├── main.rs                # Application entry point
│   │   └── lib.rs                 # Tauri plugin setup
│   ├── Cargo.toml                 # Rust dependencies
│   ├── tauri.conf.json            # Tauri configuration
│   └── icons/                     # Application icons
├── public/                        # Static assets
├── package.json                   # Node.js dependencies & scripts
├── tsconfig.json                  # TypeScript configuration
├── vite.config.ts                 # Vite build configuration
├── tailwind.config.js             # Tailwind CSS configuration
└── postcss.config.js              # PostCSS configuration
```

---

## Database

InstaPlate uses SQLite for local data storage. The database is automatically created and managed by the application.

### Database Location

- **Windows:** `%APPDATA%\com.instaplate.recipe-manager\recipes.db`
- **macOS:** `~/Library/Application Support/com.instaplate.recipe-manager/recipes.db`
- **Linux:** `~/.local/share/com.instaplate.recipe-manager/recipes.db`

### Database Schema

The database contains the following tables:

| Table | Description |
|-------|-------------|
| `recipes` | Main recipe data (title, ingredients, instructions, metadata) |
| `recipe_images` | Images associated with recipes |
| `packs` | Recipe pack/collection definitions |
| `pack_recipes` | Many-to-many relationship between packs and recipes |
| `usage_events` | Usage tracking for analytics |
| `similarity_cache` | Cached similarity scores between recipes |

### Migrations

Database migrations are automatically applied on application startup. Migration files are located in `src/lib/db/migrations/`.

---

## Configuration

### Tauri Configuration

The main Tauri configuration is in `src-tauri/tauri.conf.json`:

| Setting | Value | Description |
|---------|-------|-------------|
| `productName` | InstaPlate Recipe Manager | Application display name |
| `identifier` | com.instaplate.recipe-manager | Unique app identifier |
| `version` | 0.1.0 | Application version |
| `window.width` | 1280 | Default window width |
| `window.height` | 800 | Default window height |
| `window.minWidth` | 900 | Minimum window width |
| `window.minHeight` | 600 | Minimum window height |

### Vite Configuration

Frontend build configuration is in `vite.config.ts`:

- Development server runs on port `1420`
- Path alias `@/` maps to `src/` directory
- Target browsers: Chrome 100+, Safari 13+

### TypeScript Configuration

TypeScript settings are in `tsconfig.json`:

- Strict mode enabled
- ES2020 target
- Path aliases supported (`@/*` -> `src/*`)

---

## Development

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server (frontend only) |
| `npm run build` | Build frontend for production |
| `npm run preview` | Preview production build |
| `npm run tauri dev` | Run full desktop app in development mode |
| `npm run tauri build` | Build native desktop application |

### Code Style

- **Frontend:** TypeScript with React 18
- **Styling:** Tailwind CSS with custom color palette
- **State Management:** React hooks and context
- **Routing:** React Router v6

### Adding New Pages

1. Create a new component in `src/pages/`
2. Add the route in `src/App.tsx`
3. Add navigation link in `src/components/Layout.tsx`

### Adding New Database Tables

1. Create a new migration file in `src/lib/db/migrations/`
2. Add query functions in `src/lib/db/queries.ts`
3. Update types in `src/types/index.ts`

---

## Troubleshooting

### Windows Issues

#### "MSVC not found" Error
Ensure Visual Studio Build Tools are installed with the "Desktop development with C++" workload.

```powershell
# Verify MSVC installation
where cl.exe
```

#### "WebView2 not found" Error
Download and install WebView2 from Microsoft's website.

#### Rust Compilation Errors
Update Rust to the latest version:
```powershell
rustup update
```

#### Permission Denied Errors
Run PowerShell or Command Prompt as Administrator.

### macOS Issues

#### "Command Line Tools not found" Error
```bash
xcode-select --install
```

#### Rust Compilation Errors
Update Rust and ensure Xcode tools are current:
```bash
rustup update
xcode-select --install
```

#### "codesign" Errors on Build
For development builds, you can skip code signing:
```bash
npm run tauri build -- --no-bundle
```

For distribution, you'll need an Apple Developer certificate.

#### Permission Issues
Ensure your user has write access to the project directory:
```bash
sudo chown -R $(whoami) /path/to/RecipeOrganizer
```

### General Issues

#### Database Corruption
Delete the database file and restart the application. The database will be recreated:

**Windows:**
```powershell
del "%APPDATA%\com.instaplate.recipe-manager\recipes.db"
```

**macOS:**
```bash
rm ~/Library/Application\ Support/com.instaplate.recipe-manager/recipes.db
```

#### Port 1420 Already in Use
Another process is using port 1420. Find and stop it:

**Windows:**
```powershell
netstat -ano | findstr :1420
taskkill /PID <PID> /F
```

**macOS:**
```bash
lsof -i :1420
kill -9 <PID>
```

#### Node Modules Issues
Delete node_modules and reinstall:
```bash
rm -rf node_modules
npm install
```

#### Cargo/Rust Cache Issues
Clean the Rust build cache:
```bash
cd src-tauri
cargo clean
cd ..
npm run tauri dev
```

---

## Technology Stack

| Component | Technology |
|-----------|------------|
| Frontend Framework | React 18 |
| Language | TypeScript 5.5 |
| Styling | Tailwind CSS 3.4 |
| Build Tool | Vite 5.4 |
| Desktop Framework | Tauri 2.0 |
| Backend Language | Rust |
| Database | SQLite |
| Routing | React Router 6 |

---

## License

This project is private and proprietary.

---

## Support

For issues and feature requests, please open an issue in the GitHub repository.
