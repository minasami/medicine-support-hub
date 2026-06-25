---
name: FormLabel/FormControl outside FormField (shadcn/ui)
description: Using shadcn FormLabel or FormControl outside a FormField render prop throws a runtime error — use plain HTML elements instead.
---

In shadcn/ui, `<FormLabel>` and `<FormControl>` call `useFormField()` internally, which throws if there's no `FormField` ancestor providing context. This breaks silently at the TypeScript level but crashes at runtime.

**Rule:** Inside dynamic field array rows (e.g. `useFieldArray`) where you render labels or controls for non-registered fields (like a combobox trigger that doesn't need its own FormField), use plain `<label>` and plain `<Button>` instead of `<FormLabel>` / `<FormControl>`.

**Why:** The `FormField` render prop provides `FormFieldContext`. Without it, `useFormField()` throws `"useFormField should be used within <FormField>"`.

**How to apply:** Any time a label or control appears outside the render prop of a `<FormField>` — especially inside `.map()` over `fields` from `useFieldArray` — replace `<FormLabel>` with `<label className="text-sm font-medium leading-none">` and remove `<FormControl>` wrappers around non-input triggers like Popover/Button.
