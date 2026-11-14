"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Info,
  Loader2,
  X,
  type LucideIcon,
} from "lucide-react";

export function cn(...values: Array<string | false | null | undefined>) {
  return twMerge(clsx(values));
}

/* -------------------------------------------------------------------------- */
/* Buttons                                                                     */
/* -------------------------------------------------------------------------- */

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "bg-emerald-500 text-emerald-950 hover:bg-emerald-400 focus-visible:ring-emerald-400 shadow-[0_0_0_1px_rgba(16,185,129,0.15),0_8px_24px_-12px_rgba(16,185,129,0.7)]",
  secondary:
    "bg-zinc-800 text-zinc-100 hover:bg-zinc-700 focus-visible:ring-zinc-500 border border-zinc-700",
  outline:
    "border border-zinc-700 bg-transparent text-zinc-200 hover:border-zinc-500 hover:bg-zinc-900 focus-visible:ring-zinc-500",
  ghost: "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 focus-visible:ring-zinc-600",
  danger: "bg-red-500/15 text-red-300 border border-red-500/30 hover:bg-red-500/25 focus-visible:ring-red-500",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-11 px-5 text-sm gap-2",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={cn(
        "inline-flex select-none items-center justify-center rounded-lg font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:cursor-not-allowed disabled:opacity-50",
        buttonVariants[variant],
        buttonSizes[size],
        className
      )}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Surfaces                                                                    */
/* -------------------------------------------------------------------------- */

export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cn(
        "rounded-xl border border-zinc-800 bg-zinc-900/60 shadow-sm backdrop-blur-sm",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action,
  icon: Icon,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 border-b border-zinc-800 px-5 py-4", className)}>
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-500/10 text-emerald-400">
            <Icon className="h-4.5 w-4.5" />
          </span>
        )}
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-zinc-100">{title}</h3>
          {description && <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">{description}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && (
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-bold tracking-tight text-white">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-zinc-400">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Badge                                                                       */
/* -------------------------------------------------------------------------- */

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: "neutral" | "green" | "amber" | "red" | "blue" | "purple";
  className?: string;
  children: ReactNode;
}) {
  const tones: Record<string, string> = {
    neutral: "border-zinc-700 bg-zinc-800/70 text-zinc-300",
    green: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    amber: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    red: "border-red-500/30 bg-red-500/10 text-red-300",
    blue: "border-sky-500/30 bg-sky-500/10 text-sky-300",
    purple: "border-violet-500/30 bg-violet-500/10 text-violet-300",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Form controls                                                               */
/* -------------------------------------------------------------------------- */

const controlBase =
  "w-full rounded-lg border border-zinc-700 bg-zinc-950/70 px-3 text-sm text-zinc-100 placeholder:text-zinc-600 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(controlBase, "h-10", className)} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(controlBase, "min-h-24 py-2", className)} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={cn(controlBase, "h-10 appearance-none pr-8", className)}>
      {children}
    </select>
  );
}

export function Label({
  children,
  htmlFor,
  hint,
  required,
}: {
  children: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  required?: boolean;
}) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between gap-3">
      <label htmlFor={htmlFor} className="text-xs font-medium text-zinc-300">
        {children}
        {required && <span className="ml-0.5 text-emerald-400">*</span>}
      </label>
      {hint && <span className="text-[11px] text-zinc-500">{hint}</span>}
    </div>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor} hint={hint} required={required}>
        {label}
      </Label>
      {children}
      {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
    </div>
  );
}

export function Checkbox({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: ReactNode;
  description?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3 transition-colors hover:border-zinc-700",
        disabled && "cursor-not-allowed opacity-60"
      )}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-zinc-600 bg-zinc-900 text-emerald-500 accent-emerald-500 focus:ring-emerald-500"
      />
      <span>
        <span className="block text-xs font-medium text-zinc-200">{label}</span>
        {description && <span className="mt-0.5 block text-[11px] leading-relaxed text-zinc-500">{description}</span>}
      </span>
    </label>
  );
}

