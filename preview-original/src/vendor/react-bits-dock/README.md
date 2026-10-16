# React Bits Dock

Source: https://github.com/DavidHDev/react-bits/tree/main/src/content/Components/Dock

Retrieved 2026-10-16. `Dock.jsx` and `Dock.css` are vendored from the official JavaScript/CSS version. The accompanying license is retained verbatim and copied to `ui/react-bits-dock-license.txt` during builds.

Local adaptations: an optional `item.renderItem(button)` wraps the original button in the existing tool's Popover. Button refs use stable item IDs so inserting the login-only notes tool cannot shift calendar refs into the notes slot. Upstream spring animation, keyboard navigation and layout are retained. Site-specific appearance is configured in `topbar.jsx` and `topbar.css`.
