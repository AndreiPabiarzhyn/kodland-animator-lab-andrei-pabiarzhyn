import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type Language = "en" | "ru" | "pl" | "es" | "pt" | "it" | "tr" | "id";

export const LANGUAGES: Array<{ id: Language; label: string }> = [
  { id: "en", label: "English" },
  { id: "ru", label: "Русский" },
  { id: "pl", label: "Polski" },
  { id: "es", label: "Español" },
  { id: "pt", label: "Português" },
  { id: "it", label: "Italiano" },
  { id: "tr", label: "Türkçe" },
  { id: "id", label: "Bahasa Indonesia" },
];

export type TranslationKey =
  | "tools" | "tip" | "shift" | "drag" | "preview" | "layers" | "color" | "size" | "opacity"
  | "mirrorAxis" | "horizontal" | "vertical" | "both" | "style" | "outline" | "fill" | "onionSkin"
  | "play" | "pause" | "frame" | "duplicate" | "delete" | "loop" | "fps" | "addFrame" | "zoomIn"
  | "zoomOut" | "centerFit" | "projectName" | "undo" | "redo" | "new" | "export" | "open" | "animatedGif"
  | "pngSequence" | "saveProject" | "openProject" | "importImage" | "help" | "toggleTheme" | "newAnimation"
  | "chooseCanvas" | "width" | "height" | "cancel" | "create" | "keyboardShortcuts" | "speedWorkflow"
  | "createdBy" | "version" | "language" | "pencil" | "eraser" | "mirrorPen" | "rectangle" | "ellipse"
  | "line" | "selectTransform" | "colorPicker" | "movePan" | "pickCustomColor" | "brushSize" | "addLayer"
  | "duplicateLayer" | "deleteLayer" | "hideLayer" | "showLayer" | "renameLayer" | "gifExported" | "gifExportFailed"
  | "pngSaved" | "exportFailed" | "projectLoaded" | "projectLoadFailed" | "imageImported" | "imageImportFailed"
  | "newProjectCreated";

type Dictionary = Record<TranslationKey, string>;

const en: Dictionary = {
  tools: "Tools", tip: "Tip: scroll to zoom, hold", shift: "Shift", drag: "+ drag to pan.", preview: "Preview", layers: "Layers",
  color: "Color", size: "Size", opacity: "Opacity", mirrorAxis: "Mirror Axis", horizontal: "horizontal", vertical: "vertical", both: "both",
  style: "Style", outline: "Outline", fill: "Fill", onionSkin: "Onion Skin", play: "Play", pause: "Pause", frame: "Frame", duplicate: "Duplicate",
  delete: "Delete", loop: "Loop", fps: "FPS", addFrame: "Add frame", zoomIn: "Zoom in", zoomOut: "Zoom out", centerFit: "Center & fit",
  projectName: "Project name", undo: "Undo", redo: "Redo", new: "New", export: "Export", open: "Open", animatedGif: "Animated GIF",
  pngSequence: "PNG sequence (.zip)", saveProject: "Save project (.json)", openProject: "Open project (.json)", importImage: "Import image as frame",
  help: "Help", toggleTheme: "Toggle theme", newAnimation: "New animation", chooseCanvas: "Choose your canvas size. You can change it any time.",
  width: "Width", height: "Height", cancel: "Cancel", create: "Create", keyboardShortcuts: "Keyboard shortcuts", speedWorkflow: "Speed up your workflow!",
  createdBy: "Created by", version: "Application version 0.21", language: "Language", pencil: "Pencil", eraser: "Eraser", mirrorPen: "Mirror Pen",
  rectangle: "Rectangle", ellipse: "Ellipse", line: "Line", selectTransform: "Select / Transform", colorPicker: "Color Picker", movePan: "Move / Pan",
  pickCustomColor: "Pick custom color", brushSize: "Brush size", addLayer: "Add layer", duplicateLayer: "Duplicate layer", deleteLayer: "Delete layer",
  hideLayer: "Hide layer", showLayer: "Show layer", renameLayer: "Double-click to rename", gifExported: "GIF exported!", gifExportFailed: "GIF export failed",
  pngSaved: "PNG sequence saved!", exportFailed: "Export failed", projectLoaded: "Project loaded", projectLoadFailed: "Could not load project",
  imageImported: "Image imported as frame", imageImportFailed: "Could not import image", newProjectCreated: "New project!",
};

