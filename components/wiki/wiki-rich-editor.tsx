"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { TableKit } from "@tiptap/extension-table";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import { Color, FontSize, TextStyle } from "@tiptap/extension-text-style";
import { useEffect } from "react";
import { serializeWikiDocument, wikiEditorDocument } from "./wiki-content";

const extensions = [
  StarterKit,
  TaskList,
  TaskItem.configure({ nested: true }),
  TableKit.configure({ table: { resizable: true } }),
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  Highlight.configure({ multicolor: true }),
  TextStyle,
  Color,
  FontSize,
];

function Tool({ editor, label, text = label, action, active = false, disabled = false }: { editor: Editor; label: string; text?: string; action: () => void; active?: boolean; disabled?: boolean }) {
  return <button type="button" className={`wiki-editor-tool${active ? " is-active" : ""}`} onClick={action} disabled={disabled} aria-label={label} title={label}>{text}</button>;
}

function Toolbar({ editor }: { editor: Editor }) {
  const setHeading = (value: string) => value === "paragraph" ? editor.chain().focus().setParagraph().run() : editor.chain().focus().toggleHeading({ level: Number(value) as 1 | 2 | 3 }).run();
  const addLink = () => {
    const current = editor.getAttributes("link").href as string | undefined;
    const value = window.prompt("Dirección del enlace", current ?? "https://");
    if (value === null) return;
    if (!value.trim()) editor.chain().focus().unsetLink().run();
    else editor.chain().focus().setLink({ href: value.trim() }).run();
  };
  return <div className="wiki-editor-toolbar" role="toolbar" aria-label="Formato del contenido">
    <select aria-label="Estilo de texto" value={editor.isActive("heading", { level: 1 }) ? "1" : editor.isActive("heading", { level: 2 }) ? "2" : editor.isActive("heading", { level: 3 }) ? "3" : "paragraph"} onChange={(event) => setHeading(event.target.value)}>
      <option value="paragraph">Párrafo</option><option value="1">Título 1</option><option value="2">Título 2</option><option value="3">Título 3</option>
    </select>
    <select aria-label="Tamaño de letra" defaultValue="" onChange={(event) => { if (event.target.value) editor.chain().focus().setFontSize(event.target.value).run(); }}><option value="">Tamaño</option><option value="12px">12</option><option value="14px">14</option><option value="16px">16</option><option value="20px">20</option><option value="24px">24</option><option value="32px">32</option></select>
    <span className="wiki-editor-divider" />
    <Tool editor={editor} label="Negrita" text="B" action={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} />
    <Tool editor={editor} label="Cursiva" text="I" action={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} />
    <Tool editor={editor} label="Subrayado" text="U" action={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} />
    <Tool editor={editor} label="Tachado" text="S" action={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} />
    <label className="wiki-editor-color" title="Color de texto" aria-label="Color de texto">A<input type="color" defaultValue="#267fbd" onChange={(event) => editor.chain().focus().setColor(event.target.value).run()} /></label>
    <Tool editor={editor} label="Resaltar" action={() => editor.chain().focus().toggleHighlight().run()} active={editor.isActive("highlight")} />
    <span className="wiki-editor-divider" />
    <Tool editor={editor} label="Alinear a la izquierda" text="≡" action={() => editor.chain().focus().setTextAlign("left").run()} active={editor.isActive({ textAlign: "left" })} />
    <Tool editor={editor} label="Centrar" text="☷" action={() => editor.chain().focus().setTextAlign("center").run()} active={editor.isActive({ textAlign: "center" })} />
    <Tool editor={editor} label="Alinear a la derecha" text="≡" action={() => editor.chain().focus().setTextAlign("right").run()} active={editor.isActive({ textAlign: "right" })} />
    <span className="wiki-editor-divider" />
    <Tool editor={editor} label="Lista con viñetas" text="•" action={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} />
    <Tool editor={editor} label="Lista numerada" text="1." action={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} />
    <Tool editor={editor} label="Lista con casillas" text="☑" action={() => editor.chain().focus().toggleTaskList().run()} active={editor.isActive("taskList")} />
    <Tool editor={editor} label="Cita" text="❝" action={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} />
    <Tool editor={editor} label="Enlace" text="↗" action={addLink} active={editor.isActive("link")} />
    <span className="wiki-editor-divider" />
    <Tool editor={editor} label="Insertar tabla" text="▦" action={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} />
    <Tool editor={editor} label="Agregar fila" text="+F" action={() => editor.chain().focus().addRowAfter().run()} disabled={!editor.isActive("table")} />
    <Tool editor={editor} label="Agregar columna" text="+C" action={() => editor.chain().focus().addColumnAfter().run()} disabled={!editor.isActive("table")} />
    <Tool editor={editor} label="Eliminar fila" text="−F" action={() => editor.chain().focus().deleteRow().run()} disabled={!editor.isActive("table")} />
    <Tool editor={editor} label="Eliminar columna" text="−C" action={() => editor.chain().focus().deleteColumn().run()} disabled={!editor.isActive("table")} />
    <Tool editor={editor} label="Eliminar tabla" text="×T" action={() => editor.chain().focus().deleteTable().run()} disabled={!editor.isActive("table")} />
    <span className="wiki-editor-divider" />
    <Tool editor={editor} label="Deshacer" text="↶" action={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} />
    <Tool editor={editor} label="Rehacer" text="↷" action={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} />
  </div>;
}

export function WikiRichEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const editor = useEditor({
    extensions,
    content: wikiEditorDocument(value),
    immediatelyRender: false,
    onUpdate: ({ editor: current }) => onChange(serializeWikiDocument(current.getJSON())),
    editorProps: { attributes: { class: "wiki-editor-surface", "aria-label": "Información de la publicación" } },
  });

  useEffect(() => {
    if (editor && value && editor.isEmpty) editor.commands.setContent(wikiEditorDocument(value));
  }, [editor, value]);

  if (!editor) return <div className="wiki-rich-editor wiki-rich-editor-loading">Cargando editor…</div>;
  return <div className="wiki-rich-editor"><Toolbar editor={editor}/><EditorContent editor={editor}/></div>;
}

export function WikiRichContent({ content }: { content: string }) {
  const editor = useEditor({ extensions, content: wikiEditorDocument(content), editable: false, immediatelyRender: false, editorProps: { attributes: { class: "wiki-editor-surface wiki-editor-readonly" } } });
  if (!editor) return null;
  return <div className="wiki-rich-content"><EditorContent editor={editor}/></div>;
}
