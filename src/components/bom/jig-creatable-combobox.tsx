"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  JIG_NONE_UI_LABEL,
  JIG_MODEL_NO_NEED,
  normalizeJigModelInputForStorage,
} from "@/lib/bom-jig-status";

/** @deprecated 使用 JIG_NONE_UI_LABEL */
export const JIG_NONE_LABEL = JIG_NONE_UI_LABEL;

/** @deprecated 使用 normalizeJigModelInputForStorage */
export function normalizeJigModelInput(raw: string): string | null {
  return normalizeJigModelInputForStorage(raw);
}

type JigCreatableComboboxProps = {
  itemId: string;
  jigModel: string | null;
  jigOptions: string[];
  disabled?: boolean;
  /** 供 ⚡ 全厂穿透读取当前框内文本（含未提交的输入） */
  onLiveDraftChange?: (draft: string) => void;
  /** 失焦 / 回车 / 点选列表后提交；由父组件决定是否调用 Server Action */
  onCommit: (next: string | null) => void;
};

export function JigCreatableCombobox({
  itemId,
  jigModel,
  jigOptions,
  disabled,
  onLiveDraftChange,
  onCommit,
}: JigCreatableComboboxProps) {
  const serverDisplay = jigModel?.trim() ? jigModel.trim() : "";
  const [draft, setDraft] = useState(serverDisplay);
  const [open, setOpen] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const liveCbRef = useRef(onLiveDraftChange);
  liveCbRef.current = onLiveDraftChange;

  useEffect(() => {
    const j = jigModel?.trim() ? jigModel.trim() : "";
    setDraft(j);
    liveCbRef.current?.(j);
  }, [itemId, jigModel]);

  useEffect(() => {
    liveCbRef.current?.(draft);
  }, [draft]);

  const clearBlurTimer = () => {
    if (blurTimer.current) {
      clearTimeout(blurTimer.current);
      blurTimer.current = null;
    }
  };

  const commitDraft = useCallback(() => {
    const next = normalizeJigModelInputForStorage(draft);
    onCommit(next);
    setOpen(false);
  }, [draft, onCommit]);

  const pickLibraryValue = useCallback(
    (value: string | null) => {
      clearBlurTimer();
      if (value === null) {
        setDraft("");
        onCommit(null);
      } else {
        setDraft(value);
        onCommit(value);
      }
      setOpen(false);
    },
    [onCommit]
  );

  const q = draft.trim().toLowerCase();
  const filteredOptions = jigOptions.filter((m) =>
    q === "" ? true : m.toLowerCase().includes(q)
  );

  const draftAsCommit = normalizeJigModelInputForStorage(draft);
  const showUseTyped =
    draft.trim() !== "" &&
    draftAsCommit !== null &&
    !jigOptions.includes(draftAsCommit);

  return (
    <div ref={containerRef} className="relative w-56 min-w-[14rem]">
      <Input
        type="text"
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
        value={draft}
        placeholder={JIG_NONE_UI_LABEL}
        className="h-9 font-mono text-sm"
        onFocus={() => {
          clearBlurTimer();
          setOpen(true);
        }}
        onBlur={() => {
          blurTimer.current = setTimeout(() => {
            blurTimer.current = null;
            if (!containerRef.current?.contains(document.activeElement)) {
              commitDraft();
            }
          }, 180);
        }}
        onChange={(e) => {
          setDraft(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            clearBlurTimer();
            commitDraft();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            const reset = jigModel?.trim() ? jigModel.trim() : "";
            setDraft(reset);
            liveCbRef.current?.(reset);
            setOpen(false);
          }
        }}
      />

      {open && !disabled && (
        <div
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-auto rounded-md border border-slate-200 bg-white py-1 text-sm shadow-md"
          role="listbox"
        >
          <button
            type="button"
            role="option"
            className="flex w-full cursor-pointer px-3 py-2 text-left text-muted-foreground hover:bg-slate-100"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => pickLibraryValue(JIG_MODEL_NO_NEED)}
          >
            {JIG_NONE_UI_LABEL}
          </button>
          {filteredOptions.map((m) => (
            <button
              key={m}
              type="button"
              role="option"
              className={cn(
                "flex w-full cursor-pointer px-3 py-2 text-left font-mono text-xs hover:bg-slate-100"
              )}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pickLibraryValue(m)}
            >
              {m}
            </button>
          ))}
          {showUseTyped && draftAsCommit && (
            <button
              type="button"
              role="option"
              className="border-t border-slate-100 px-3 py-2 text-left text-xs font-medium text-amber-700 hover:bg-amber-50"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pickLibraryValue(draftAsCommit)}
            >
              使用当前输入「{draftAsCommit}」
            </button>
          )}
        </div>
      )}
    </div>
  );
}
