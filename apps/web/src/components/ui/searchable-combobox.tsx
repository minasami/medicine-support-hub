import * as React from "react";
import { Check, ChevronsUpDown, PlusCircle, ListFilter } from "lucide-react";

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
  allowCustom?: boolean;
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
  allowCustom = true,
}: SearchableComboboxProps) {
  const { t } = useLanguage();
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [isCustom, setIsCustom] = React.useState(false);

  // Determine if current value is custom (not in predefined options list)
  React.useEffect(() => {
    if (allowCustom) {
      if (value && !options.some((opt) => opt.value.toLowerCase() === value.toLowerCase())) {
        setIsCustom(true);
      }
    } else {
      setIsCustom(false);
    }
  }, [value, options, allowCustom]);

  const defaultPlaceholder = t("Select an option", "حدد خياراً");
  const defaultSearchPlaceholder = t("Search...", "بحث...");
  const defaultEmptyText = t("No matches found in database.", "لم يتم العثور على نتائج في قاعدة البيانات.");
  const defaultAddNewText = t("Add new value", "إضافة قيمة جديدة");
  const defaultAddNewDescription = t("Use only if no suitable option exists.", "استخدم فقط إذا لم يكن الخيار المناسب موجوداً.");

  if (allowCustom && isCustom) {
    return (
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={addNewText || defaultAddNewText}
          className="flex-1"
          autoFocus
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 text-xs gap-1"
          onClick={() => {
            setIsCustom(false);
            onChange("");
          }}
          title={t("Choose from database options", "اختر من خيارات قاعدة البيانات")}
        >
          <ListFilter className="h-3.5 w-3.5" />
          {t("Choose from list", "اختر من القائمة")}
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
          <span className="truncate">
            {selectedOption ? selectedOption.label : (value || placeholder || defaultPlaceholder)}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(94vw,420px)] p-0" align="start">
        <Command>
          <CommandInput
            value={searchQuery}
            onValueChange={setSearchQuery}
            placeholder={searchPlaceholder || defaultSearchPlaceholder}
          />
          <CommandList className="max-h-[300px]">
            <CommandEmpty className="p-3 text-center space-y-2">
              <p className="text-xs text-muted-foreground">{emptyText || defaultEmptyText}</p>
              {allowCustom && searchQuery.trim() && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="w-full justify-start text-xs font-medium"
                  onClick={() => {
                    onChange(searchQuery.trim());
                    setIsCustom(true);
                    setOpen(false);
                  }}
                >
                  <PlusCircle className="mr-2 h-4 w-4 text-primary" />
                  {t("Add", "إضافة")} "{searchQuery.trim()}"
                </Button>
              )}
            </CommandEmpty>
            <CommandGroup heading={t("Database Options", "خيارات قاعدة البيانات")}>
              {allowCustom && (
                <CommandItem
                  value={`__add_custom_item__ ${searchQuery}`}
                  onSelect={() => {
                    if (searchQuery.trim()) {
                      onChange(searchQuery.trim());
                    } else {
                      onChange("");
                    }
                    setIsCustom(true);
                    setOpen(false);
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
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={`${option.label} ::: ${option.value}`}
                  onSelect={() => {
                    onChange(option.value === value ? "" : option.value);
                    setIsCustom(false);
                    setOpen(false);
                  }}
                  className="cursor-pointer"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 shrink-0",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="truncate">{option.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
