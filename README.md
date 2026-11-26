# Christmas Tree

A shared Christmas tree on the web. Friends open your tree's link, make an ornament, hang it anywhere on the tree, and leave a note. An optional Windows widget keeps your tree in a corner of your screen.

The interface is in Korean.

## Features

- **Ornaments**
  - Pick one of 8 shapes with any color, a pattern, and a secondary color, or draw your own on a 16×16 pixel canvas.
  - Every ornament can have engraved text (up to 3 characters), a size, a rotation, and a shine effect.
- **Notes**: Each ornament can carry a short note. Hover or tap an ornament to read it.
- **Trees for everyone**
  - Anyone can create a tree at `/new` and share it at `/t/<code>`. No sign-up needed.
  - The browser that creates a tree becomes its owner. A manage link lets the owner use other devices too.
- **Owner tools**: Copy the share link, rename the tree, and remove any ornament.
- **Snow**: Visitors can make it snow on the tree for a minute.
- **Desktop widget (Windows)**
  - A transparent, always-on-top tree that updates live and opens the site when clicked.
  - Drag it anywhere and resize it with Ctrl + mouse wheel.

## Deploy

The site and API run on [Vercel](https://vercel.com), and data is stored in [Cloud Firestore](https://firebase.google.com/docs/firestore). The free tiers of both are enough for personal use.

### 1. Firebase

1. Create a project in the [Firebase console](https://console.firebase.google.com).
2. Create a Cloud Firestore database:
   - Go to **Build → Firestore Database → Create database**.
   - Choose Standard edition, the default database ID, a location near your users, and production mode.
3. In the **Rules** tab, paste the contents of [`firestore.rules`](firestore.rules) and publish. These rules block all direct browser access, so only the API can read or write.
4. Download a service account key: go to **Project settings → Service accounts → Generate new private key**.
   - Keep this JSON file secret and never commit it.

### 2. Vercel

1. [Import this repository](https://vercel.com/new) into Vercel. Leave the framework preset as **Other**.
2. Under **Project → Settings → Environment Variables**, add the following, enabled for Production:

   | Name | Value |
   |---|---|
   | `FIREBASE_SERVICE_ACCOUNT` | The full contents of the service account JSON file (mark it as Secret) |
   | `ADMIN_KEY` | *Optional.* A secret string that gives owner access to the default tree at `/` |
   | `MAX_PER_PERSON` | *Optional.* Ornaments each visitor can hang per tree (default `3`) |

3. Redeploy so the variables take effect.
   - If the storage connection is misconfigured, the site shows a message that names the cause, such as a missing variable, invalid JSON, or a missing database.

Every push to `main` redeploys automatically.

### 3. Pages

| Path | Page |
|---|---|
| `/` | The default tree |
| `/new` | Create a tree |
| `/t/<code>` | A tree created by a visitor |

### 4. Administration

- **Default tree**: To manage the tree at `/`, open `/?admin=<ADMIN_KEY>` once. That browser keeps owner access.
- **Deleting data**: Ornaments and trees live in the `trees/<code>` documents in Firestore, and the default tree is `trees/main`. Delete them from the Firebase console.
- **Site text**: Edit the title and subtitle in [`public/config.js`](public/config.js).

## Desktop widget (Windows)

### Install

1. Download `TreeWidget-Setup-<version>.exe` from [Releases](../../releases) and run it. No administrator rights are needed.
   - The installer is not code-signed, so Windows SmartScreen may warn you. Choose **More info → Run anyway**.
2. On first launch, enter the address of your tree (for example `https://<your-site>/t/<code>`).

### Use

- **Open the site**: Click the tree.
- **Move**: Press and drag the tree. It snaps to screen edges and remembers its position.
- **Resize**: Scroll with Ctrl held down over the tree. The size ranges from 55% to 220%.
- **Notes**: Hover an ornament to read its note.
- **Tray menu**: Right-click the tray icon for position, size, monitor, snow, start with Windows, the tree address, and quit.
- **Update**: Run a newer installer. Your settings are kept.
- **Uninstall**: Go to Windows **Settings → Apps**. This also removes the start-with-Windows entry.

### Build the installer

Requires Node.js and [NSIS](https://nsis.sourceforge.io):

- Debian/Ubuntu: `apt install nsis`
- macOS: `brew install makensis`
- Windows: install NSIS and run the commands below from Git Bash

```bash
cd widget
npm install
npm run dist   # → widget/dist/TreeWidget-Setup-<version>.exe
```

No Wine is needed on macOS or Linux. To release a new version, bump `version` in `widget/package.json`.
