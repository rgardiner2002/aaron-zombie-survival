# DEAD AIR — 4-player browser co-op

A GitHub Pages-ready, first-person, wave-based zombie survival game. Includes the user-supplied, **wider photo texture** as the zombie sprite.

## Deploy on GitHub Pages

1. Create a GitHub repository (for example, `dead-air-coop`).
2. Upload **all** the files and folders from this ZIP to the repository root, preserving the `assets/` directory.
3. Go to **Settings → Pages → Build and deployment**. Set **Source** to `Deploy from a branch`, **Branch** to `main`, and folder to `/ (root)`. Save.
4. Open the URL GitHub gives you, normally `https://YOUR-USERNAME.github.io/dead-air-coop/`.
5. One player selects **HOST ROOM**, copies the invite link, and shares it with up to three friends. Friends open the link, enter a name and select **JOIN ROOM**. The host presses **START SURVIVAL**. Friends press **ENTER BUNKER**.

All players should keep the page open; the **host must stay connected** or the session ends. Friends can join a running game when a slot is available.

## Controls

- **W / A / S / D:** Move
- **Mouse:** Look / aim
- **Left click:** Shoot
- **R:** Reload
- **E:** Buy weapons/perks, use the mystery box, or revive a downed teammate nearby
- **Shift:** Sprint
- **Esc / P:** Release the mouse / show overlay; **the co-op match does not pause**
- **Fullscreen** button: Expand the game

## How online co-op works

GitHub Pages is **static hosting**, not a multiplayer server. This game uses [PeerJS 1.5.5](https://peerjs.com/) and its public PeerServer Cloud for WebRTC peer discovery; game data is shared browser-to-browser. The **host browser** controls zombie positions, damage, wave progression and player scores, and sends regular snapshots to the other players.

### Limitations

- For casual play with friends, **not** production-grade dedicated multiplayer hosting. The host must remain in game and in an active browser tab. Background-tab throttling and network conditions may affect synchronization.
- PeerJS's free shared cloud service is not guaranteed to be always available. The game depends on internet access to PeerJS and the PeerJS JavaScript CDN; its public signaling endpoint may experience rate limits or outages.
- **Some corporate networks, restrictive NATs, browser settings or firewalls prevent direct WebRTC connections.** This package does not include TURN relay credentials; a TURN server / separately hosted signaling can improve reliability.
- The host is authoritative about zombie simulation and player points/health, but clients are only partially validated; there is **no anti-cheat**.
- No matchmaking, permanent rooms, progress save, or host migration. Room codes are for casual discovery, not secret/password-protected rooms.
- Four total connected players: **one host + up to three guests**.
- This is a fan-inspired independent browser game, not affiliated with Call of Duty or Activision.

## Files

```
index.html               # Game page and UI
game.js                  # Game, networking, and co-op logic
assets/zombie_wide.png   # Wider zombie image texture
.nojekyll                # Disable GitHub Pages' Jekyll processing
README.md                # This guide
```

## Privacy

The included zombie asset is a photo-based character image. If you use a **public GitHub repository / GitHub Pages**, it can be viewed and downloaded by anyone with the site URL. Make sure you have permission to publish the photo.

## Development/testing

To view it locally, serve the folder from a local HTTP server (for example `python -m http.server 8000`) or deploy to GitHub Pages. The public PeerJS signaling connection and WebRTC must be tested with multiple real browsers across the desired networks before considering it live/verified end to end.


### Zombie image visibility
The custom wide zombie texture is embedded inside `game.js` for reliability on GitHub Pages. `assets/zombie_wide.png` is also included as an editable standalone asset. The lobby displays a thumbnail and the first zombie of each round enters the main hallway in front of the starting position; later zombies appear elsewhere around the map. Re-upload **both** `game.js` and `index.html` when updating an existing deployment, and force-refresh the page to clear cached scripts.

## Round 5: VIP boss

A unique VIP boss joins the fifth round alongside normal zombies. His custom transparent photo sprite is in `vip_boss.webp` (an optimised version of the provided image), and all players see the same boss through host-authoritative PeerJS state snapshots. He has extra health scaling with co-op player count, a shared boss health bar, and rotating spoken/on-screen catchphrases (“I Tell yA” and “I'm don't like sunday dinners”). His eye lasers warn and charge before firing, deal line-of-sight damage, and can be dodged by moving behind a wall. Defeating VIP awards 2,000 points to the player who lands the final blow. Spoken lines depend on the browser's speech-synthesis support and audio setting.

## Special rounds and power-ups

- **Round 5 and subsequent multiples of five, except round 10:** Hellhound-only rounds (5, 15, 20, 25, …) use the photo-based dog sprite `hellhound.webp`. They feature faster enemies, a darker map, drifting blue-grey mist, lightning at spawn locations and short flashes when dogs appear. The last dog of a completed dog round drops **Max Ammo**.
- **Round 10:** VIP boss spawns alongside the normal zombies, with his existing health bar, eye lasers and catchphrases.
- **Random glowing drops** may appear where an enemy dies. Walk into a drop to pick it up; drops expire after 19 seconds. **Max Ammo** refills magazines and reserve ammo for the team. **Double Points** doubles zombie-hit/kill points for 30 seconds. **Insta-Kill** kills regular zombies and hellhounds with a hit for 22 seconds (but not VIP). **Nuke** clears the enemies currently on the map and gives each player 400 points. Effects, drops, pickups and dog spawns are host-authoritative and synchronised over PeerJS for every player.