/* -------------------------------------------------------------------------- */
/* Feedback                                                                    */
/* -------------------------------------------------------------------------- */

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: "info" | "success" | "warning" | "error";
  title?: string;
  children?: ReactNode;
  className?: string;
}) {
  const config = {
    info: { icon: Info, classes: "border-sky-500/30 bg-sky-500/10 text-sky-200" },
    success: { icon: CheckCircle2, classes: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" },
    warning: { icon: AlertTriangle, classes: "border-amber-500/30 bg-amber-500/10 text-amber-200" },
    error: { icon: AlertTriangle, classes: "border-red-500/30 bg-red-500/10 text-red-200" },
  }[tone];
  const Icon = config.icon;
  return (
    <div className={cn("flex gap-3 rounded-lg border p-3.5 text-sm", config.classes, className)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn("leading-relaxed", title && "mt-1 opacity-90")}>{children}</div>}
      </div>
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-5 w-5 animate-spin text-emerald-400", className)} />;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 bg-zinc-950/30 px-6 py-14 text-center">
      {Icon && (
        <span className="mb-4 grid h-12 w-12 place-items-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-500">
          <Icon className="h-5 w-5" />
        </span>
      )}
      <h3 className="text-sm font-semibold text-zinc-200">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-xs leading-relaxed text-zinc-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-zinc-800/70", className)} />;
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  tone?: "neutral" | "green" | "amber" | "red" | "blue";
}) {
  const toneClass = {
    neutral: "text-zinc-400 bg-zinc-800/60",
    green: "text-emerald-400 bg-emerald-500/10",
    amber: "text-amber-400 bg-amber-500/10",
    red: "text-red-400 bg-red-500/10",
    blue: "text-sky-400 bg-sky-500/10",
  }[tone];
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-white">{value}</p>
          {hint && <p className="mt-1 text-[11px] text-zinc-500">{hint}</p>}
        </div>
        {Icon && (
          <span className={cn("grid h-9 w-9 place-items-center rounded-lg", toneClass)}>
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Modal                                                                       */
/* -------------------------------------------------------------------------- */

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;
  const widths = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        aria-label="Close dialog"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "relative w-full rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl",
          widths[size]
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-zinc-800 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-white">{title}</h2>
            {description && <p className="mt-1 text-xs leading-relaxed text-zinc-400">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-zinc-500 transition-colors hover:bg-zinc-900 hover:text-zinc-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children && <div className="px-5 py-4">{children}</div>}
        {footer && <div className="flex justify-end gap-2 border-t border-zinc-800 px-5 py-4">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard unavailable */
        }
      }}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : label}
    </Button>
  );
}

/* -------------------------------------------------------------------------- */
/* Toasts                                                                      */
/* -------------------------------------------------------------------------- */

type ToastTone = "success" | "error" | "info";
type ToastItem = { id: number; message: string; tone: ToastTone };

const ToastContext = createContext<{
  toast: (message: string, tone?: ToastTone) => void;
} | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const toast = useCallback((message: string, tone: ToastTone = "info") => {
    const id = Date.now() + Math.random();
    setItems((current) => [...current.slice(-3), { id, message, tone }]);
    setTimeout(() => {
      setItems((current) => current.filter((item) => item.id !== id));
    }, 5000);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2">
        {items.map((item) => {
          const config = {
            success: { icon: CheckCircle2, classes: "border-emerald-500/30 text-emerald-200" },
            error: { icon: AlertTriangle, classes: "border-red-500/30 text-red-200" },
            info: { icon: Info, classes: "border-sky-500/30 text-sky-200" },
          }[item.tone];
          const Icon = config.icon;
          return (
            <div
              key={item.id}
              className={cn(
                "pointer-events-auto flex items-start gap-3 rounded-lg border bg-zinc-950/95 px-4 py-3 text-sm shadow-xl backdrop-blur",
                config.classes
              )}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="leading-relaxed">{item.message}</p>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}
