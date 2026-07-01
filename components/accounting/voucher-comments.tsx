"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageSquare, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useJournal } from "@/components/accounting/journal-provider";
import { useAccess } from "@/components/access/access-provider";
import { EMPLOYEES } from "@/lib/hr/employees";
import type { Employee } from "@/lib/hr/types";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Renders employee name for a given ID, falling back to the raw ID.
// ---------------------------------------------------------------------------
function empName(id: string): string {
  return EMPLOYEES.find((e) => e.id === id)?.name ?? id;
}

// ---------------------------------------------------------------------------
// Render comment text: replace @emp-001 with a styled chip showing the name.
// ---------------------------------------------------------------------------
function CommentText({ text }: { text: string }) {
  const parts = text.split(/(@emp-\d+)/g);
  return (
    <span>
      {parts.map((part, i) => {
        if (/^@emp-\d+$/.test(part)) {
          const name = empName(part.slice(1));
          return (
            <span key={i} className="inline-flex items-center rounded bg-primary/10 px-1 py-0.5 text-xs font-medium text-primary">
              @{name}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}

// ---------------------------------------------------------------------------
// @mention autocomplete dropdown.
// ---------------------------------------------------------------------------
function MentionDropdown({
  query,
  onSelect,
}: {
  query: string;
  onSelect: (emp: Employee) => void;
}) {
  const active = EMPLOYEES.filter(
    (e) => e.status !== "exited" && e.name.toLowerCase().includes(query.toLowerCase()),
  ).slice(0, 6);

  if (active.length === 0) return null;

  return (
    <div className="absolute bottom-full left-0 mb-1 w-56 overflow-hidden rounded-lg border bg-card shadow-lg z-10">
      {active.map((emp) => (
        <button
          key={emp.id}
          type="button"
          onMouseDown={(e) => { e.preventDefault(); onSelect(emp); }}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
        >
          <span className="size-6 flex shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary uppercase">
            {emp.name.charAt(0)}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium">{emp.name}</p>
            <p className="truncate text-xs text-muted-foreground">{emp.designation}</p>
          </div>
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Full comment thread for a single voucher.
// ---------------------------------------------------------------------------
export function VoucherComments({ voucherId }: { voucherId: string }) {
  const { comments, addComment } = useJournal();
  const { currentUserId } = useAccess();
  const [text, setText] = useState("");
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [cursorPos, setCursorPos] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const voucherComments = comments
    .filter((c) => c.voucherId === voucherId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const pos = e.target.selectionStart ?? val.length;
    setText(val);
    setCursorPos(pos);

    const before = val.slice(0, pos);
    const match = before.match(/@(\w*)$/);
    if (match) {
      setMentionOpen(true);
      setMentionQuery(match[1]);
    } else {
      setMentionOpen(false);
    }
  }, []);

  const insertMention = useCallback(
    (emp: Employee) => {
      const before = text.slice(0, cursorPos);
      const after = text.slice(cursorPos);
      const atIdx = before.lastIndexOf("@");
      const newText = `${before.slice(0, atIdx)}@${emp.id} ${after}`;
      setText(newText);
      setMentionOpen(false);
      // Restore focus + move cursor after the inserted mention
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          const newPos = atIdx + emp.id.length + 2;
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(newPos, newPos);
        }
      });
    },
    [text, cursorPos],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") setMentionOpen(false);
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    addComment(voucherId, trimmed, currentUserId);
    setText("");
    setMentionOpen(false);
  };

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-3 pt-1">
      {voucherComments.length === 0 ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MessageSquare className="size-3.5" /> No comments yet.
        </p>
      ) : (
        <div className="space-y-2">
          {voucherComments.map((c) => (
            <div key={c.id} className="flex gap-2.5">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold uppercase">
                {empName(c.authorId).charAt(0)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-semibold">{empName(c.authorId)}</span>
                  <span className="text-[10px] text-muted-foreground">{formatTime(c.createdAt)}</span>
                </div>
                <p className="mt-0.5 text-sm">
                  <CommentText text={c.text} />
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="relative">
        {mentionOpen && (
          <MentionDropdown query={mentionQuery} onSelect={insertMention} />
        )}
        <div className="flex gap-2">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Add a comment… type @ to mention someone"
            rows={2}
            className={cn(
              "flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0",
            )}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={handleSubmit}
            disabled={!text.trim()}
            className="self-end"
            title="Add comment (Ctrl+Enter)"
          >
            <Send className="size-3.5" />
          </Button>
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground">Ctrl+Enter to submit · @ to mention</p>
      </div>
    </div>
  );
}
