"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { usePathname } from "next/navigation";

type Rect = { left: number; top: number; width: number; height: number };
type Gesture = { mode: "drag" | "resize"; edges: string; x: number; y: number; rect: Rect };
type Operator = "+" | "−" | "×" | "÷";

const MIN_WIDTH = 300;
const MIN_HEIGHT = 440;

function numeric(value: string) {
  const parsed = Number(value.replace("−", "-").replaceAll(".", "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function displayNumber(value: number) {
  if (!Number.isFinite(value)) return "Error";
  return String(Number(value.toPrecision(10))).replace(".", ",");
}

export function CalculatorBubble() {
  const pathname = usePathname();
  return pathname.startsWith("/liqui") ? <CalculatorPanel key={pathname} /> : null;
}

function CalculatorPanel() {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<Rect | null>(null);
  const [screen, setScreen] = useState("0");
  const [stored, setStored] = useState<number | null>(null);
  const [operator, setOperator] = useState<Operator | null>(null);
  const [replaceScreen, setReplaceScreen] = useState(false);
  const [memory, setMemory] = useState(0);
  const gesture = useRef<Gesture | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  function clampRect(next: Rect): Rect {
    const width = Math.max(MIN_WIDTH, Math.min(next.width, window.innerWidth - 20));
    const height = Math.max(MIN_HEIGHT, Math.min(next.height, window.innerHeight - 20));
    return {
      width,
      height,
      left: Math.max(10, Math.min(next.left, window.innerWidth - width - 10)),
      top: Math.max(10, Math.min(next.top, window.innerHeight - height - 10)),
    };
  }

  function startGesture(event: PointerEvent<HTMLElement>, mode: Gesture["mode"], edges = "") {
    event.preventDefault();
    event.stopPropagation();
    const box = panelRef.current?.getBoundingClientRect();
    if (!box) return;
    const current = { left: box.left, top: box.top, width: box.width, height: box.height };
    setRect(current);
    gesture.current = { mode, edges, x: event.clientX, y: event.clientY, rect: current };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveGesture(event: PointerEvent<HTMLElement>) {
    const current = gesture.current;
    if (!current) return;
    const dx = event.clientX - current.x;
    const dy = event.clientY - current.y;
    if (current.mode === "drag") {
      setRect(clampRect({ ...current.rect, left: current.rect.left + dx, top: current.rect.top + dy }));
      return;
    }
    let { left, top, width, height } = current.rect;
    if (current.edges.includes("e")) width += dx;
    if (current.edges.includes("s")) height += dy;
    if (current.edges.includes("w")) { left += dx; width -= dx; }
    if (current.edges.includes("n")) { top += dy; height -= dy; }
    if (width < MIN_WIDTH) { if (current.edges.includes("w")) left -= MIN_WIDTH - width; width = MIN_WIDTH; }
    if (height < MIN_HEIGHT) { if (current.edges.includes("n")) top -= MIN_HEIGHT - height; height = MIN_HEIGHT; }
    setRect(clampRect({ left, top, width, height }));
  }

  function endGesture(event: PointerEvent<HTMLElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    gesture.current = null;
  }

  function reset() {
    setScreen("0"); setStored(null); setOperator(null); setReplaceScreen(false);
  }

  function press(key: string) {
    if (/^\d$/.test(key)) {
      setScreen((current) => replaceScreen || current === "0" || current === "Error" ? key : current.length < 16 ? current + key : current);
      setReplaceScreen(false); return;
    }
    if (key === ",") {
      setScreen((current) => replaceScreen || current === "Error" ? "0," : current.includes(",") ? current : current + ",");
      setReplaceScreen(false); return;
    }
    if (key === "C") { reset(); return; }
    if (key === "CE") { setScreen("0"); setReplaceScreen(false); return; }
    if (key === "⌫") { setScreen((current) => current.length <= 1 || current === "Error" ? "0" : current.slice(0, -1)); return; }
    if (key === "+/−") { setScreen((current) => current === "0" || current === "Error" ? current : current.startsWith("−") ? current.slice(1) : `−${current}`); return; }
    if (key === "%") { setScreen((current) => displayNumber(numeric(current) / 100)); setReplaceScreen(true); return; }
    if (key === "1/x") { setScreen((current) => numeric(current) === 0 ? "Error" : displayNumber(1 / numeric(current))); setReplaceScreen(true); return; }
    if (key === "x²") { setScreen((current) => displayNumber(numeric(current) ** 2)); setReplaceScreen(true); return; }
    if (key === "√x") { setScreen((current) => numeric(current) < 0 ? "Error" : displayNumber(Math.sqrt(numeric(current)))); setReplaceScreen(true); return; }
    if (key === "M+") { setMemory((current) => current + numeric(screen)); return; }
    if (key === "M−") { setMemory((current) => current - numeric(screen)); return; }
    if (key === "MS") { setMemory(numeric(screen)); return; }
    if (key === "MR") { setScreen(displayNumber(memory)); setReplaceScreen(true); return; }
    if (key === "MC") { setMemory(0); return; }
    if (["+", "−", "×", "÷"].includes(key)) {
      const value = numeric(screen);
      if (operator && stored !== null && !replaceScreen) {
        const result = calculate(stored, value, operator);
        setScreen(displayNumber(result)); setStored(result);
      } else setStored(value);
      setOperator(key as Operator); setReplaceScreen(true); return;
    }
    if (key === "=") {
      if (operator && stored !== null) {
        setScreen(displayNumber(calculate(stored, numeric(screen), operator)));
        setStored(null); setOperator(null); setReplaceScreen(true);
      }
    }
  }

  const style = rect
    ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
    : undefined;

  return <>
    <button type="button" className="calculator-bubble" onClick={() => setOpen((value) => !value)} aria-label={open ? "Cerrar calculadora" : "Abrir calculadora"} title="Calculadora">
      <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8v3H8zM8 14h2m4 0h2m-8 3h2m4 0h2"/></svg>
      <span>Calc</span>
    </button>
    {open && <section ref={panelRef} className="calculator-panel" style={style} role="dialog" aria-label="Calculadora" onPointerMove={moveGesture} onPointerUp={endGesture} onPointerCancel={endGesture}>
      <header className="calculator-header" onPointerDown={(event) => startGesture(event, "drag")}>
        <span className="calculator-grip" aria-hidden="true">⠿</span><h2>Calculadora</h2>
        <button type="button" className="calculator-close" onPointerDown={(event) => event.stopPropagation()} onClick={() => setOpen(false)} aria-label="Cerrar calculadora">×</button>
      </header>
      <div className="calculator-display" aria-live="polite"><span>{operator && stored !== null ? `${displayNumber(stored)} ${operator}` : ""}</span><strong>{screen}</strong></div>
      <div className="calculator-memory">{["MC", "MR", "M+", "M−", "MS"].map((key) => <button type="button" key={key} disabled={(key === "MC" || key === "MR") && memory === 0} onClick={() => press(key)}>{key}</button>)}</div>
      <div className="calculator-keys">{["%", "CE", "C", "⌫", "1/x", "x²", "√x", "÷", "7", "8", "9", "×", "4", "5", "6", "−", "1", "2", "3", "+", "+/−", "0", ",", "="].map((key) => <button type="button" key={key} className={`${["÷", "×", "−", "+"].includes(key) ? "is-operator" : ""} ${key === "=" ? "is-equals" : ""}`} onClick={() => press(key)}>{key}</button>)}</div>
      {["nw", "ne", "sw", "se"].map((corner) => <span key={corner} className={`calculator-resize calculator-resize-${corner}`} onPointerDown={(event) => startGesture(event, "resize", corner)} aria-hidden="true"/>)}
    </section>}
  </>;
}

function calculate(left: number, right: number, operator: Operator) {
  if (operator === "+") return left + right;
  if (operator === "−") return left - right;
  if (operator === "×") return left * right;
  return right === 0 ? Number.NaN : left / right;
}
