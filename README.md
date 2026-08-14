# The Long Dark Interactive Map

A static interactive map viewer for *The Long Dark*. It displays region maps for Pilgrim/Voyageur/Stalker and Interloper/Misery, supports pan and zoom, and lets players follow region transitions.

It is installable as a Progressive Web App on supported mobile and desktop browsers. The application shell works offline after its first visit, and previously opened map images remain available from the device cache.

This is an independent, modernized and responsive adaptation of the original [TLD Interactive Map by Elektronixx](https://elektronixx.github.io/TLD-Interactive-Map/). It is not affiliated with or endorsed by the original author.

The map images and artwork remain the work of their Steam community creators. In particular, this version uses material from [HokuOwl's Updated Region Maps [2024]](https://steamcommunity.com/sharedfiles/filedetails/?id=3255435617) and [Krueger's Tales from the Far Territory map locations guide](https://steamcommunity.com/sharedfiles/filedetails/?id=2899955301). This project does not claim ownership of that material.

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
