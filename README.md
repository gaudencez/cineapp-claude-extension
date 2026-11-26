# CineApp for Claude Desktop

[![MCPB](https://img.shields.io/badge/Claude%20Desktop-extension-blue)](https://zxrstudios.com/cineapp)

CineApp is a movie-making machine controlled by voice: the filmmaking app and voice assistant in your Mac's menu bar, behind ZXR Studios. This extension lets Claude hand CineApp a job: drive your apps (After Effects, Premiere, Photoshop and the rest), type at the cursor, tidy a folder, or check how one of your CineApp film projects stands.

## Requirements

- macOS 13 or later.
- CineApp installed and running, from <https://zxrstudios.com/cineapp>.
- Node 18 or later (Claude Desktop supplies its own).

## Setup

1. Install CineApp and grant it the permissions it asks for on first launch (Microphone, Accessibility, Input Monitoring).
2. In CineApp's menu choose **Connect to Claude…** → **Add to Claude Desktop**, or open `CineApp.mcpb` with Claude Desktop, and click **Install**.
3. In a Claude Desktop chat, ask: *"Is CineApp running?"* — the `cineapp_ping` tool answers.

## Usage

- *"Ask CineApp to open After Effects and put my name on this comp."* → `cineapp_do`
- *"Type 'I'll be there at eight' where my cursor is."* → `cineapp_type`
- *"Tidy my Downloads folder."* → `cineapp_organize_folder`
- *"Where does my Coaster project stand?"* → `cineapp_status`, `cineapp_projects`, `cineapp_sheets`

Anything that costs credits — films, renders, character sheets, audio, music, images — never starts from Claude. CineApp shows a **Yes / Not yet** card on your Mac and waits for your own click.

## Tools

| Tool | What it does | Annotations |
|---|---|---|
| `cineapp_ping` | Checks CineApp is running | read-only |
| `cineapp_projects` | Lists your CineApp film projects | read-only |
| `cineapp_status` | Where a project stands | read-only |
| `cineapp_sheets` | A project's character, prop and location sheets | read-only |
| `cineapp_organize_folder` | Moves a folder's files into type sub-folders | destructive (moves files) |
| `cineapp_type` | Types text at the cursor | destructive (writes into the focused app) |
| `cineapp_do` | Asks CineApp to do something on your Mac, in plain language | destructive, open-world |

## Privacy Policy

This extension runs entirely on your Mac. It contains no network code of its own: it launches the `cineapp` command-line tool that ships inside the CineApp app and relays Claude's request to it.

- **Data collection.** The extension collects nothing and stores nothing. Each request is passed to the local CineApp app and the app's reply is returned to Claude.
- **What CineApp does with a request.** CineApp may send the text of a request to the AI services it uses to understand and carry it out, under your CineApp licence. CineApp's own handling of data is described in the ZXR Studios privacy policy at <https://zxrstudios.com/privacy>.
- **Third-party sharing.** The extension shares nothing with third parties. It has no analytics, no telemetry, no crash reporting.
- **Retention.** The extension keeps no logs and no history. CineApp keeps a local activity log on your Mac that you can clear from the app.
- **Contact.** privacy@zxrstudios.com — or <https://zxrstudios.com/privacy>.

## License

MIT — see LICENSE. The connector is open source; the CineApp app itself is a separate, proprietary product.

## Support

<https://zxrstudios.com/cineapp>
