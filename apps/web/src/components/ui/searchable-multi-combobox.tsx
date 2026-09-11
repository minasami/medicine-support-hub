import * as React from "react";
import { Check, ChevronsUpDown, PlusCircle, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/lib/i18n";
import { filterAndRankComboboxOptions } from "@/lib/combobox-rank";

export interface SearchableMultiComboboxProps {
  options: { label: string; value: string; meta?: string }[];
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  addNewText?: string;
  addNewDescription?: string;
  allowCustom?: boolean;
  /** Cap ranked results shown while searching (default 80). */
  resultLimit?: number;
}

function normalizeKey(s: string): string {
  return String(s || "")
    .trim()
    .toLowerCase();
}

export function SearchableMultiCombobox({
  options,
  values,
  onChange,
  placeholder,
  searchPlaceholder,
  emptyText,
  addNewText,
  addNewDescription,
  allowCustom = true,
  resultLimit = 80,
}: SearchableMultiComboboxProps) {
  const { t } = useLanguage();
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [addingCustom, setAddingCustom] = React.useState(false);
  const [customDraft, setCustomDraft] = React.useState("");

  const selectedKeys = React.useMemo(
    () => new Set(values.map(normalizeKey).filter(Boolean)),
    [values],
  );

  const rankedOptions = React.useMemo(
    () => filterAndRankComboboxOptions(options, searchQuery, resultLimit),
    [options, searchQuery, resultLimit],
  );

  const defaultPlaceholder = t("Select one or more…", "اختر واحداً أو أكثر…");
  const defaultSearchPlaceholder = t("Search...", "بحث...");
  const defaultEmptyText = t(
    "No matches found in database.",
    "لم يتم العثور على نتائج في قاعدة البيانات.",
  );
  const defaultAddNewText = t("+ Add New", "＋ إضافة جديد");
  const defaultAddNewDescription = t(
    "Use only if no suitable option exists.",
    "استخدم فقط إذا لم يكن الخيار المناسب موجوداً.",
  );

  const toggleValue = (value: string) => {
    const key = normalizeKey(value);
    if (!key) return;
    const exists = values.some((v) => normalizeKey(v) === key);
    if (exists) {
      onChange(values.filter((v) => normalizeKey(v) !== key));
    } else {
      onChange([...values, value]);
    }
  };

  const removeValue = (value: string) => {
    const key = normalizeKey(value);
    onChange(values.filter((v) => normalizeKey(v) !== key));
  };

  const commitCustom = (raw: string) => {
    const next = raw.trim();
    if (!next) {
      setAddingCustom(false);
      setCustomDraft("");
      return;
    }
    const key = normalizeKey(next);
    if (!values.some((v) => normalizeKey(v) === key)) {
      onChange([...values, next]);
    }
    setAddingCustom(false);
    setCustomDraft("");
    setSearchQuery("");
    setOpen(false);
  };

  const labelFor = (value: string) => {
    const match = options.find((o) => normalizeKey(o.value) === normalizeKey(value));
    return match?.label || value;
  };

  return (
    <div className="space-y-2">
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {values.map((v) => (
            <Badge
              key={normalizeKey(v)}
              variant="secondary"
              className="max-w-full gap-1 pr-1 font-normal"
            >
              <span className="truncate">{labelFor(v)}</span>
              <button
                type="button"
                className="rounded-sm p-0.5 hover:bg-muted"
                aria-label={t("Remove", "إزالة")}
                onClick={() => removeValue(v)}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {addingCustom && allowCustom ? (
        <div className="flex gap-2">
          <Input
            value={customDraft}
            onChange={(e) => setCustomDraft(e.target.value)}
            placeholder={addNewText || defaultAddNewText}
            className="flex-1"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitCustom(customDraft);
              } else if (e.key === "Escape") {
                setAddingCustom(false);
                setCustomDraft("");
              }
            }}
          />
          <Button
            type="button"
            size="sm"
            onClick={() => commitCustom(customDraft)}
            disabled={!customDraft.trim()}
          >
            {t("Add", "إضافة")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setAddingCustom(false);
              setCustomDraft("");
            }}
          >
            {t("Cancel", "إلغاء")}
          </Button>
        </div>
      ) : (
        <Popover
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) setSearchQuery("");
          }}
        >
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className={cn(
                "w-full justify-between font-normal",
                values.length === 0 && "text-muted-foreground",
              )}
            >
              <span className="truncate">
                {values.length > 0
                  ? t(
                      `${values.length} selected — add more`,
                      `${values.length} محدد — أضف المزيد`,
                    )
                  : placeholder || defaultPlaceholder}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[min(94vw,420px)] p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput
                value={searchQuery}
                onValueChange={setSearchQuery}
                placeholder={searchPlaceholder || defaultSearchPlaceholder}
              />
              <CommandList className="max-h-[300px]">
                <CommandEmpty className="p-3 text-center space-y-2">
                  <p className="text-xs text-muted-foreground">
                    {emptyText || defaultEmptyText}
                  </p>
                  {allowCustom && searchQuery.trim() && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="w-full justify-start text-xs font-medium"
                      onClick={() => commitCustom(searchQuery)}
                    >
                      <PlusCircle className="mr-2 h-4 w-4 text-primary" />
                      {t("Add", "إضافة")} "{searchQuery.trim()}"
                    </Button>
                  )}
                </CommandEmpty>
                <CommandGroup heading={t("Database Options", "خيارات قاعدة البيانات")}>
                  {allowCustom && (
                    <CommandItem
                      value={`__add_custom_multi__ ${searchQuery}`}
                      onSelect={() => {
                        if (searchQuery.trim()) {
                          commitCustom(searchQuery);
                        } else {
                          setAddingCustom(true);
                          setOpen(false);
                        }
                      }}
                      className="text-primary font-medium border-b mb-1 pb-2 cursor-pointer"
                    >
                      <PlusCircle className="mr-2 h-4 w-4 shrink-0" />
                      <span className="flex-1 truncate">
                        {searchQuery.trim() ? (
                          <>
                            {t("Add new:", "إضافة جديد:")}{" "}
                            <strong className="underline">{searchQuery.trim()}</strong>
                          </>
                        ) : (
                          <>
                            <span className="block font-semibold">
                              {addNewText || defaultAddNewText}
                            </span>
                            <span className="block text-xs text-muted-foreground font-normal">
                              {addNewDescription || defaultAddNewDescription}
                            </span>
                          </>
                        )}
                      </span>
                    </CommandItem>
                  )}
                  {rankedOptions.map((option) => {
                    const selected = selectedKeys.has(normalizeKey(option.value));
                    return (
                      <CommandItem
                        key={`${option.value}::${option.meta || ""}`}
                        value={`${option.label} ::: ${option.value}`}
                        onSelect={() => {
                          toggleValue(option.value);
                          setSearchQuery("");
                        }}
                        className="cursor-pointer"
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4 shrink-0",
                            selected ? "opacity-100" : "opacity-0",
                          )}
                        />
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate">{option.label}</span>
                          {option.meta ? (
                            <span className="truncate text-[10px] text-muted-foreground">
                              {option.meta}
                            </span>
                          ) : null}
                        </span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
