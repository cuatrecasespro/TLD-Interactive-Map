# The Long Dark Interactive Map

A static interactive map viewer for *The Long Dark*. It displays region maps for Pilgrim/Voyageur/Stalker and Interloper/Misery, supports pan and zoom, and lets players follow region transitions.

## Development

No dependency installation is needed. Serve the repository with any static HTTP server, then open `index.html` through that server.

```sh
npm run check
```

`npm run check` verifies JavaScript syntax and confirms that every home-map region and transition has image data for both difficulty groups.

## Data

- `assets/js/maps.json` contains remote map image URLs.
- `assets/js/transitions.js` contains navigable region transition coordinates.
- `npm run update-maps` refreshes the image URLs from the credited Steam guides.

The image material is credited in the application. Verify the source guides' terms before redistributing those assets.
