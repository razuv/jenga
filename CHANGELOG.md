# Changelog

## 1.0.0 — 2026-10-24

- 3D Jenga with Three.js, Rapier physics, wooden materials and direct block dragging.
- Local play for 1–6 players, running entirely in the browser on GitHub Pages.
- Optional online rooms for up to 6 players through a separate Socket.IO server.
- Seated players with randomly assigned Russian meme faces.
- GitHub Actions workflow for testing, building and deploying to Pages.
- Repository subpath support for assets, navigation and invitation links.
- Configurable online backend URL and cross-origin support.
- Regression coverage for physics, dragging, rooms and serverless local play.

Online rooms require a separate Node.js backend; GitHub Pages hosts the static game.
