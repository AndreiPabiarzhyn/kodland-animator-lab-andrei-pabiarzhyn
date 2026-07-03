<div align="center">
  <img src="./public/favicon.ico" width="72" height="72" alt="KodFlip">

  # KodFlip

  Небольшая браузерная студия для покадровой анимации.

  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white" alt="React 18">
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" alt="TypeScript 5">
  <img src="https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white" alt="Vite 5">
  <img src="https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?logo=tailwindcss&logoColor=white" alt="Tailwind CSS 3">
</div>

## Что умеет

В KodFlip можно нарисовать анимацию по кадрам прямо в браузере:

- рисовать карандашом, ластиком, заливкой и геометрическими фигурами;
- использовать зеркальное рисование, пипетку и выделение с трансформацией;
- работать со слоями: добавлять, копировать, переименовывать и менять порядок;
- видеть соседние кадры через onion skin;
- добавлять, копировать, удалять и переставлять кадры на таймлайне;
- настраивать частоту кадров и зацикленное воспроизведение;
- сохранять проект в JSON и открывать его позже;
- импортировать изображение как новый кадр;
- экспортировать результат в GIF или ZIP-архив с PNG-кадрами.

Изменения автоматически сохраняются в локальном хранилище браузера. Есть светлая и тёмная темы, а для основных действий предусмотрены горячие клавиши.

## Запуск

Понадобится Node.js 18 или новее.

```bash
git clone https://github.com/AndreiPabiarzhyn/kodland-animator-lab-andrei-pabiarzhyn.git
cd kodland-animator-lab-andrei-pabiarzhyn
npm install
npm run dev
```

После запуска Vite покажет адрес приложения в терминале — обычно это `http://localhost:5173`.

## Полезные команды

```bash
npm run dev      # режим разработки
npm run build    # production-сборка
npm run preview  # просмотр готовой сборки
npm run lint     # проверка ESLint
npm test         # тесты Vitest
```

## Стек

Основа проекта — React, TypeScript и Vite. Интерфейс собран с Tailwind CSS и компонентами Radix UI, состояние хранится в Zustand. За создание файлов отвечают `gif.js`, JSZip и FileSaver.

## Об авторе

Проект создал **Andrei Pobiarzhyn**. При разработке использовался AI-сервис [Lovable](https://lovable.dev/).
