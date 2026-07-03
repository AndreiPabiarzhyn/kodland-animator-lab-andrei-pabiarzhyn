<div align="center">
  <img src="./public/favicon.ico" width="72" height="72" alt="KodFlip">

  # KodFlip

  A lightweight frame-by-frame animation studio that runs in the browser.

  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white" alt="React 18">
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" alt="TypeScript 5">
  <img src="https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white" alt="Vite 5">
  <img src="https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?logo=tailwindcss&logoColor=white" alt="Tailwind CSS 3">
</div>

## Features

KodFlip gives you everything you need to draw an animation frame by frame:

- draw with a pencil, eraser, fill tool, and geometric shapes;
- use mirror drawing, a color picker, and selection transforms;
- add, duplicate, rename, reorder, and hide layers;
- use onion skinning to see neighboring frames;
- add, duplicate, delete, and reorder frames on the timeline;
- adjust the frame rate and loop playback;
- save a project as JSON and continue working on it later;
- import an image as a new frame;
- export the finished animation as a GIF or a ZIP archive of PNG frames.

Work is saved automatically in the browser's local storage. The editor also includes light and dark themes and keyboard shortcuts for common actions.

## Getting started

You will need Node.js 18 or newer.

```bash
git clone https://github.com/AndreiPabiarzhyn/kodland-animator-lab-andrei-pabiarzhyn.git
cd kodland-animator-lab-andrei-pabiarzhyn
npm install
npm run dev
```

Vite will print the local address in the terminal, usually `http://localhost:5173`.

## Available commands

```bash
npm run dev      # start the development server
npm run build    # create a production build
npm run preview  # preview the production build
npm run lint     # run ESLint
npm test         # run the Vitest test suite
```

## Tech stack

The app is built with React, TypeScript, and Vite. The interface uses Tailwind CSS and Radix UI components, while Zustand manages application state. GIF.js, JSZip, and FileSaver handle file exports.

## Author

Created by **Andrei Pobiarzhyn** with the help of [Lovable](https://lovable.dev/), an AI-powered development platform.
