# @matildeene/motion-player

Interactive React player for a `FilmDescriptor`. The player converts a monotonic browser clock into integer frames and renders Core's `FilmSurface`. It supports playback, pause, seek, and loop without owning film state.

The package ships minimal isolated CSS and does not require Tailwind.

Import the stylesheet once in your browser app:

```tsx
import { FilmPlayer } from "@matildeene/motion-player";
import "@matildeene/motion-player/player.css";
```
