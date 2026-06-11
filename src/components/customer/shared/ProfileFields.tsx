import { useCallback, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import type { CustomerProfile } from "@/lib/customer-crm/types";
import { validateEmail, validateMobile, validatePan, validatePincode, normalizeMobile, normalizePan } from "@/lib/customer-crm/validation";

export type FieldDef = {
  key: keyof CustomerProfile;
  label: string;
  type?: "text" | "email" | "tel" | "number" | "date" | "textarea" | "select";
  options?: string[];
  readOnly?: boolean;
  validate?: "pan" | "mobile" | "email" | "pincode";
};

export function ProfileFieldGrid({
  fields,
  profile,
  onSave,
}: {
  fields: FieldDef[];
  profile: CustomerProfile;
  onSave: (patch: Partial<CustomerProfile>) => Promise<boolean>;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {fields.map((f) => (
        <ProfileField key={String(f.key)} field={f} value={profile[f.key]} onSave={onSave} />
      ))}
    </div>
  );
}

function ProfileField({
  field,
  value,
  onSave,
}: {
  field: FieldDef;
  value: unknown;
  onSave: (patch: Partial<CustomerProfile>) => Promise<boolean>;
}) {
  const str = value == null ? "" : String(value);
  const [draft, setDraft] = useState(str);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const runValidation = useCallback(
    (v: string) => {
      if (!field.validate) return null;
      if (field.validate === "pan") return validatePan(v);
      if (field.validate === "mobile") return validateMobile(v);
      if (field.validate === "email") return validateEmail(v);
      if (field.validate === "pincode") return validatePincode(v);
      return null;
    },
    [field.validate],
  );

  const commit = async () => {
    if (field.readOnly) return;
    const err = runValidation(draft);
    if (err) {
      setError(err);
      return;
    }
    let out: string | number | null = draft.trim() || null;
    if (field.validate === "pan" && out) out = normalizePan(String(out));
    if (field.validate === "mobile" && out) out = normalizeMobile(String(out));
    if (field.type === "number" && out) out = Number(out);

    setSaving(true);
    const ok = await onSave({ [field.key]: out } as Partial<CustomerProfile>);
    setSaving(false);
    if (ok) {
      setDirty(false);
      setError(null);
    }
  };

  const inputId = `field-${String(field.key)}`;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={inputId} className="text-xs text-muted-foreground">
        {field.label}
      </Label>
      {field.type === "textarea" ? (
        <Textarea
          id={inputId}
          value={dirty ? draft : str}
          onChange={(e) => {
            setDraft(e.target.value);
            setDirty(true);
          }}
          onBlur={commit}
          rows={2}
          disabled={field.readOnly || saving}
          className="resize-none"
        />
      ) : field.type === "select" && field.options ? (
        <Select
          value={dirty ? draft : str || undefined}
          onValueChange={async (v) => {
            setDraft(v);
            setSaving(true);
            await onSave({ [field.key]: v } as Partial<CustomerProfile>);
            setSaving(false);
            setDirty(false);
          }}
          disabled={field.readOnly || saving}
        >
          <SelectTrigger id={inputId}>
            <SelectValue placeholder="Select" />
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
          id={inputId}
          type={field.type === "number" ? "text" : field.type ?? "text"}
          value={dirty ? draft : str}
          readOnly={field.readOnly}
          onChange={(e) => {
            setDraft(e.target.value);
            setDirty(true);
          }}
          onBlur={commit}
          disabled={saving}
        />
      )}
      {error && <p className="text-[11px] text-destructive">{error}</p>}
      {saving && (
        <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
          <Loader2 className="size-3 animate-spin" /> Saving…
        </p>
      )}
    </div>
  );
}

