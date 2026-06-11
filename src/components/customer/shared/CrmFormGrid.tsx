import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

export type CrmFieldConfig = {
  key: string;
  label: string;
  type?: "text" | "email" | "tel" | "number" | "date" | "textarea" | "select" | "switch";
  options?: string[];
  placeholder?: string;
  readOnly?: boolean;
  colSpan?: 2 | 3;
};

const fieldClass = "h-9 text-sm rounded-md bg-background";

export function CrmFormGrid({
  fields,
  values,
  onChange,
  errors = {},
}: {
  fields: CrmFieldConfig[];
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  errors?: Record<string, string | null>;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-4 gap-y-3">
      {fields.map((f) => (
        <CrmField key={f.key} field={f} value={values[f.key]} error={errors[f.key]} onChange={onChange} />
      ))}
    </div>
  );
}

function CrmField({
  field,
  value,
  error,
  onChange,
}: {
  field: CrmFieldConfig;
  value: unknown;
  error?: string | null;
  onChange: (key: string, value: unknown) => void;
}) {
  const id = `crm-${field.key}`;
  const str =
    value == null || value === ""
      ? ""
      : typeof value === "number"
        ? String(value)
        : String(value);
  const span =
    field.colSpan === 3
      ? "sm:col-span-2 xl:col-span-3"
      : field.colSpan === 2
        ? "sm:col-span-2"
        : "";

  if (field.type === "switch") {
    return (
      <div className={`flex items-center justify-between rounded-lg border border-border px-3 py-2 min-h-9 ${span}`}>
        <Label htmlFor={id} className="text-xs font-medium">
          {field.label}
        </Label>
        <Switch
          id={id}
          checked={Boolean(value)}
          onCheckedChange={(v) => onChange(field.key, v)}
          disabled={field.readOnly}
        />
      </div>
    );
  }

  return (
    <div className={`space-y-1 ${span}`}>
      <Label htmlFor={id} className="text-[11px] font-medium text-muted-foreground">
        {field.label}
      </Label>
      {field.type === "textarea" ? (
        <Textarea
          id={id}
          value={str}
          placeholder={field.placeholder ?? `Enter ${field.label.toLowerCase()}`}
          onChange={(e) => onChange(field.key, e.target.value)}
          readOnly={field.readOnly}
          rows={3}
          className="resize-none bg-background text-sm min-h-[72px] rounded-md"
        />
      ) : field.type === "select" && field.options ? (
        <Select value={str || undefined} onValueChange={(v) => onChange(field.key, v)} disabled={field.readOnly}>
          <SelectTrigger id={id} className={fieldClass}>
            <SelectValue placeholder={field.placeholder ?? "Select"} />
          </SelectTrigger>
          <SelectContent>
            {field.options.map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          id={id}
          type={field.type === "number" ? "text" : field.type ?? "text"}
          value={str}
          placeholder={field.placeholder ?? `Enter ${field.label.toLowerCase()}`}
          onChange={(e) => onChange(field.key, field.type === "number" ? e.target.value : e.target.value)}
          readOnly={field.readOnly}
          className={fieldClass}
        />
      )}
      {error && <p className="text-[10px] text-destructive">{error}</p>}
    </div>
  );
}
