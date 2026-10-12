// Shared component catalogue for the docs site skeleton.
// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).

export interface PreviewComponent {
  slug: string;
  title: string;
  description: string;
}

export const SITE_TAGLINE =
  "Svelte 5 component library for document-heavy apps: PDF, DOCX, XLSX, PPTX and CSV viewers and editors, file handling, and data-display primitives.";

export const PREVIEW_COMPONENTS: PreviewComponent[] = [
  {
    slug: "file-upload",
    title: "File Upload",
    description:
      "Drag-and-drop file picker with validation and per-file progress.",
  },
  {
    slug: "csv-tsv-viewer",
    title: "CSV/TSV Viewer",
    description: "Virtualized table viewer for CSV and TSV files.",
  },
  {
    slug: "document-viewer-sidebar",
    title: "Document Viewer Sidebar",
    description:
      "Sidebar shell for page thumbnails and outline next to a viewer.",
  },
  {
    slug: "file-thumbnail",
    title: "File Thumbnail",
    description: "Small preview tile that renders a file by type.",
  },
  {
    slug: "pdf-viewer",
    title: "PDF Viewer",
    description: "Virtualized PDF pages with zoom, search, and text selection.",
  },
  {
    slug: "docx-viewer",
    title: "DOCX Viewer",
    description: "Read-only rendering of Word documents.",
  },
  {
    slug: "xlsx-viewer",
    title: "XLSX Viewer",
    description: "Spreadsheet viewer with sheet tabs and virtualized rows.",
  },
  {
    slug: "pptx-viewer",
    title: "PPTX Viewer",
    description: "Slide viewer with a thumbnail list for PowerPoint decks.",
  },
  {
    slug: "pdf-editor",
    title: "PDF Editor",
    description: "PDF viewer with annotation and page editing tools.",
  },
  {
    slug: "docx-editor",
    title: "DOCX Editor",
    description: "In-browser editor for Word documents.",
  },
  {
    slug: "xlsx-editor",
    title: "XLSX Editor",
    description: "Spreadsheet editor with editable cells and sheet tabs.",
  },
  {
    slug: "file-system",
    title: "File System",
    description: "Folder and file tree with selection and navigation.",
  },
  {
    slug: "document-splits",
    title: "Document Splits",
    description: "Split a document into labeled page ranges.",
  },
  {
    slug: "schema-builder",
    title: "Schema Builder",
    description: "Visual editor for extraction schemas and their fields.",
  },
  {
    slug: "layout-blocks",
    title: "Layout Blocks",
    description:
      "Display parsed layout blocks such as text, tables, and figures.",
  },
  {
    slug: "bounding-box-citations",
    title: "Bounding Box Citations",
    description: "Highlight cited regions on a page with bounding boxes.",
  },
  {
    slug: "e-signature",
    title: "E-Signature",
    description: "Signature pad for drawing or typing a signature.",
  },
  {
    slug: "group",
    title: "Group",
    description: "Container that joins related controls into one visual unit.",
  },
  {
    slug: "color-picker",
    title: "Color Picker",
    description: "Color selector with swatches and hex input.",
  },
  {
    slug: "toggle",
    title: "Toggle",
    description: "Two-state button with a controlled pressed value.",
  },
];