const translations: Record<Language, Partial<Dictionary>> = {
  en,
  ru: { tools: "Инструменты", tip: "Совет: прокручивайте для масштаба, удерживайте", shift: "Shift", drag: "+ перетаскивайте для панорамирования.", preview: "Предпросмотр", layers: "Слои", color: "Цвет", size: "Размер", opacity: "Непрозрачность", mirrorAxis: "Ось отражения", horizontal: "горизонталь", vertical: "вертикаль", both: "обе", style: "Стиль", outline: "Контур", fill: "Заливка", onionSkin: "Луковая кожа", play: "Воспроизвести", pause: "Пауза", frame: "Кадр", duplicate: "Дублировать", delete: "Удалить", loop: "Цикл", addFrame: "Добавить кадр", zoomIn: "Увеличить", zoomOut: "Уменьшить", centerFit: "По центру", undo: "Отменить", redo: "Повторить", new: "Новый", export: "Экспорт", open: "Открыть", help: "Помощь", language: "Язык", version: "Версия приложения 0.21", createdBy: "Создано", newAnimation: "Новая анимация", chooseCanvas: "Выберите размер холста. Его можно изменить позже.", width: "Ширина", height: "Высота", cancel: "Отмена", create: "Создать", keyboardShortcuts: "Горячие клавиши", speedWorkflow: "Ускорьте работу!", pencil: "Карандаш", eraser: "Ластик", mirrorPen: "Зеркальная кисть", rectangle: "Прямоугольник", ellipse: "Эллипс", line: "Линия", selectTransform: "Выбор / трансформация", colorPicker: "Пипетка", movePan: "Перемещение", addLayer: "Добавить слой", duplicateLayer: "Дублировать слой", deleteLayer: "Удалить слой", hideLayer: "Скрыть слой", showLayer: "Показать слой", renameLayer: "Двойной щелчок для переименования", gifExported: "GIF экспортирован!", gifExportFailed: "Не удалось экспортировать GIF", pngSaved: "PNG сохранены!", exportFailed: "Ошибка экспорта", projectLoaded: "Проект загружен", projectLoadFailed: "Не удалось загрузить проект", imageImported: "Изображение добавлено как кадр", imageImportFailed: "Не удалось импортировать изображение", newProjectCreated: "Новый проект!" },
  pl: { tools: "Narzędzia", preview: "Podgląd", layers: "Warstwy", color: "Kolor", size: "Rozmiar", opacity: "Przezroczystość", onionSkin: "Skórka cebuli", play: "Odtwórz", pause: "Pauza", frame: "Klatka", duplicate: "Duplikuj", delete: "Usuń", loop: "Pętla", addFrame: "Dodaj klatkę", undo: "Cofnij", redo: "Ponów", new: "Nowy", export: "Eksportuj", open: "Otwórz", help: "Pomoc", language: "Język", version: "Wersja aplikacji 0.21", createdBy: "Autor", newAnimation: "Nowa animacja", chooseCanvas: "Wybierz rozmiar płótna. Możesz go zmienić później.", width: "Szerokość", height: "Wysokość", cancel: "Anuluj", create: "Utwórz", keyboardShortcuts: "Skróty klawiszowe", pencil: "Ołówek", eraser: "Gumka", mirrorPen: "Lustrzane pióro", rectangle: "Prostokąt", ellipse: "Elipsa", line: "Linia", selectTransform: "Zaznacz / przekształć", colorPicker: "Pipeta", movePan: "Przesuń", style: "Styl", outline: "Kontur", fill: "Wypełnienie", addLayer: "Dodaj warstwę", duplicateLayer: "Duplikuj warstwę", deleteLayer: "Usuń warstwę", hideLayer: "Ukryj warstwę", showLayer: "Pokaż warstwę", gifExported: "GIF wyeksportowany!", projectLoaded: "Projekt wczytany!" },
  es: { tools: "Herramientas", preview: "Vista previa", layers: "Capas", color: "Color", size: "Tamaño", opacity: "Opacidad", onionSkin: "Piel de cebolla", play: "Reproducir", pause: "Pausa", frame: "Fotograma", duplicate: "Duplicar", delete: "Eliminar", loop: "Bucle", addFrame: "Añadir fotograma", undo: "Deshacer", redo: "Rehacer", new: "Nuevo", export: "Exportar", open: "Abrir", help: "Ayuda", language: "Idioma", version: "Versión de la aplicación 0.21", createdBy: "Creado por", newAnimation: "Nueva animación", chooseCanvas: "Elige el tamaño del lienzo. Puedes cambiarlo después.", width: "Ancho", height: "Alto", cancel: "Cancelar", create: "Crear", keyboardShortcuts: "Atajos de teclado", pencil: "Lápiz", eraser: "Borrador", mirrorPen: "Pincel espejo", rectangle: "Rectángulo", ellipse: "Elipse", line: "Línea", selectTransform: "Seleccionar / transformar", colorPicker: "Selector de color", movePan: "Mover / desplazar", style: "Estilo", outline: "Contorno", fill: "Relleno", addLayer: "Añadir capa", duplicateLayer: "Duplicar capa", deleteLayer: "Eliminar capa", hideLayer: "Ocultar capa", showLayer: "Mostrar capa" },
  pt: { tools: "Ferramentas", preview: "Pré-visualização", layers: "Camadas", color: "Cor", size: "Tamanho", opacity: "Opacidade", onionSkin: "Pele de cebola", play: "Reproduzir", pause: "Pausa", frame: "Quadro", duplicate: "Duplicar", delete: "Excluir", loop: "Loop", addFrame: "Adicionar quadro", undo: "Desfazer", redo: "Refazer", new: "Novo", export: "Exportar", open: "Abrir", help: "Ajuda", language: "Idioma", version: "Versão do aplicativo 0.21", createdBy: "Criado por", newAnimation: "Nova animação", chooseCanvas: "Escolha o tamanho da tela. Você pode alterá-lo depois.", width: "Largura", height: "Altura", cancel: "Cancelar", create: "Criar", keyboardShortcuts: "Atalhos do teclado", pencil: "Lápis", eraser: "Borracha", mirrorPen: "Pincel espelho", rectangle: "Retângulo", ellipse: "Elipse", line: "Linha", selectTransform: "Selecionar / transformar", colorPicker: "Seletor de cor", movePan: "Mover / deslocar", style: "Estilo", outline: "Contorno", fill: "Preenchimento", addLayer: "Adicionar camada", duplicateLayer: "Duplicar camada", deleteLayer: "Excluir camada" },
  it: { tools: "Strumenti", preview: "Anteprima", layers: "Livelli", color: "Colore", size: "Dimensione", opacity: "Opacità", onionSkin: "Pellicola", play: "Riproduci", pause: "Pausa", frame: "Fotogramma", duplicate: "Duplica", delete: "Elimina", loop: "Ciclo", addFrame: "Aggiungi fotogramma", undo: "Annulla", redo: "Ripristina", new: "Nuovo", export: "Esporta", open: "Apri", help: "Aiuto", language: "Lingua", version: "Versione app 0.21", createdBy: "Creato da", newAnimation: "Nuova animazione", chooseCanvas: "Scegli la dimensione della tela. Puoi modificarla in seguito.", width: "Larghezza", height: "Altezza", cancel: "Annulla", create: "Crea", keyboardShortcuts: "Scorciatoie da tastiera", pencil: "Matita", eraser: "Gomma", mirrorPen: "Pennello specchio", rectangle: "Rettangolo", ellipse: "Ellisse", line: "Linea", selectTransform: "Seleziona / trasforma", colorPicker: "Contagocce", movePan: "Sposta", style: "Stile", outline: "Contorno", fill: "Riempimento", addLayer: "Aggiungi livello", duplicateLayer: "Duplica livello", deleteLayer: "Elimina livello" },
  tr: { tools: "Araçlar", preview: "Önizleme", layers: "Katmanlar", color: "Renk", size: "Boyut", opacity: "Opaklık", onionSkin: "Soğan kabuğu", play: "Oynat", pause: "Duraklat", frame: "Kare", duplicate: "Çoğalt", delete: "Sil", loop: "Döngü", addFrame: "Kare ekle", undo: "Geri al", redo: "Yinele", new: "Yeni", export: "Dışa aktar", open: "Aç", help: "Yardım", language: "Dil", version: "Uygulama sürümü 0.21", createdBy: "Oluşturan", newAnimation: "Yeni animasyon", chooseCanvas: "Tuval boyutunu seçin. Daha sonra değiştirebilirsiniz.", width: "Genişlik", height: "Yükseklik", cancel: "İptal", create: "Oluştur", keyboardShortcuts: "Klavye kısayolları", pencil: "Kalem", eraser: "Silgi", mirrorPen: "Ayna kalemi", rectangle: "Dikdörtgen", ellipse: "Elips", line: "Çizgi", selectTransform: "Seç / dönüştür", colorPicker: "Renk seçici", movePan: "Taşı / kaydır", style: "Stil", outline: "Kontur", fill: "Dolgu", addLayer: "Katman ekle", duplicateLayer: "Katmanı çoğalt", deleteLayer: "Katmanı sil" },
  id: { tools: "Alat", preview: "Pratinjau", layers: "Lapisan", color: "Warna", size: "Ukuran", opacity: "Opasitas", onionSkin: "Onion skin", play: "Putar", pause: "Jeda", frame: "Frame", duplicate: "Duplikat", delete: "Hapus", loop: "Ulangi", addFrame: "Tambah frame", undo: "Urungkan", redo: "Ulangi lagi", new: "Baru", export: "Ekspor", open: "Buka", help: "Bantuan", language: "Bahasa", version: "Versi aplikasi 0.21", createdBy: "Dibuat oleh", newAnimation: "Animasi baru", chooseCanvas: "Pilih ukuran kanvas. Kamu dapat mengubahnya nanti.", width: "Lebar", height: "Tinggi", cancel: "Batal", create: "Buat", keyboardShortcuts: "Pintasan keyboard", pencil: "Pensil", eraser: "Penghapus", mirrorPen: "Kuas cermin", rectangle: "Persegi panjang", ellipse: "Elips", line: "Garis", selectTransform: "Pilih / transformasi", colorPicker: "Pemilih warna", movePan: "Pindah / geser", style: "Gaya", outline: "Garis luar", fill: "Isi", addLayer: "Tambah lapisan", duplicateLayer: "Duplikat lapisan", deleteLayer: "Hapus lapisan" },
};

const LANGUAGE_KEY = "kodflip:language";
const I18nContext = createContext<{ language: Language; setLanguage: (language: Language) => void; t: (key: TranslationKey) => string } | null>(null);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const stored = localStorage.getItem(LANGUAGE_KEY) as Language | null;
    return stored && LANGUAGES.some((item) => item.id === stored) ? stored : "en";
  });
  const setLanguage = (next: Language) => { setLanguageState(next); localStorage.setItem(LANGUAGE_KEY, next); };
  const value = useMemo(() => ({ language, setLanguage, t: (key: TranslationKey) => translations[language][key] ?? en[key] }), [language]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = () => {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside LanguageProvider");
  return value;
};
