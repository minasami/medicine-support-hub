import * as React from "react";
import { Check, ChevronsUpDown, PlusCircle } from "lucide-react";

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
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/lib/i18n";

export interface SearchableComboboxProps {
  options: { label: string; value: string }[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  addNewText?: string;
  addNewDescription?: string;
}

export function SearchableCombobox({
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  emptyText,
  addNewText,
  addNewDescription,
}: SearchableComboboxProps) {
  const { t } = useLanguage();
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [isCustom, setIsCustom] = React.useState(false);

  // If a value is provided that isn't in the options list, it's considered custom
  React.useEffect(() => {
    if (value && !options.find((opt) => opt.value === value)) {
      setIsCustom(true);
    } else if (value && options.find((opt) => opt.value === value)) {
      setIsCustom(false);
    }
  }, [value, options]);

  const defaultPlaceholder = t("Select an option", "حدد خياراً");
  const defaultSearchPlaceholder = t("Search...", "بحث...");
  const defaultEmptyText = t("No matches found.", "لم يتم العثور على نتائج.");
  const defaultAddNewText = t("Add new value", "إضافة قيمة جديدة");
  const defaultAddNewDescription = t("Use only if no suitable option exists.", "استخدم فقط إذا لم يكن الخيار المناسب موجوداً.");

  if (isCustom) {
    return (
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={defaultAddNewText}
          className="flex-1"
          autoFocus
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setIsCustom(false);
            onChange("");
          }}
        >
          {t("Cancel", "إلغاء")}
        </Button>
      </div>
    );
  }

  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-muted-foreground"
          )}
        >
          {selectedOption ? selectedOption.label : (placeholder || defaultPlaceholder)}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(94vw,400px)] p-0" align="start">
        <Command>
          <CommandInput
            value={searchQuery}
            onValueChange={setSearchQuery}
            placeholder={searchPlaceholder || defaultSearchPlaceholder}
          />
          <CommandList className="max-h-[300px]">
            <CommandEmpty>{emptyText || defaultEmptyText}</CommandEmpty>
            <CommandGroup heading={t("Options", "خيارات")}>
              <CommandItem
                value="__new_value__"
                onSelect={() => {
                  setIsCustom(true);
                  onChange("");
                  setOpen(false);
                }}
              >
                <PlusCircle className="mr-3 h-5 w-5 text-primary" />
                <span className="flex-1">
                  <span className="block font-semibold">
                    {addNewText || defaultAddNewText}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {addNewDescription || defaultAddNewDescription}
                  </span>
                </span>
              </CommandItem>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={(currentValue) => {
                    onChange(currentValue === value ? "" : option.value);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
