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
- **Mouse:** Look left, right, up and down
- **Left click:** Shoot
- **Arrow keys:** Look around (including up and down)
- **1 / 2:** Equip first or second gun slot
- **Q:** Swap between your two carried guns
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
zombie_wide.png          # Custom wider zombie image texture
hellhound.webp           # Custom dog-round sprite
vip_boss.webp            # VIP boss sprite
.nojekyll                # Disable GitHub Pages' Jekyll processing
README.md                # This guide
```

## Privacy

The included zombie asset is a photo-based character image. If you use a **public GitHub repository / GitHub Pages**, it can be viewed and downloaded by anyone with the site URL. Make sure you have permission to publish the photo.

## Development/testing

To view it locally, serve the folder from a local HTTP server (for example `python -m http.server 8000`) or deploy to GitHub Pages. The public PeerJS signaling connection and WebRTC must be tested with multiple real browsers across the desired networks before considering it live/verified end to end.


### Zombie image visibility
The zombie sprite loads from `zombie_wide.png` at the repository root. Update that image and refresh the deployment to change its appearance. The first zombie of each round enters the main hallway in front of the starting position; later zombies appear elsewhere around the map. Re-upload **both** `game.js` and `index.html` when updating an existing deployment, and force-refresh the page to clear cached scripts.

## Round 10: VIP boss

A unique VIP boss joins the tenth round alongside normal zombies. His custom transparent photo sprite is in `vip_boss.webp` (an optimised version of the provided image), and all players see the same boss through host-authoritative PeerJS state snapshots. He has extra health scaling with co-op player count, a shared boss health bar, and rotating spoken/on-screen catchphrases (“I Tell yA” and “I'm don't like sunday dinners”). His eye lasers warn and charge before firing, deal line-of-sight damage, and can be dodged by moving behind a wall. Defeating VIP awards 2,000 points to the player who lands the final blow. Spoken lines depend on the browser's speech-synthesis support and audio setting.

## Special rounds and power-ups

- **Unpredictable Hellhound rounds:** Round 5 is guaranteed. Each subsequent dog round happens randomly 5, 6, or 7 rounds after the previous one, without overlapping the VIP on round 10. The host selects the timing and syncs the current dog-wave status to guests. The hellhounds use `hellhound.webp`. They feature faster enemies, a darker map, drifting blue-grey mist, lightning at spawn locations and short flashes when dogs appear. The last dog of a completed dog round drops **Max Ammo**.
- **Round 10:** VIP boss spawns alongside the normal zombies, with his existing health bar, eye lasers and catchphrases.
- **Random glowing drops** may appear where an enemy dies. Walk into a drop to pick it up; drops expire after 19 seconds. **Max Ammo** refills magazines and reserve ammo for the team. **Double Points** doubles zombie-hit/kill points for 30 seconds. **Insta-Kill** kills regular zombies and hellhounds with a hit for 22 seconds (but not VIP). **Nuke** clears regular zombies and dogs currently on the map (VIP is immune) and gives each player 400 points. Effects, drops, pickups and dog spawns are host-authoritative and synchronised over PeerJS for every player.


## Updated bunker graphics

The canvas now includes perspective-accurate tiled concrete floor detail, weathered wall textures, flickering emergency wall lights, a subtle flashlight-like vignette, muzzle flash illumination, and drifting dust. These are local rendering effects; multiplayer bandwidth is unchanged. The 960×540 base resolution is unchanged to protect performance.

## Pack-a-Punch machine

The neon-purple Pack-a-Punch machine is in the eastern bunker corridor at **(16.5, 5.5)**. Approach it and press **E** to upgrade the currently held gun for **5,000 points**. The upgrade grants **2.25× damage**, a **50% larger magazine and reserve**, faster firing, full ammo, new weapon names, and purple energy accents and muzzle flashes. You can upgrade each equipped gun once; each of the two weapon slots retains its own upgrade even when you switch between them. Replacing a weapon removes the upgrade only from that replaced slot. Pack-a-Punched ammunition scales properly for reloading and Max Ammo power-ups. In online co-op, the host validates each player's distance, points, and current upgrade before completing the purchase and synchronises the result to guests.

## Vertical mouse look

Looking up and down now changes the camera pitch with mouse movement, touch drag, or the up/down arrow keys. The raycast horizon, enemy sprites, machines, and power-up positions track the camera direction, and vertical aim is checked for shots. Co-op guests send pitch with shots for host validation. The camera has a bounded vertical range, retaining the game's lightweight 2.5D renderer. The menu's custom zombie preview card has been removed; `zombie_wide.png` is still used in the game.

## Backrooms map and live leaderboard

This update turns the level into a connected 30 × 24 cell Backrooms-inspired maze, with winding yellow-wallpaper corridors, faded tan carpeting, and flickering overhead fluorescent lights. The yellow and muted-brown palette also extends to the menu and controls. Existing enemies, VIP, Pack-a-Punch and hellhounds remain playable.

A **live leaderboard** underneath the game ranks players in the current four-player room by *total points earned* (so buying weapons will not lower the ranking), then kills. It displays downed status and highlights your own name. As this is a static GitHub Pages game without a database, the leaderboard is **room-local**, not a permanent global high-score service.

## Two-weapon inventory

Each player starts with the M1911 and an empty second weapon slot. Buying or winning a new weapon from the mystery box fills the empty slot; once both slots are full, acquiring another weapon replaces the currently held slot. Use **1** or **2** to equip the selected slot, or **Q** to switch between occupied slots. Each weapon retains its own ammunition and Pack-a-Punch upgrade. Max Ammo refills both carried weapons for every player. Weapon switches are sent to the host so damage and upgrade effects remain correct in online co-op.

## Single Nuke drop

Only one Nuke can exist as an uncollected power-up at once across the shared room. If another random Nuke roll occurs while one is present, the game chooses a different power-up instead. Once the original is collected or expires, a new Nuke can spawn.
